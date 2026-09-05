import { create } from "zustand";
import {
    buildFormStateFromSources,
    buildStoredDraft,
    type MobileAuditFormState,
} from "lib/yee-mobile-draft";
import type { MobileYeeDomainKey, MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import {
    normalizeInstrument,
    type InstrumentLogicalQuestion,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { findFirstIncompleteStep } from "lib/yee-submit-guard";
import { fetchYeeInstrument } from "lib/yee-api";
import { readInstrumentCache, writeInstrumentCache } from "lib/yee-offline-storage";
import type { YeeAssignedPlace, YeeLocalDraft } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const SURVEY_NOT_CACHED_MESSAGE =
    "This device has not cached the full YEE survey instrument yet. Connect once online and refresh the mobile app before starting or continuing this audit offline.";
const SURVEY_LOAD_FAILED_MESSAGE = "Unable to load this audit's survey instrument.";
const SURVEY_VERSION_NOT_CACHED_MESSAGE =
    "This audit's exact survey version is not cached on this device. Connect online before continuing this audit.";

/** First paint state of the active audit. */
export type AuditLoadPhase = "idle" | "loading" | "ready" | "error";
/**
 * Live persistence feedback surfaced by the save-status pill. The vocabulary is
 * deliberately local-first: it separates DEVICE durability (the source of truth)
 * from the best-effort CLOUD mirror, so the auditor is never told "unsaved" when
 * their work is safely on-device.
 *
 * - `idle`        - nothing to report yet.
 * - `saving`      - a local write is genuinely in progress (used sparingly).
 * - `saved_local` - durably saved on this device; no cloud mirror confirmed.
 * - `syncing`     - cloud mirror in flight (device copy already safe).
 * - `synced`      - cloud mirror confirmed.
 * - `queued`      - cloud mirror queued for later (offline or transient retry).
 * - `sync_issue`  - cloud mirror failed; the on-device copy is still intact.
 * - `error`       - a LOCAL write failed (rare; the only genuinely risky state).
 */
export type AuditSaveStatus =
    "idle" | "saving" | "saved_local" | "syncing" | "synced" | "queued" | "sync_issue" | "error";

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
     * flushes - the loaded answers are display-only and must never be written
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

    setParticipantId: (value: string) => void;
    setVisitFrequency: (value: string) => void;
    setPublicAccess: (value: string) => void;
    setOpenHoursAccess: (value: string) => void;
    setSeason: (value: string) => void;
    toggleWeather: (value: string) => void;

    setWeight: (domain: MobileYeeDomainKey, value: string) => void;
    setWeightingComments: (value: string) => void;

    setPresenceAnswer: (question: InstrumentLogicalQuestion, answerId: string) => void;
    setConditionAnswer: (question: InstrumentLogicalQuestion, answerId: string) => void;

    setSectionComment: (domain: MobileYeeDomainKey, value: string) => void;
    setComments: (value: string) => void;

    /**
     * Durable LOCAL-only commit: writes the draft to MMKV (source of truth) with
     * no network and no queue work. Used by the debounced autosave. Navigation
     * never calls this directly - it uses {@link commitAndQueueRemote}.
     */
    commitLocalOnly: () => Promise<void>;
    /**
     * Navigation commit. Awaits the durable LOCAL write only, then fire-and-forgets
     * the best-effort remote draft mirror (one `draft-${placeId}` queue item,
     * drained in the background). Used by Next, Home, Save & Exit, review entry,
     * app-background, and reconnect. Never blocks the caller on the network.
     */
    commitAndQueueRemote: () => Promise<void>;
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

// ---------------------------------------------------------------------------
// Dirty tracking - a monotonic revision counter replaces the old whole-draft
// JSON.stringify() fingerprint. Every real in-memory edit bumps `draftRevision`
// (O(1)); `lastPersistedRevision` records the revision last durably written to
// MMKV. Autosave/commit/close compare the two numbers instead of serializing the
// entire draft on every answer, which was the per-answer overhead we removed.
// Module refs (not store state) so bumping them never triggers a re-render.
// ---------------------------------------------------------------------------

/** Bumped on every mutation that actually changes the in-memory draft. */
let draftRevision = 0;
/** Revision of the draft last durably committed to MMKV. */
let lastPersistedRevision = 0;
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

function draftInstrumentStamp(
    draft: YeeLocalDraft | MobileAuditFormState | null,
): { readonly instrumentKey: string; readonly instrumentVersion: string } | undefined {
    const instrumentKey = draft?.instrumentKey?.trim() ?? "";
    const instrumentVersion = draft?.instrumentVersion?.trim() ?? "";
    return instrumentKey.length > 0 && instrumentVersion.length > 0
        ? { instrumentKey, instrumentVersion }
        : undefined;
}

function applyInstrumentStamp(
    draft: MobileAuditFormState,
    instrument: NormalizedInstrument | null,
): MobileAuditFormState {
    if (
        instrument === null ||
        instrument.instrumentKey == null ||
        instrument.instrumentVersion == null
    ) {
        return draft;
    }
    return {
        ...draft,
        instrumentKey: instrument.instrumentKey,
        instrumentVersion: instrument.instrumentVersion,
    };
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
            // View-only sessions never mutate the draft - belt-and-suspenders on
            // top of the disabled controls in the step screens.
            if (state.readOnly || state.draft === null) {
                return {};
            }
            const next = mutator(state.draft);
            if (next === state.draft) {
                return {};
            }
            // Real edit: bump the dirty counter so autosave/close know there is
            // unpersisted work without re-serializing the whole draft.
            draftRevision += 1;
            return { draft: next, hasLocalEdits: true };
        });
    }

    return {
        ...INITIAL_STATE,

        open: async (placeId, { place }) => {
            cancelAutosave();
            // Fresh session: both counters at 0 means "the loaded draft is exactly
            // what is on disk", so no spurious autosave fires before the first edit.
            draftRevision = 0;
            lastPersistedRevision = 0;

            const mobileStore = useYeeMobileStore.getState();
            const isOnline = mobileStore.isOnline;
            const storedDraft = mobileStore.draftsByPlace[placeId] ?? null;

            set({
                ...INITIAL_STATE,
                placeId,
                loadPhase: "loading",
            });

            let instrument: NormalizedInstrument | null = null;
            const requestedStamp = draftInstrumentStamp(storedDraft);
            try {
                const cached = await readInstrumentCache(requestedStamp);
                if (cached !== null) {
                    instrument = normalizeInstrument(cached);
                }
            } catch {
                instrument = null;
            }

            // Abandoned mid-load (audit closed / switched) - drop this result.
            if (get().placeId !== placeId) {
                return;
            }

            const draft = applyInstrumentStamp(
                buildFormStateFromSources({
                    placeId,
                    placeName: resolvePlaceName(place, storedDraft),
                    auditorId: resolveAuditorId(storedDraft),
                    storedDraft,
                    auditState: null,
                }),
                instrument,
            );

            if (instrument === null && !isOnline) {
                set({
                    draft,
                    instrument: null,
                    loadPhase: "error",
                    errorMessage:
                        requestedStamp === undefined
                            ? SURVEY_NOT_CACHED_MESSAGE
                            : SURVEY_VERSION_NOT_CACHED_MESSAGE,
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
            // Read-only sessions never persist; reset the counters so a later edit
            // session starts clean.
            draftRevision = 0;
            lastPersistedRevision = 0;

            set({
                ...INITIAL_STATE,
                placeId: formState.placeId,
                draft: formState,
                readOnly: true,
                loadPhase: "loading",
            });

            let instrument = options?.instrument ?? null;
            const requestedStamp = draftInstrumentStamp(formState);
            if (instrument === null) {
                try {
                    const cached = await readInstrumentCache(requestedStamp);
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
                set({
                    loadPhase: "error",
                    errorMessage:
                        requestedStamp === undefined
                            ? SURVEY_NOT_CACHED_MESSAGE
                            : SURVEY_VERSION_NOT_CACHED_MESSAGE,
                });
                return;
            }
            try {
                const payload = await fetchYeeInstrument(requestedStamp);
                await writeInstrumentCache(payload, { asActive: requestedStamp === undefined });
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
            // captured draft - independent of the store reset below. View-only
            // sessions never flush (nothing was edited).
            const { draft, hasLocalEdits, readOnly } = get();
            if (
                !readOnly &&
                draft !== null &&
                hasLocalEdits &&
                draftRevision !== lastPersistedRevision
            ) {
                void autosavePersistLocal(draft, draftRevision);
            }
            draftRevision = 0;
            lastPersistedRevision = 0;
            set({ ...INITIAL_STATE });
        },

        setStep: (step) => {
            if (get().step !== step) {
                set({ step });
            }
        },

        setParticipantId: (value) =>
            patchDraft((draft) =>
                draft.participantId === value ? draft : { ...draft, participantId: value },
            ),
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
        setPresenceAnswer: (question, answerId) =>
            patchDraft((draft) => {
                const clearsCondition =
                    question.conditionItemId !== null &&
                    !question.conditionTriggerAnswerIds.includes(answerId);
                return {
                    ...draft,
                    responses: {
                        ...draft.responses,
                        [question.presenceItemId]: {
                            ...(draft.responses[question.presenceItemId] ?? {}),
                            [question.choiceId]: answerId,
                        },
                        ...(clearsCondition && question.conditionItemId !== null
                            ? {
                                  [question.conditionItemId]: {
                                      ...(draft.responses[question.conditionItemId] ?? {}),
                                      [question.choiceId]: "",
                                  },
                              }
                            : {}),
                    },
                };
            }),
        setConditionAnswer: (question, answerId) =>
            patchDraft((draft) => {
                if (question.conditionItemId === null) {
                    return draft;
                }
                return {
                    ...draft,
                    responses: {
                        ...draft.responses,
                        [question.conditionItemId]: {
                            ...(draft.responses[question.conditionItemId] ?? {}),
                            [question.choiceId]: answerId,
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

        commitLocalOnly: async () => {
            cancelAutosave();
            const { draft, readOnly } = get();
            if (readOnly || draft === null) {
                return;
            }
            // Skip when nothing changed since the last durable write - the whole
            // point of the revision counter (no whole-draft re-serialization).
            if (draftRevision === lastPersistedRevision) {
                return;
            }
            const revisionAtWrite = draftRevision;
            try {
                await autosavePersistLocal(draft, revisionAtWrite);
                set({ saveStatus: "saved_local", lastSavedAt: new Date().toISOString() });
            } catch (error) {
                set({
                    saveStatus: "error",
                    errorMessage:
                        error instanceof Error ? error.message : "Unable to save locally.",
                });
            }
        },

        commitAndQueueRemote: async () => {
            cancelAutosave();
            const { draft: current, readOnly } = get();
            if (readOnly || current === null) {
                return;
            }
            const draft = withUpdatedTiming(current);
            // withUpdatedTiming builds a new object outside patchDraft, so it never
            // bumps draftRevision; the current revision already covers every user
            // edit, and the timing fields are persisted directly below.
            const revisionAtWrite = draftRevision;
            set({ draft });
            await commitAndQueueRemotePersist(draft, revisionAtWrite, set);
        },
    };
});

// ---------------------------------------------------------------------------
// Persist pipeline (offline-first - DO NOT change the ordering)
//
// Local MMKV draft is the SOURCE OF TRUTH. Every path commits it durably BEFORE
// any network work, mirroring lib/yee-mobile-store's local_only / pending_upload
// / synced transitions. Ported from the old per-step screen so recovery
// semantics are byte-for-byte identical.
// ---------------------------------------------------------------------------

type StoreSet = (partial: Partial<AuditSessionState>) => void;

/**
 * Autosave commit: local-only, no network, no queue. Records the revision it
 * persisted (captured by the caller, not read live) so a follow-up edit that
 * lands mid-write stays correctly marked dirty.
 */
async function autosavePersistLocal(draft: MobileAuditFormState, revision: number): Promise<void> {
    const mobileStore = useYeeMobileStore.getState();
    const previousDraft = mobileStore.draftsByPlace[draft.placeId] ?? null;
    const stored = buildStoredDraft(
        draft,
        previousDraft,
        previousDraft?.scorePreview ?? null,
        "local_only",
    );
    await mobileStore.saveDraftLocally({ ...stored, syncState: "local_only" });
    lastPersistedRevision = revision;
}

/**
 * Navigation-time commit: durable LOCAL write first, then enqueue the best-effort
 * remote mirror and drain it in the BACKGROUND. The caller (Next / Home /
 * Save & Exit / review / background / reconnect) only ever awaits the local +
 * enqueue MMKV work - never the network PUT.
 */
async function commitAndQueueRemotePersist(
    draft: MobileAuditFormState,
    revision: number,
    set: StoreSet,
): Promise<void> {
    const session = useAuthStore.getState().session;
    const mobileStore = useYeeMobileStore.getState();
    const isOnline = mobileStore.isOnline;
    const previousDraft = mobileStore.draftsByPlace[draft.placeId] ?? null;

    const localSyncState: YeeLocalDraft["syncState"] =
        session !== null ? "pending_upload" : "local_only";
    const stored = buildStoredDraft(
        draft,
        previousDraft,
        previousDraft?.scorePreview ?? null,
        localSyncState,
    );

    // 1) Durable LOCAL commit FIRST - source of truth, before any network work.
    await mobileStore.saveDraftLocally({ ...stored, syncState: localSyncState });
    lastPersistedRevision = revision;

    const savedAtIso = new Date().toISOString();

    if (session === null) {
        set({ saveStatus: "saved_local", lastSavedAt: savedAtIso });
        return;
    }

    // 2) Enqueue the remote mirror as one deterministic draft-${placeId} item.
    //    This is local MMKV work; awaiting it does NOT touch the network.
    await mobileStore.queueDraftSync({ ...stored, syncState: "pending_upload" });

    if (!isOnline) {
        set({ saveStatus: "queued", lastSavedAt: savedAtIso });
        return;
    }

    // 3) Online: drain in the BACKGROUND. Navigation is already free; the mirror
    //    PUT never gates the caller. Reflect the durable outcome onto the pill.
    set({ saveStatus: "syncing", lastSavedAt: savedAtIso });
    void mobileStore
        .syncPendingQueue(session, { throttle: true })
        .then(() => reflectMirrorStatus(draft.placeId, set))
        .catch(() => {
            const live = useAuditSessionStore.getState();
            if (live.placeId === draft.placeId && !live.readOnly) {
                set({ saveStatus: "queued" });
            }
        });
}

/**
 * Map the durable remote-mirror state of `placeId` onto the save-status pill
 * after a background drain. Reads the mobile store (the source of truth for the
 * queue and draft syncState) instead of tracking transitions imperatively, and
 * ignores drains for a place the auditor already left or reopened read-only.
 */
function reflectMirrorStatus(placeId: string, set: StoreSet): void {
    const live = useAuditSessionStore.getState();
    if (live.placeId !== placeId || live.readOnly) {
        return;
    }
    const mobileStore = useYeeMobileStore.getState();
    const queueItem = mobileStore.syncQueue.find((item) => item.id === `draft-${placeId}`) ?? null;

    if (queueItem === null) {
        // Drained and removed: the mirror PUT landed (or there was nothing to do).
        const draft = mobileStore.draftsByPlace[placeId] ?? null;
        set({ saveStatus: draft?.syncState === "synced" ? "synced" : "saved_local" });
        return;
    }
    if (queueItem.failureReason === "terminal" || queueItem.failureReason === "validation") {
        set({ saveStatus: "sync_issue" });
        return;
    }
    // Retained for a later retry (offline blip, transient failure, or auth pause).
    set({ saveStatus: "queued" });
}

/**
 * Background, non-blocking refresh after the shell has already painted from
 * cache. Refreshes the instrument, then the remote audit state - but only merges
 * the remote draft when the auditor has NOT started editing, so unsaved work is
 * never clobbered.
 */
async function backgroundRefresh(placeId: string, place: YeeAssignedPlace | null): Promise<void> {
    const set = useAuditSessionStore.setState;
    const get = useAuditSessionStore.getState;
    const session = useAuthStore.getState().session;
    const isOnline = useYeeMobileStore.getState().isOnline;
    if (session === null || !isOnline) {
        return;
    }

    const remoteState = await useYeeMobileStore
        .getState()
        .loadPlaceAuditState(placeId, session)
        .catch(() => null);
    const mobileStore = useYeeMobileStore.getState();
    const storedDraft = mobileStore.draftsByPlace[placeId] ?? null;
    const requestedStamp =
        remoteState?.instrument_key && remoteState.instrument_version
            ? {
                  instrumentKey: remoteState.instrument_key,
                  instrumentVersion: remoteState.instrument_version,
              }
            : draftInstrumentStamp(storedDraft);

    try {
        const payload = await fetchYeeInstrument(requestedStamp);
        const normalized = normalizeInstrument(payload);
        await writeInstrumentCache(payload, { asActive: requestedStamp === undefined });
        if (get().placeId === placeId) {
            set((state) => {
                const nowReady = state.loadPhase === "loading" || state.loadPhase === "error";
                return {
                    instrument: normalized,
                    draft:
                        state.draft === null ? null : applyInstrumentStamp(state.draft, normalized),
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

    // Local truth wins: never hydrate the remote draft over in-progress edits or
    // work still waiting in the sync queue. loadPlaceAuditState applies the same
    // guard to MMKV; this guards the in-memory session on top of it.
    const hasPendingQueueItem = mobileStore.syncQueue.some((item) => item.placeId === placeId);
    if (
        remoteState === null ||
        get().placeId !== placeId ||
        get().hasLocalEdits ||
        hasPendingQueueItem
    ) {
        return;
    }

    const merged = buildFormStateFromSources({
        placeId,
        placeName: resolvePlaceName(place, storedDraft),
        auditorId: resolveAuditorId(storedDraft),
        storedDraft,
        auditState: remoteState,
    });
    // The merged draft mirrors what was just written to MMKV: nothing dirty.
    lastPersistedRevision = draftRevision;
    set({ draft: merged });
}

// ---------------------------------------------------------------------------
// Centralized autosave - one debounced subscription for the whole audit.
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
        // Durable LOCAL-only write. commitLocalOnly is a no-op when nothing has
        // changed since the last persist (revision guard) and sets the pill to
        // "saved_local" on success - no per-tap spinner flicker.
        void useAuditSessionStore.getState().commitLocalOnly();
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
