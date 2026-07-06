import { create } from "zustand";
import {
    buildFormStateFromSources,
    buildParticipantInfo,
    buildStoredDraft,
    type MobileAuditFormState,
} from "lib/yee-mobile-draft";
import type { MobileYeeDomainKey, MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import {
    isAffirmativeAnswer,
    normalizeInstrument,
    type InstrumentPromptRow,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { findFirstIncompleteStep } from "lib/yee-submit-guard";
import { fetchYeeInstrument, saveAuditDraft } from "lib/yee-api";
import { readInstrumentCache, writeInstrumentCache } from "lib/yee-offline-storage";
import type { YeeAssignedPlace, YeeLocalDraft } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const SURVEY_NOT_CACHED_MESSAGE =
    "This device has not cached the full YEE survey instrument yet. Connect once online and refresh the mobile app before starting or continuing this audit offline.";
const SURVEY_LOAD_FAILED_MESSAGE = "Unable to load this audit's survey instrument.";

/** First paint state of the active audit. */
export type AuditLoadPhase = "idle" | "loading" | "ready" | "error";
/** Live persistence feedback surfaced by the save-status pill. */
export type AuditSaveStatus = "idle" | "saving" | "saved" | "queued" | "error";

export interface AuditSessionState {
    readonly placeId: string | null;
    readonly instrument: NormalizedInstrument | null;
    readonly draft: MobileAuditFormState | null;
    readonly step: MobileYeeStepNumber;
    readonly loadPhase: AuditLoadPhase;
    readonly errorMessage: string | null;
    readonly saveStatus: AuditSaveStatus;
    readonly lastSavedAt: string | null;
    /**
     * True once the auditor has made any local edit this session. Guards the
     * background remote refresh from clobbering unsaved work.
     */
    readonly hasLocalEdits: boolean;
    /**
     * True when the session was opened purely to VIEW a submitted audit. In this
     * mode every setter is a no-op, autosave never fires, and close() never
     * flushes — the loaded answers are display-only and must never be written
     * back as a draft.
     */
    readonly readOnly: boolean;

    open: (placeId: string, options: { place: YeeAssignedPlace | null }) => Promise<void>;
    /**
     * Open the session in view-only mode from an already-built form state (e.g. a
     * fetched submission mapped via buildFormStateFromSources, or a queued local
     * draft). Loads the instrument for rendering but starts no autosave and no
     * remote refresh.
     */
    openReadOnly: (
        formState: MobileAuditFormState,
        options?: { instrument?: NormalizedInstrument | null },
    ) => Promise<void>;
    retryLoad: () => Promise<void>;
    close: () => void;

    setStep: (step: MobileYeeStepNumber) => void;

    setVisitFrequency: (value: string) => void;
    setPublicAccess: (value: string) => void;
    setOpenHoursAccess: (value: string) => void;
    setSeason: (value: string) => void;
    toggleWeather: (value: string) => void;

    setWeight: (domain: MobileYeeDomainKey, value: string) => void;
    setWeightingComments: (value: string) => void;

    setPresenceAnswer: (row: InstrumentPromptRow, answerId: string) => void;
    setConditionAnswer: (row: InstrumentPromptRow, answerId: string) => void;

    setSectionComment: (domain: MobileYeeDomainKey, value: string) => void;
    setComments: (value: string) => void;

    /**
     * Full persist with the remote mirror / offline queue. Used by Next,
     * Save & Exit, and before navigating to review. Autosave (local-only) is
     * automatic; this is the durable, network-aware commit.
     */
    commitManual: () => Promise<void>;
}

const INITIAL_STATE = {
    placeId: null,
    instrument: null,
    draft: null,
    step: 1 as MobileYeeStepNumber,
    loadPhase: "idle" as AuditLoadPhase,
    errorMessage: null,
    saveStatus: "idle" as AuditSaveStatus,
    lastSavedAt: null,
    hasLocalEdits: false,
    readOnly: false,
} satisfies Partial<AuditSessionState>;

/**
 * Fingerprint of the meaningful draft fields. Autosave skips a persist when the
 * fingerprint is unchanged, so setStep / no-op edits never write MMKV. Ported
 * verbatim from the old per-step screen so the change-detection is identical.
 */
function buildDraftFingerprint(draft: MobileAuditFormState): string {
    return JSON.stringify({
        visitFrequency: draft.visitFrequency,
        publicAccess: draft.publicAccess,
        openHoursAccess: draft.openHoursAccess,
        season: draft.season,
        weather: draft.weather,
        weights: draft.weights,
        responses: draft.responses,
        comments: draft.comments,
        sectionComments: draft.sectionComments,
        weightingComments: draft.weightingComments,
        finishTime: draft.finishTime,
        totalMinutes: draft.totalMinutes,
    });
}

/** Fingerprint of the last draft durably committed to MMKV (module ref, no re-render). */
let lastPersistedFingerprint: string | null = null;
/** Pending debounced autosave handle. */
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAutosave(): void {
    if (autosaveTimer !== null) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
    }
}

function resolvePlaceName(
    place: YeeAssignedPlace | null,
    storedDraft: YeeLocalDraft | null,
): string {
    return place?.name ?? storedDraft?.participantInfo.place_name?.toString() ?? "Assigned place";
}

function resolveAuditorId(storedDraft: YeeLocalDraft | null): string {
    return storedDraft?.participantInfo.auditor_id?.toString() ?? "AUDITOR";
}

export const useAuditSessionStore = create<AuditSessionState>((set, get) => {
    /**
     * Apply a pure mutation to the draft, marking local edits. Returning the same
     * reference is a no-op (no state change, no autosave). Nested spreads keep
     * every untouched primitive referentially identical, so granular selectors
     * only re-render the card that actually changed.
     */
    function patchDraft(mutator: (draft: MobileAuditFormState) => MobileAuditFormState): void {
        set((state) => {
            // View-only sessions never mutate the draft — belt-and-suspenders on
            // top of the disabled controls in the step screens.
            if (state.readOnly || state.draft === null) {
                return {};
            }
            const next = mutator(state.draft);
            if (next === state.draft) {
                return {};
            }
            return { draft: next, hasLocalEdits: true };
        });
    }

    return {
        ...INITIAL_STATE,

        open: async (placeId, { place }) => {
            cancelAutosave();
            lastPersistedFingerprint = null;

            const mobileStore = useYeeMobileStore.getState();
            const isOnline = mobileStore.isOnline;
            const storedDraft = mobileStore.draftsByPlace[placeId] ?? null;

            set({
                ...INITIAL_STATE,
                placeId,
                loadPhase: "loading",
            });

            let instrument: NormalizedInstrument | null = null;
            try {
                const cached = await readInstrumentCache();
                if (cached !== null) {
                    instrument = normalizeInstrument(cached);
                }
            } catch {
                instrument = null;
            }

            // Abandoned mid-load (audit closed / switched) — drop this result.
            if (get().placeId !== placeId) {
                return;
            }

            const draft = buildFormStateFromSources({
                placeId,
                placeName: resolvePlaceName(place, storedDraft),
                auditorId: resolveAuditorId(storedDraft),
                storedDraft,
                auditState: null,
            });
            lastPersistedFingerprint = buildDraftFingerprint(draft);

            if (instrument === null && !isOnline) {
                set({
                    draft,
                    instrument: null,
                    loadPhase: "error",
                    errorMessage: SURVEY_NOT_CACHED_MESSAGE,
                });
                return;
            }

            const step = findFirstIncompleteStep(draft, instrument)?.step ?? 1;
            set({
                draft,
                instrument,
                step,
                loadPhase: instrument !== null ? "ready" : "loading",
            });

            void backgroundRefresh(placeId, place);
        },

        openReadOnly: async (formState, options) => {
            cancelAutosave();
            // Fingerprint the loaded state so the guarded autosave (which never
            // runs in read-only anyway) would treat it as already-persisted.
            lastPersistedFingerprint = buildDraftFingerprint(formState);

            set({
                ...INITIAL_STATE,
                placeId: formState.placeId,
                draft: formState,
                readOnly: true,
                loadPhase: "loading",
            });

            let instrument = options?.instrument ?? null;
            if (instrument === null) {
                try {
                    const cached = await readInstrumentCache();
                    if (cached !== null) {
                        instrument = normalizeInstrument(cached);
                    }
                } catch {
                    instrument = null;
                }
            }

            // Abandoned mid-load (viewer closed / switched to another audit).
            if (get().placeId !== formState.placeId || !get().readOnly) {
                return;
            }

            if (instrument !== null) {
                set({ instrument, loadPhase: "ready" });
                return;
            }

            // No cached instrument: fetch it once if online, else surface the same
            // "survey not cached" error the edit path uses. No draft/remote merge.
            if (!useYeeMobileStore.getState().isOnline) {
                set({ loadPhase: "error", errorMessage: SURVEY_NOT_CACHED_MESSAGE });
                return;
            }
            try {
                const payload = await fetchYeeInstrument();
                await writeInstrumentCache(payload);
                if (get().placeId === formState.placeId && get().readOnly) {
                    set({ instrument: normalizeInstrument(payload), loadPhase: "ready" });
                }
            } catch {
                if (get().placeId === formState.placeId && get().readOnly) {
                    set({ loadPhase: "error", errorMessage: SURVEY_LOAD_FAILED_MESSAGE });
                }
            }
        },

        retryLoad: async () => {
            const placeId = get().placeId;
            if (placeId === null) {
                return;
            }
            const place =
                useYeeMobileStore.getState().assignedPlaces.find((entry) => entry.id === placeId) ??
                null;
            set({ loadPhase: get().instrument === null ? "loading" : "ready", errorMessage: null });
            await backgroundRefresh(placeId, place);
        },

        close: () => {
            cancelAutosave();
            // Flush any unpersisted local edits before tearing down so an exit that
            // skipped Save & Exit never loses work. Fire-and-forget against the
            // captured draft — independent of the store reset below. View-only
            // sessions never flush (nothing was edited).
            const { draft, hasLocalEdits, readOnly } = get();
            if (
                !readOnly &&
                draft !== null &&
                hasLocalEdits &&
                buildDraftFingerprint(draft) !== lastPersistedFingerprint
            ) {
                void autosavePersistLocal(draft);
            }
            lastPersistedFingerprint = null;
            set({ ...INITIAL_STATE });
        },

        setStep: (step) => {
            if (get().step !== step) {
                set({ step });
            }
        },

        setVisitFrequency: (value) =>
            patchDraft((draft) =>
                draft.visitFrequency === value ? draft : { ...draft, visitFrequency: value },
            ),
        setPublicAccess: (value) =>
            patchDraft((draft) =>
                draft.publicAccess === value ? draft : { ...draft, publicAccess: value },
            ),
        setOpenHoursAccess: (value) =>
            patchDraft((draft) =>
                draft.openHoursAccess === value ? draft : { ...draft, openHoursAccess: value },
            ),
        setSeason: (value) =>
            patchDraft((draft) => (draft.season === value ? draft : { ...draft, season: value })),
        toggleWeather: (value) =>
            patchDraft((draft) => {
                const exists = draft.weather.includes(value);
                return {
                    ...draft,
                    weather: exists
                        ? draft.weather.filter((entry) => entry !== value)
                        : [...draft.weather, value],
                };
            }),

        setWeight: (domain, value) =>
            patchDraft((draft) =>
                draft.weights[domain] === value
                    ? draft
                    : { ...draft, weights: { ...draft.weights, [domain]: value } },
            ),
        setWeightingComments: (value) =>
            patchDraft((draft) =>
                draft.weightingComments === value ? draft : { ...draft, weightingComments: value },
            ),

        // Preserves the "clear the condition follow-up when presence turns
        // negative" rule from the old inline OptionGrid handler exactly.
        setPresenceAnswer: (row, answerId) =>
            patchDraft((draft) => {
                const clearsCondition =
                    row.conditionItemId !== null &&
                    !isAffirmativeAnswer(row.presenceAnswers, answerId);
                return {
                    ...draft,
                    responses: {
                        ...draft.responses,
                        [row.presenceItemId]: {
                            ...(draft.responses[row.presenceItemId] ?? {}),
                            [row.choiceId]: answerId,
                        },
                        ...(clearsCondition && row.conditionItemId !== null
                            ? {
                                  [row.conditionItemId]: {
                                      ...(draft.responses[row.conditionItemId] ?? {}),
                                      [row.choiceId]: "",
                                  },
                              }
                            : {}),
                    },
                };
            }),
        setConditionAnswer: (row, answerId) =>
            patchDraft((draft) => {
                if (row.conditionItemId === null) {
                    return draft;
                }
                return {
                    ...draft,
                    responses: {
                        ...draft.responses,
                        [row.conditionItemId]: {
                            ...(draft.responses[row.conditionItemId] ?? {}),
                            [row.choiceId]: answerId,
                        },
                    },
                };
            }),

        setSectionComment: (domain, value) =>
            patchDraft((draft) =>
                draft.sectionComments[domain] === value
                    ? draft
                    : { ...draft, sectionComments: { ...draft.sectionComments, [domain]: value } },
            ),
        setComments: (value) =>
            patchDraft((draft) =>
                draft.comments === value ? draft : { ...draft, comments: value },
            ),

        commitManual: async () => {
            cancelAutosave();
            const current = get().draft;
            if (current === null) {
                return;
            }
            const draft = withUpdatedTiming(current);
            set({ draft, saveStatus: "saving" });
            await manualPersist(draft, set);
        },
    };
});

// ---------------------------------------------------------------------------
// Persist pipeline (offline-first — DO NOT change the ordering)
//
// Local MMKV draft is the SOURCE OF TRUTH. Every path commits it durably BEFORE
// any network work, mirroring lib/yee-mobile-store's local_only / pending_upload
// / synced transitions. Ported from the old per-step screen so recovery
// semantics are byte-for-byte identical.
// ---------------------------------------------------------------------------

type StoreSet = (partial: Partial<AuditSessionState>) => void;

/** Autosave commit: local-only, no network, no queue. */
async function autosavePersistLocal(draft: MobileAuditFormState): Promise<void> {
    const mobileStore = useYeeMobileStore.getState();
    const previousDraft = mobileStore.draftsByPlace[draft.placeId] ?? null;
    const stored = buildStoredDraft(
        draft,
        previousDraft,
        previousDraft?.scorePreview ?? null,
        "local_only",
    );
    await mobileStore.saveDraftLocally({ ...stored, syncState: "local_only" });
    lastPersistedFingerprint = buildDraftFingerprint(draft);
}

async function manualPersist(draft: MobileAuditFormState, set: StoreSet): Promise<void> {
    const session = useAuthStore.getState().session;
    const mobileStore = useYeeMobileStore.getState();
    const isOnline = mobileStore.isOnline;
    const previousDraft = mobileStore.draftsByPlace[draft.placeId] ?? null;

    const stored = buildStoredDraft(
        draft,
        previousDraft,
        previousDraft?.scorePreview ?? null,
        session === null ? "local_only" : isOnline ? "synced" : "pending_upload",
    );

    // Durable local commit first. Honest state is "pending_upload" only while an
    // online manual save is about to attempt the remote mirror; otherwise local.
    await mobileStore.saveDraftLocally({
        ...stored,
        syncState: session !== null && isOnline ? "pending_upload" : "local_only",
    });
    lastPersistedFingerprint = buildDraftFingerprint(draft);

    if (session === null) {
        set({ saveStatus: "saved", lastSavedAt: new Date().toISOString() });
        return;
    }

    if (!isOnline) {
        await mobileStore.queueDraftSync({ ...stored, syncState: "pending_upload" });
        set({ saveStatus: "queued", lastSavedAt: new Date().toISOString() });
        return;
    }

    // Remote draft save is OPTIONAL legacy sync (the web mirror). It never blocks
    // local recovery: the local draft is already durably committed above, so a
    // failure here merely queues a best-effort retry.
    try {
        const savedState = await saveAuditDraft(draft.placeId, session, {
            participant_info: buildParticipantInfo(draft),
            responses: draft.responses,
        });
        await mobileStore.saveDraftLocally({
            ...stored,
            syncState: "synced",
            scorePreview: savedState.score,
            lastKnownBackendStatus: savedState.status,
            lastKnownSubmissionId: savedState.submission_id,
        });
        set({ saveStatus: "saved", lastSavedAt: new Date().toISOString() });
    } catch (error) {
        await mobileStore.queueDraftSync({ ...stored, syncState: "pending_upload" });
        set({
            saveStatus: "queued",
            lastSavedAt: new Date().toISOString(),
            errorMessage:
                error instanceof Error ? error.message : "Draft saved locally and queued for sync.",
        });
    }
}

/**
 * Background, non-blocking refresh after the shell has already painted from
 * cache. Refreshes the instrument, then the remote audit state — but only merges
 * the remote draft when the auditor has NOT started editing, so unsaved work is
 * never clobbered.
 */
async function backgroundRefresh(placeId: string, place: YeeAssignedPlace | null): Promise<void> {
    const set = useAuditSessionStore.setState;
    const get = useAuditSessionStore.getState;

    try {
        const payload = await fetchYeeInstrument();
        const normalized = normalizeInstrument(payload);
        await writeInstrumentCache(payload);
        if (get().placeId === placeId) {
            set((state) => {
                const nowReady = state.loadPhase === "loading" || state.loadPhase === "error";
                return {
                    instrument: normalized,
                    loadPhase: nowReady ? "ready" : state.loadPhase,
                    errorMessage: nowReady ? null : state.errorMessage,
                    step:
                        nowReady && state.draft !== null
                            ? (findFirstIncompleteStep(state.draft, normalized)?.step ?? state.step)
                            : state.step,
                };
            });
        }
    } catch {
        if (get().placeId === placeId && get().instrument === null) {
            set({ loadPhase: "error", errorMessage: SURVEY_LOAD_FAILED_MESSAGE });
            return;
        }
    }

    const session = useAuthStore.getState().session;
    const isOnline = useYeeMobileStore.getState().isOnline;
    if (session === null || !isOnline) {
        return;
    }

    const remoteState = await useYeeMobileStore
        .getState()
        .loadPlaceAuditState(placeId, session)
        .catch(() => null);

    if (remoteState === null || get().placeId !== placeId || get().hasLocalEdits) {
        return;
    }

    const storedDraft = useYeeMobileStore.getState().draftsByPlace[placeId] ?? null;
    const merged = buildFormStateFromSources({
        placeId,
        placeName: resolvePlaceName(place, storedDraft),
        auditorId: resolveAuditorId(storedDraft),
        storedDraft,
        auditState: remoteState,
    });
    lastPersistedFingerprint = buildDraftFingerprint(merged);
    set({ draft: merged });
}

// ---------------------------------------------------------------------------
// Centralized autosave — one debounced subscription for the whole audit.
// ---------------------------------------------------------------------------

useAuditSessionStore.subscribe((state, previousState) => {
    // View-only sessions never persist.
    if (state.readOnly) {
        return;
    }
    if (state.draft === null || state.loadPhase !== "ready") {
        return;
    }
    // Only react to genuine draft edits (identity change), not step / status.
    if (state.draft === previousState.draft) {
        return;
    }

    cancelAutosave();
    autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        const draft = useAuditSessionStore.getState().draft;
        if (draft === null) {
            return;
        }
        if (buildDraftFingerprint(draft) === lastPersistedFingerprint) {
            return;
        }
        useAuditSessionStore.setState({ saveStatus: "saving" });
        void autosavePersistLocal(draft)
            .then(() => {
                useAuditSessionStore.setState({
                    saveStatus: "saved",
                    lastSavedAt: new Date().toISOString(),
                });
            })
            .catch((error: unknown) => {
                useAuditSessionStore.setState({
                    saveStatus: "error",
                    errorMessage:
                        error instanceof Error ? error.message : "Unable to autosave locally.",
                });
            });
    }, 500);
});

// ---------------------------------------------------------------------------
// Timing helpers (ported from the old per-step screen).
// ---------------------------------------------------------------------------

function withUpdatedTiming(draft: MobileAuditFormState): MobileAuditFormState {
    const now = new Date();
    const finishTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
        ...draft,
        finishTime,
        totalMinutes: estimateMinutes(draft.auditDate, draft.startTime, now),
    };
}

function estimateMinutes(auditDate: string, startTime: string, now: Date): number {
    const start = Date.parse(`${auditDate}T${normalizeTime(startTime)}`);
    if (Number.isNaN(start)) {
        return 0;
    }
    return Math.max(0, Math.round((now.getTime() - start) / 60000));
}

function normalizeTime(value: string): string {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) {
        return value;
    }
    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}:00`;
}
