import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import type { AuthSession } from "lib/auth/types";
import {
    YeeMobileApiError,
    fetchAssignedPlaces,
    fetchAuditState,
    fetchYeeInstrument,
    fetchMyAudits,
    saveAuditDraft,
    submitAudit,
} from "lib/yee-api";
import { buildIdempotencyKey } from "lib/yee-id";
import { normalizeInstrument } from "lib/yee-mobile-instrument";
import {
    type QueuedSubmissionGate,
    gateQueuedSubmission,
    toAuditResponses,
} from "lib/yee-queued-submission-gate";
import {
    classifyError,
    decideNextQueueState,
    parseIncompleteAuditResponses,
    selectDrainableItems,
} from "lib/yee-sync-logic";
import {
    deleteDraft,
    readAssignedPlacesCache,
    readDraft,
    readDraftMap,
    readInstrumentCache,
    readOfflineMetadata,
    readSubmittedAuditsCache,
    readSyncQueue,
    removeSyncQueueItem,
    upsertSyncQueueItem,
    writeAssignedPlacesCache,
    writeDraft,
    writeInstrumentCache,
    writeOfflineMetadata,
    writeSubmittedAuditsCache,
} from "lib/yee-offline-storage";
import {
    YEE_DRAFT_SCHEMA_VERSION,
    YEE_SYNC_MAX_ATTEMPTS,
    type YeeAssignedPlace,
    type YeeAuditStateResponse,
    type YeeAuditWorkflowStatus,
    type YeeLocalDraft,
    type YeeMyAuditItem,
    type YeeSubmissionResponse,
    type YeeSyncQueueItem,
} from "lib/yee-types";

export type YeeMobileStoreStatus = "idle" | "loading" | "ready" | "error";

/**
 * Serializes ALL queue mutations (enqueue + drain) so they never interleave.
 *
 * Every queue-touching operation chains onto this promise, guaranteeing a single
 * logical writer at a time. Combined with the per-key MMKV substrate (one key
 * per item id) this removes the read-modify-write race the old whole-array
 * AsyncStorage queue had. The chain swallows errors so one failed operation
 * cannot poison subsequent ones.
 */
let queueMutationChain: Promise<void> = Promise.resolve();

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = queueMutationChain.then(operation);
    // Keep the chain alive even if `operation` rejects.
    queueMutationChain = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}

/**
 * Single-flight guard for {@link YeeMobileStoreState.syncPendingQueue}.
 *
 * A drain in progress returns the SAME promise to concurrent callers rather than
 * starting a second overlapping drain (which could double-submit items that are
 * mid-flight). Reset to null in a `finally` so the next trigger starts fresh.
 */
let activeDrain: Promise<void> | null = null;

interface YeeMobileStoreState {
    readonly status: YeeMobileStoreStatus;
    readonly isOnline: boolean;
    readonly assignedPlaces: readonly YeeAssignedPlace[];
    readonly submittedAudits: readonly YeeMyAuditItem[];
    readonly draftsByPlace: Record<string, YeeLocalDraft>;
    readonly syncQueue: readonly YeeSyncQueueItem[];
    readonly errorMessage: string | null;
    readonly lastPlacesSyncAt: string | null;
    readonly lastAuditsSyncAt: string | null;
    readonly lastDraftSyncAt: string | null;
    readonly hasCachedInstrument: boolean;
    readonly hasCachedAssignedPlaces: boolean;
    readonly isOfflineReady: boolean;
    setConnectivityState: (isOnline: boolean) => void;
    hydrateOfflineState: () => Promise<void>;
    refreshRemoteState: (session: AuthSession) => Promise<void>;
    saveDraftLocally: (draft: YeeLocalDraft) => Promise<void>;
    queueDraftSync: (draft: YeeLocalDraft) => Promise<void>;
    queueSubmissionSync: (
        draft: YeeLocalDraft,
        provisionalSubmission?: YeeSubmissionResponse | null,
    ) => Promise<void>;
    syncPendingQueue: (session: AuthSession) => Promise<void>;
    /**
     * Secondary ambiguous-success fallback. When the idempotency-key drain is
     * inconclusive (e.g. timeout with no parsable response), ask the backend
     * directly whether the place is SUBMITTED. If so, resolve the local
     * provisional record (drop the queued submission, mark the summary synced,
     * delete the local draft) so we converge without a duplicate. Returns the
     * resolved workflow status, or `null` if the call could not be completed.
     */
    reconcilePlaceSubmission: (
        placeId: string,
        session: AuthSession,
    ) => Promise<YeeAuditWorkflowStatus | null>;
    loadPlaceAuditState: (placeId: string, session: AuthSession) => Promise<YeeAuditStateResponse>;
    clearError: () => void;
}

export const useYeeMobileStore = create<YeeMobileStoreState>((set, get) => ({
    status: "idle",
    isOnline: true,
    assignedPlaces: [],
    submittedAudits: [],
    draftsByPlace: {},
    syncQueue: [],
    errorMessage: null,
    lastPlacesSyncAt: null,
    lastAuditsSyncAt: null,
    lastDraftSyncAt: null,
    hasCachedInstrument: false,
    hasCachedAssignedPlaces: false,
    isOfflineReady: false,

    setConnectivityState: (isOnline) => {
        set(() => ({ isOnline }));
    },

    hydrateOfflineState: async () => {
        set(() => ({ status: "loading", errorMessage: null }));

        try {
            const [
                netInfo,
                assignedPlaces,
                submittedAudits,
                draftsByPlace,
                syncQueue,
                metadata,
                cachedInstrument,
            ] = await Promise.all([
                NetInfo.fetch(),
                readAssignedPlacesCache(),
                readSubmittedAuditsCache(),
                readDraftMap(),
                readSyncQueue(),
                readOfflineMetadata(),
                readInstrumentCache(),
            ]);
            const hasCachedAssignedPlaces = assignedPlaces.length > 0;
            const hasCachedInstrument = cachedInstrument !== null;

            set(() => ({
                status: "ready",
                isOnline: Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false),
                assignedPlaces,
                submittedAudits,
                draftsByPlace,
                syncQueue,
                lastPlacesSyncAt: metadata.lastPlacesSyncAt,
                lastAuditsSyncAt: metadata.lastAuditsSyncAt,
                lastDraftSyncAt: metadata.lastDraftSyncAt,
                hasCachedAssignedPlaces,
                hasCachedInstrument,
                isOfflineReady: hasCachedAssignedPlaces && hasCachedInstrument,
            }));
        } catch (error) {
            set(() => ({
                status: "error",
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : "Failed to load offline YEE mobile state.",
            }));
        }
    },

    refreshRemoteState: async (session: AuthSession) => {
        set(() => ({ status: "loading", errorMessage: null }));

        try {
            const [netInfo, assignedPlaces, submittedAudits, cachedInstrument] = await Promise.all([
                NetInfo.fetch(),
                fetchAssignedPlaces(session),
                fetchMyAudits(session),
                readInstrumentCache(),
            ]);
            const now = new Date().toISOString();
            let hasCachedInstrument = cachedInstrument !== null;

            if (!hasCachedInstrument) {
                try {
                    const instrument = await fetchYeeInstrument();
                    await writeInstrumentCache(instrument);
                    hasCachedInstrument = true;
                } catch {
                    // keep offline readiness false until instrument can be cached
                }
            }
            const hasCachedAssignedPlaces = assignedPlaces.length > 0;

            await Promise.all([
                writeAssignedPlacesCache(assignedPlaces),
                writeOfflineMetadata({
                    lastPlacesSyncAt: now,
                    lastAuditsSyncAt: now,
                    lastDraftSyncAt: get().lastDraftSyncAt,
                }),
            ]);

            const mergedSubmittedAudits = mergeSubmittedAuditSummaries(
                submittedAudits,
                get().submittedAudits,
            );

            await writeSubmittedAuditsCache(mergedSubmittedAudits);

            set((state) => ({
                status: "ready",
                isOnline: Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false),
                assignedPlaces,
                submittedAudits: mergedSubmittedAudits,
                lastPlacesSyncAt: now,
                lastAuditsSyncAt: now,
                draftsByPlace: state.draftsByPlace,
                syncQueue: state.syncQueue,
                hasCachedAssignedPlaces,
                hasCachedInstrument,
                isOfflineReady: hasCachedAssignedPlaces && hasCachedInstrument,
            }));
        } catch (error) {
            set(() => ({
                status: "error",
                errorMessage:
                    error instanceof Error ? error.message : "Failed to refresh YEE mobile data.",
            }));
        }
    },

    saveDraftLocally: async (draft: YeeLocalDraft) => {
        const savedAt = new Date().toISOString();
        await writeDraft(draft);
        const currentMetadata = await readOfflineMetadata();
        await writeOfflineMetadata({
            ...currentMetadata,
            lastDraftSyncAt: savedAt,
        });
        set((state) => ({
            draftsByPlace: {
                ...state.draftsByPlace,
                [draft.placeId]: draft,
            },
            lastDraftSyncAt: savedAt,
        }));
    },

    queueDraftSync: async (draft: YeeLocalDraft) => {
        await runSerialized(async () => {
            const now = new Date().toISOString();
            const itemId = `draft-${draft.placeId}`;
            // Preserve an existing item's attempt/backoff bookkeeping on re-enqueue
            // so a fresh draft edit does not silently reset a failing item.
            const existing = get().syncQueue.find((entry) => entry.id === itemId) ?? null;
            const queueItem: YeeSyncQueueItem = {
                id: itemId,
                placeId: draft.placeId,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                kind: "draft_save",
                payload: {
                    participant_info: draft.participantInfo,
                    responses: draft.responses,
                    // Stamp the local revision this payload carries. The drain uses
                    // it to avoid marking a NEWER local edit as synced off the back
                    // of this (older) mirror PUT — the stale-draft guard.
                    draft_version: draft.version,
                    ...(draft.instrumentKey ? { instrument_key: draft.instrumentKey } : {}),
                    ...(draft.instrumentVersion
                        ? { instrument_version: draft.instrumentVersion }
                        : {}),
                },
                attempts: existing?.attempts ?? 0,
                lastError: existing?.lastError ?? null,
                nextAttemptAtIso: existing?.nextAttemptAtIso ?? null,
                maxAttempts: existing?.maxAttempts ?? YEE_SYNC_MAX_ATTEMPTS,
                failureReason: existing?.failureReason ?? null,
            };

            await upsertSyncQueueItem(queueItem);
            await writeDraft({
                ...draft,
                syncState: "pending_upload",
            });

            set((state) => ({
                draftsByPlace: {
                    ...state.draftsByPlace,
                    [draft.placeId]: {
                        ...draft,
                        syncState: "pending_upload",
                    },
                },
                syncQueue: upsertLocalQueue(state.syncQueue, queueItem),
            }));
        });
    },

    queueSubmissionSync: async (draft: YeeLocalDraft, provisionalSubmission = null) => {
        await runSerialized(async () => {
            await queueSubmissionInternal(draft, provisionalSubmission, get, set);
        });
    },

    syncPendingQueue: async (session: AuthSession) => {
        // Single-flight: a drain already in progress is shared with the caller
        // rather than starting a second overlapping pass that could double-submit
        // an in-flight item.
        if (activeDrain !== null) {
            return activeDrain;
        }

        const drain = runSerialized(() => drainQueue(session, get, set)).finally(() => {
            activeDrain = null;
        });
        activeDrain = drain;
        return drain;
    },

    reconcilePlaceSubmission: async (placeId: string, session: AuthSession) => {
        let auditState: YeeAuditStateResponse;
        try {
            auditState = await fetchAuditState(placeId, session);
        } catch {
            // Inconclusive: cannot reach the backend to confirm. Leave the queued
            // item in place; the next drain (with the same idempotency key) will
            // converge once connectivity returns.
            return null;
        }

        if (auditState.status !== "SUBMITTED") {
            return auditState.status;
        }

        // Backend confirms the audit landed. Resolve the local provisional record
        // through the serialized writer so it cannot race a concurrent drain.
        await runSerialized(async () => {
            const queuedSubmission =
                get().syncQueue.find(
                    (item) => item.kind === "submission" && item.placeId === placeId,
                ) ?? null;

            if (queuedSubmission !== null) {
                await removeSyncQueueItem(queuedSubmission.id);
            }
            await deleteDraft(placeId);

            set((state) => {
                const nextDraftsByPlace = { ...state.draftsByPlace };
                delete nextDraftsByPlace[placeId];
                return {
                    syncQueue: state.syncQueue.filter(
                        (item) => queuedSubmission === null || item.id !== queuedSubmission.id,
                    ),
                    draftsByPlace: nextDraftsByPlace,
                };
            });
        });

        // Pull the authoritative submitted summary so the local provisional id is
        // replaced by the real synced record.
        try {
            const submittedAudits = await fetchMyAudits(session);
            const mergedSubmittedAudits = mergeSubmittedAuditSummaries(
                submittedAudits,
                get().submittedAudits.filter((audit) => audit.place_id !== placeId),
            );
            await writeSubmittedAuditsCache(mergedSubmittedAudits);
            set(() => ({
                submittedAudits: mergedSubmittedAudits,
                lastAuditsSyncAt: new Date().toISOString(),
            }));
        } catch {
            // The reconciliation already removed the queued item; a failed refresh
            // just leaves the synced summary to be filled on the next refresh.
        }

        return "SUBMITTED";
    },

    loadPlaceAuditState: async (placeId: string, session: AuthSession) => {
        const state = await fetchAuditState(placeId, session);

        if (state.status === "DRAFT") {
            const previousDraft = get().draftsByPlace[placeId] ?? null;
            const hasPendingQueueItem = get().syncQueue.some((item) => item.placeId === placeId);

            // Protect local truth: the remote DRAFT is only a mirror. Hydrate it
            // into local storage ONLY when there is nothing unsynced to clobber —
            // no local draft, or a fully `synced` one with no pending queue item.
            // Any local-only / pending / failed draft, or a queued mirror/submit,
            // means the device holds newer work that must win.
            const localHasUnsyncedWork =
                previousDraft !== null &&
                (previousDraft.syncState !== "synced" || hasPendingQueueItem);
            if (localHasUnsyncedWork) {
                return state;
            }

            const nowIso = new Date().toISOString();
            const localDraft: YeeLocalDraft = {
                id: previousDraft?.id ?? placeId,
                schemaVersion: YEE_DRAFT_SCHEMA_VERSION,
                version: (previousDraft?.version ?? 0) + 1,
                placeId,
                instrumentKey: state.instrument_key ?? null,
                instrumentVersion: state.instrument_version ?? null,
                updatedAt: nowIso,
                lastUpdatedIso: nowIso,
                participantInfo: state.participant_info,
                responses: state.responses,
                lastKnownBackendStatus: state.status,
                lastKnownSubmissionId: state.submission_id,
                scorePreview: state.score,
                syncState: "synced",
            };
            await writeDraft(localDraft);
            set((currentState) => ({
                draftsByPlace: {
                    ...currentState.draftsByPlace,
                    [placeId]: localDraft,
                },
            }));
        }

        return state;
    },

    clearError: () => {
        set(() => ({ errorMessage: null }));
    },
}));

function upsertLocalQueue(
    queue: readonly YeeSyncQueueItem[],
    item: YeeSyncQueueItem,
): readonly YeeSyncQueueItem[] {
    const index = queue.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
        return [...queue, item];
    }

    const nextQueue = [...queue];
    nextQueue[index] = item;
    return nextQueue;
}

function mergeSubmittedAuditSummaries(
    remoteAudits: readonly YeeMyAuditItem[],
    existingAudits: readonly YeeMyAuditItem[],
): readonly YeeMyAuditItem[] {
    const normalizedRemoteAudits = remoteAudits.map((audit) => ({
        ...audit,
        syncState: "synced" as const,
    }));
    const pendingLocalAudits = existingAudits.filter(
        (audit) => audit.syncState === "pending_upload" || audit.syncState === "sync_failed",
    );

    return [
        ...normalizedRemoteAudits,
        ...pendingLocalAudits.filter(
            (localAudit) =>
                !normalizedRemoteAudits.some(
                    (remoteAudit) =>
                        remoteAudit.id === localAudit.id ||
                        remoteAudit.place_id === localAudit.place_id,
                ),
        ),
    ].sort((left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at));
}

// ---------------------------------------------------------------------------
// Queue helpers (serialized — only ever invoked inside runSerialized)
// ---------------------------------------------------------------------------

type StoreGet = () => YeeMobileStoreState;
type StoreSet = (
    partial:
        | Partial<YeeMobileStoreState>
        | ((state: YeeMobileStoreState) => Partial<YeeMobileStoreState>),
) => void;

/**
 * Enqueue (or idempotently re-enqueue) a submission.
 *
 * The `idempotency_key` is generated ONCE on first enqueue and preserved on every
 * subsequent re-enqueue for the same `submission-${placeId}` id, so a duplicate
 * submit tap reuses the same key and the backend de-dupes. `draft_version`
 * captures the local draft revision at enqueue time to guard later deletion.
 */
async function queueSubmissionInternal(
    draft: YeeLocalDraft,
    provisionalSubmission: YeeSubmissionResponse | null,
    get: StoreGet,
    set: StoreSet,
): Promise<void> {
    const now = new Date().toISOString();
    const itemId = `submission-${draft.placeId}`;
    const existing = get().syncQueue.find((entry) => entry.id === itemId) ?? null;
    const idempotencyKey = existing?.payload.idempotency_key ?? buildIdempotencyKey(draft.placeId);

    const queueItem: YeeSyncQueueItem = {
        id: itemId,
        placeId: draft.placeId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        kind: "submission",
        payload: {
            place_id: draft.placeId,
            participant_info: draft.participantInfo,
            responses: draft.responses,
            idempotency_key: idempotencyKey,
            draft_version: draft.version,
            ...(draft.instrumentKey ? { instrument_key: draft.instrumentKey } : {}),
            ...(draft.instrumentVersion ? { instrument_version: draft.instrumentVersion } : {}),
            ...(existing?.payload.provisional_submission_id
                ? { provisional_submission_id: existing.payload.provisional_submission_id }
                : {}),
            ...(provisionalSubmission?.id
                ? { provisional_submission_id: provisionalSubmission.id }
                : {}),
        },
        // Preserve attempt/backoff bookkeeping so a re-enqueue (e.g. user edits
        // then re-submits) does not silently reset a failing item's schedule.
        attempts: existing?.attempts ?? 0,
        lastError: existing?.lastError ?? null,
        nextAttemptAtIso: existing?.nextAttemptAtIso ?? null,
        maxAttempts: existing?.maxAttempts ?? YEE_SYNC_MAX_ATTEMPTS,
        failureReason: existing?.failureReason ?? null,
    };

    // Once a submission is queued, the final submit is authoritative for this
    // place. Drop any pending draft mirror (`draft-${placeId}`) so an optional
    // draft PUT can neither run after nor compete with the submission — this is
    // serialized with the drain, so no draft_save can be mid-flight here.
    const draftMirrorId = `draft-${draft.placeId}`;
    const pendingDraftMirror = get().syncQueue.find((entry) => entry.id === draftMirrorId) ?? null;
    if (pendingDraftMirror !== null) {
        await removeSyncQueueItem(draftMirrorId);
    }

    await upsertSyncQueueItem(queueItem);
    await writeDraft({
        ...draft,
        syncState: "pending_upload",
    });

    const nextLocalSummary =
        provisionalSubmission === null
            ? null
            : {
                  id: provisionalSubmission.id,
                  place_id: provisionalSubmission.place_id,
                  place_name: provisionalSubmission.place_name ?? provisionalSubmission.place_id,
                  submitted_at: provisionalSubmission.submitted_at,
                  total_score: provisionalSubmission.score.total_score,
                  instrument_key:
                      provisionalSubmission.instrument_key ?? draft.instrumentKey ?? null,
                  instrument_version:
                      provisionalSubmission.instrument_version ?? draft.instrumentVersion ?? null,
                  syncState: "pending_upload" as const,
              };

    set((state) => {
        const nextSubmittedAudits =
            nextLocalSummary === null
                ? state.submittedAudits
                : [
                      ...state.submittedAudits.filter((audit) => audit.id !== nextLocalSummary.id),
                      nextLocalSummary,
                  ].sort(
                      (left, right) =>
                          Date.parse(right.submitted_at) - Date.parse(left.submitted_at),
                  );

        void writeSubmittedAuditsCache(nextSubmittedAudits);

        return {
            draftsByPlace: {
                ...state.draftsByPlace,
                [draft.placeId]: {
                    ...draft,
                    syncState: "pending_upload",
                },
            },
            syncQueue: upsertLocalQueue(
                state.syncQueue.filter((entry) => entry.id !== draftMirrorId),
                queueItem,
            ),
            submittedAudits: nextSubmittedAudits,
        };
    });
}

/**
 * Read the HTTP status from a thrown error for classification. A non-API error
 * (no statusCode) is treated as a transport failure (0 -> retryable).
 */
function statusCodeFromError(error: unknown): number {
    if (error instanceof YeeMobileApiError) {
        return error.statusCode;
    }
    return 0;
}

/** Shown when an audit cannot be sent until its missing answers are filled in. */
const INCOMPLETE_SUBMISSION_MESSAGE = "This audit still needs a few answers before it can be sent.";

/** Shown when the questions an audit was completed with are not on this device. */
const UNRESOLVED_INSTRUMENT_MESSAGE =
    "Reconnect once to download the questions this audit was completed with, then it will send.";

/**
 * The instrument a queued submission must be judged against, from local cache.
 *
 * A payload carrying a stamp resolves to that EXACT version or to nothing —
 * never to whatever is active now, which would judge an audit against a
 * contract it was never taken under. A payload carrying no stamp at all
 * predates stamping, so it is checked against the cached active instrument only
 * while that instrument is still schema-v1: the frozen contract those payloads
 * were authored under. Once a v2 instrument is active it can no longer speak
 * for them, and the gate falls back to the backend's unstamped resolution.
 */
async function readInstrumentForQueuedItem(
    stampKey: string,
    stampVersion: string,
): Promise<ReturnType<typeof normalizeInstrument> | null> {
    try {
        if (stampKey === "" && stampVersion === "") {
            const active = await readInstrumentCache();
            if (active === null || (active.authoring ?? null) !== null) {
                return null;
            }
            return normalizeInstrument(active);
        }
        if (stampKey === "" || stampVersion === "") {
            // Half a stamp names no version, so there is nothing to look up.
            return null;
        }
        const exact = await readInstrumentCache({
            instrumentKey: stampKey,
            instrumentVersion: stampVersion,
        });
        return exact === null ? null : normalizeInstrument(exact);
    } catch {
        // An unreadable cache is the same as an absent one, and the gate already
        // treats that safely: a stamped item is retained, an unstamped legacy
        // item is sent for the backend to resolve.
        return null;
    }
}

/** Whether a queued submission may be POSTed, decided from local state alone. */
async function resolveQueuedSubmissionGate(item: YeeSyncQueueItem): Promise<QueuedSubmissionGate> {
    const stampKey = (item.payload.instrument_key ?? "").trim();
    const stampVersion = (item.payload.instrument_version ?? "").trim();
    return gateQueuedSubmission({
        stampKey,
        stampVersion,
        instrument: await readInstrumentForQueuedItem(stampKey, stampVersion),
        responses: toAuditResponses(item.payload.responses),
    });
}

/**
 * Record a gate decision that stopped a submission before it was sent.
 *
 * Neither branch burns an attempt: no request was made, so counting one would
 * push an item toward the terminal cap for something it cannot influence.
 */
async function applyQueuedSubmissionGate(
    item: YeeSyncQueueItem,
    gate: Exclude<QueuedSubmissionGate, { readonly outcome: "submit" }>,
    set: StoreSet,
): Promise<void> {
    if (gate.outcome === "retain_unresolved_instrument") {
        // Nothing failed and nothing is lost. The payload and its stamp stay
        // queued exactly as they are until that version is cached again, so this
        // is a message rather than a persisted failure.
        set(() => ({ errorMessage: UNRESOLVED_INSTRUMENT_MESSAGE }));
        return;
    }

    const parkedItem: YeeSyncQueueItem = {
        ...item,
        updatedAt: new Date().toISOString(),
        lastError: INCOMPLETE_SUBMISSION_MESSAGE,
        nextAttemptAtIso: null,
        failureReason: "incomplete",
        isTerminal: true,
        incompleteQuestionKeys: {
            missingQuestionKeys: gate.incomplete.missingQuestionKeys,
            firstMissingStep: gate.incomplete.firstMissingStep,
        },
    };
    await upsertSyncQueueItem(parkedItem);
    set((state) => ({
        syncQueue: upsertLocalQueue(state.syncQueue, parkedItem),
        draftsByPlace: stampDraftSyncState(state.draftsByPlace, parkedItem.placeId, "sync_failed"),
        errorMessage: INCOMPLETE_SUBMISSION_MESSAGE,
    }));
}

/**
 * Drain the pending queue once. Serialized by the caller; respects per-item
 * backoff windows, pauses on auth failure without burning an attempt, and parks
 * terminally-failed items as `sync_failed`. Uses the pure logic in
 * lib/yee-sync-logic.ts for every retry decision.
 */
async function drainQueue(session: AuthSession, get: StoreGet, set: StoreSet): Promise<void> {
    const nowIso = new Date().toISOString();
    const drainable = selectDrainableItems(get().syncQueue, nowIso);
    if (drainable.length === 0) {
        return;
    }

    set(() => ({ errorMessage: null }));
    let auditListNeedsRefresh = false;

    for (const item of drainable) {
        // The queue may have been re-driven between iterations; re-read the live
        // item so we never act on a stale snapshot.
        const liveItem = get().syncQueue.find((entry) => entry.id === item.id) ?? null;
        if (liveItem === null) {
            continue;
        }

        // Decide locally, before any network call, whether this submission may
        // go at all. A payload the backend would reject for missing answers is
        // parked here instead of being POSTed and rejected.
        if (liveItem.kind === "submission") {
            const gate = await resolveQueuedSubmissionGate(liveItem);
            if (gate.outcome !== "submit") {
                await applyQueuedSubmissionGate(liveItem, gate, set);
                continue;
            }
        }

        try {
            let syncedDraft: YeeLocalDraft | null = null;
            if (liveItem.kind === "draft_save") {
                syncedDraft = await drainDraftSave(liveItem, session, get);
            } else {
                auditListNeedsRefresh = true;
                await drainSubmission(liveItem, session, get, set);
            }

            await removeSyncQueueItem(liveItem.id);
            const syncedAt = new Date().toISOString();
            const currentMetadata = await readOfflineMetadata();
            await writeOfflineMetadata({
                ...currentMetadata,
                lastDraftSyncAt: syncedAt,
                lastAuditsSyncAt:
                    liveItem.kind === "submission" ? syncedAt : currentMetadata.lastAuditsSyncAt,
            });
            set((state) => ({
                syncQueue: state.syncQueue.filter((entry) => entry.id !== liveItem.id),
                draftsByPlace:
                    syncedDraft === null
                        ? state.draftsByPlace
                        : {
                              ...state.draftsByPlace,
                              [syncedDraft.placeId]: syncedDraft,
                          },
                lastDraftSyncAt: syncedAt,
                lastAuditsSyncAt:
                    liveItem.kind === "submission" ? syncedAt : state.lastAuditsSyncAt,
            }));
        } catch (error) {
            const statusCode = statusCodeFromError(error);
            const classification = classifyError(statusCode);
            const message = error instanceof Error ? error.message : "Sync failed.";
            // A rejection naming unanswered questions is recoverable by editing
            // the audit; anything else stays an opaque terminal failure.
            const incomplete =
                error instanceof YeeMobileApiError
                    ? parseIncompleteAuditResponses(error.body)
                    : null;
            const next = decideNextQueueState(
                liveItem,
                { classification, statusCode, message, incomplete },
                new Date().toISOString(),
            );

            const failedItem: YeeSyncQueueItem = {
                ...liveItem,
                updatedAt: new Date().toISOString(),
                attempts: next.attempts,
                lastError: next.lastError,
                nextAttemptAtIso: next.nextAttemptAtIso,
                failureReason: next.failureReason,
                // Persist the parked decision itself. Without this the queue
                // could only infer "stop retrying" from the reason string, and a
                // rejected payload kept draining forever.
                isTerminal: next.isTerminal,
                // Carry the questions to fix across restarts. Spread rather than
                // assigning undefined: exactOptionalPropertyTypes forbids it,
                // and an absent key is what an unaffected item should have.
                ...(incomplete === null ? {} : { incompleteQuestionIds: incomplete }),
            };
            await upsertSyncQueueItem(failedItem);
            set((state) => ({
                syncQueue: upsertLocalQueue(state.syncQueue, failedItem),
                draftsByPlace: stampDraftSyncState(
                    state.draftsByPlace,
                    failedItem.placeId,
                    next.syncState,
                ),
                errorMessage: next.lastError,
            }));

            // Auth pause: a 401 means the session is dead for the whole queue.
            // Stop the drain so we wait for a fresh session rather than burning
            // attempts on every remaining item.
            if (next.isAuthPaused) {
                break;
            }
        }
    }

    if (auditListNeedsRefresh) {
        try {
            const submittedAudits = await fetchMyAudits(session);
            const mergedSubmittedAudits = mergeSubmittedAuditSummaries(
                submittedAudits,
                get().submittedAudits,
            );
            await writeSubmittedAuditsCache(mergedSubmittedAudits);
            set(() => ({
                submittedAudits: mergedSubmittedAudits,
                lastAuditsSyncAt: new Date().toISOString(),
            }));
        } catch {
            // keep local optimistic updates if refresh fails
        }
    }
}

/**
 * Push a queued draft_save to the backend as the best-effort remote mirror.
 *
 * The local MMKV draft is the source of truth; this PUT is a compatibility
 * mirror for the web/backend. Two invariants:
 *
 * 1. **Never blocks local recovery.** The local draft is already durable before
 *    anything is enqueued, so the worst case here is a delayed mirror.
 * 2. **Retryable like any other queue item.** A failure THROWS so the caller's
 *    shared backoff/retention policy parks it as "Queued / Sync issue" instead
 *    of silently dropping it — the durable-sync UX depends on that honesty.
 *
 * On success the CURRENT local draft is stamped `synced` only when it is still
 * the exact revision this payload carried (`draft_version`). If a newer local
 * edit bumped the version after enqueue, the backend only has the older content,
 * so the local draft is left dirty for a fresh `draft-${placeId}` item to mirror.
 */
async function drainDraftSave(
    item: YeeSyncQueueItem,
    session: AuthSession,
    get: StoreGet,
): Promise<YeeLocalDraft | null> {
    // Throws on failure — the caller applies backoff + retention (durable UX).
    const savedState = await saveAuditDraft(item.placeId, session, {
        participant_info: item.payload.participant_info,
        responses: item.payload.responses,
        ...(item.payload.instrument_key ? { instrument_key: item.payload.instrument_key } : {}),
        ...(item.payload.instrument_version
            ? { instrument_version: item.payload.instrument_version }
            : {}),
    });

    const existingDraft = get().draftsByPlace[item.placeId] ?? null;
    if (existingDraft === null) {
        return null;
    }

    // Stale-draft guard: a newer local edit (autosave bumped the version after
    // this item was enqueued) must NOT be marked synced off an older mirror PUT.
    const queuedVersion = item.payload.draft_version;
    if (typeof queuedVersion === "number" && existingDraft.version !== queuedVersion) {
        return null;
    }

    const syncedAtIso = new Date().toISOString();
    const syncedDraft: YeeLocalDraft = {
        ...existingDraft,
        scorePreview: savedState.score,
        lastKnownBackendStatus: savedState.status,
        lastKnownSubmissionId: savedState.submission_id,
        instrumentKey: savedState.instrument_key ?? existingDraft.instrumentKey ?? null,
        instrumentVersion: savedState.instrument_version ?? existingDraft.instrumentVersion ?? null,
        syncState: "synced",
        updatedAt: syncedAtIso,
        lastUpdatedIso: syncedAtIso,
    };
    await writeDraft(syncedDraft);
    return syncedDraft;
}

/**
 * Submit a queued audit. Sends the persisted `idempotency_key` so an exact-key
 * replay returns the existing record instead of creating a duplicate. After a
 * successful submit, guards draft deletion by comparing the draft `version`
 * captured at enqueue time against the current local draft: a newer local edit
 * must NOT be deleted by this older queued submission.
 */
async function drainSubmission(
    item: YeeSyncQueueItem,
    session: AuthSession,
    get: StoreGet,
    set: StoreSet,
): Promise<void> {
    const submission = await submitAudit(session, {
        place_id: item.placeId,
        participant_info: item.payload.participant_info,
        responses: item.payload.responses,
        ...(item.payload.instrument_key ? { instrument_key: item.payload.instrument_key } : {}),
        ...(item.payload.instrument_version
            ? { instrument_version: item.payload.instrument_version }
            : {}),
        ...(item.payload.idempotency_key ? { idempotency_key: item.payload.idempotency_key } : {}),
    });

    // Deletion-race guard: only delete the local draft if it has not been edited
    // since this submission was enqueued. `draft_version` is the version at
    // enqueue; a higher current version means a newer local edit we must keep.
    const queuedVersion = item.payload.draft_version;
    const currentDraft = await readDraft(item.placeId);
    const draftWasEditedSinceEnqueue =
        currentDraft !== null &&
        typeof queuedVersion === "number" &&
        currentDraft.version > queuedVersion;
    if (!draftWasEditedSinceEnqueue) {
        await deleteDraft(item.placeId);
    }

    const syncedSubmissionSummary: YeeMyAuditItem = {
        id: submission.id,
        place_id: submission.place_id,
        place_name: submission.place_name ?? item.placeId,
        submitted_at: submission.submitted_at,
        total_score: submission.score.total_score,
        instrument_key: submission.instrument_key ?? item.payload.instrument_key ?? null,
        instrument_version:
            submission.instrument_version ?? item.payload.instrument_version ?? null,
        syncState: "synced",
    };
    const nextSubmittedAudits = [
        ...get().submittedAudits.filter(
            (audit) =>
                audit.id !== submission.id &&
                audit.id !== item.payload.provisional_submission_id &&
                !(
                    audit.place_id === item.placeId &&
                    (audit.syncState === "pending_upload" || audit.syncState === "sync_failed")
                ),
        ),
        syncedSubmissionSummary,
    ].sort((left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at));
    await writeSubmittedAuditsCache(nextSubmittedAudits);

    set((state) => {
        const nextDraftsByPlace = { ...state.draftsByPlace };
        if (!draftWasEditedSinceEnqueue) {
            delete nextDraftsByPlace[item.placeId];
        }
        return {
            draftsByPlace: nextDraftsByPlace,
            submittedAudits: nextSubmittedAudits,
        };
    });
}

/** Immutably stamp a draft's syncState in the draftsByPlace map, if present. */
function stampDraftSyncState(
    draftsByPlace: Record<string, YeeLocalDraft>,
    placeId: string,
    syncState: YeeLocalDraft["syncState"],
): Record<string, YeeLocalDraft> {
    const existing = draftsByPlace[placeId];
    if (existing === undefined) {
        return draftsByPlace;
    }
    return {
        ...draftsByPlace,
        [placeId]: { ...existing, syncState },
    };
}
