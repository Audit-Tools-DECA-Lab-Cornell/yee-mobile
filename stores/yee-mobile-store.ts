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
import { classifyError, decideNextQueueState, selectDrainableItems } from "lib/yee-sync-logic";
import {
    deleteDraft,
    deleteSubmissionDetail,
    readAssignedPlacesCache,
    readDraft,
    readDraftMap,
    readInstrumentCache,
    readOfflineMetadata,
    readSubmittedAuditsCache,
    readSyncQueue,
    writeSubmissionDetail,
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
            const provisionalSubmissionId =
                queuedSubmission?.payload.provisional_submission_id ?? null;

            if (queuedSubmission !== null) {
                await removeSyncQueueItem(queuedSubmission.id);
            }
            if (provisionalSubmissionId !== null) {
                await deleteSubmissionDetail(provisionalSubmissionId);
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
            const nowIso = new Date().toISOString();
            const previousDraft = get().draftsByPlace[placeId] ?? null;
            const localDraft: YeeLocalDraft = {
                id: previousDraft?.id ?? placeId,
                schemaVersion: YEE_DRAFT_SCHEMA_VERSION,
                version: (previousDraft?.version ?? 0) + 1,
                placeId,
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
                !normalizedRemoteAudits.some((remoteAudit) => remoteAudit.id === localAudit.id),
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

    await upsertSyncQueueItem(queueItem);
    await writeDraft({
        ...draft,
        syncState: "pending_upload",
    });
    if (provisionalSubmission !== null) {
        await writeSubmissionDetail(provisionalSubmission);
    }

    const nextLocalSummary =
        provisionalSubmission === null
            ? null
            : {
                  id: provisionalSubmission.id,
                  place_id: provisionalSubmission.place_id,
                  place_name: provisionalSubmission.place_name ?? provisionalSubmission.place_id,
                  submitted_at: provisionalSubmission.submitted_at,
                  total_score: provisionalSubmission.score.total_score,
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
            syncQueue: upsertLocalQueue(state.syncQueue, queueItem),
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

        try {
            if (liveItem.kind === "draft_save") {
                await drainDraftSave(liveItem, session, get);
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
                lastDraftSyncAt: syncedAt,
                lastAuditsSyncAt:
                    liveItem.kind === "submission" ? syncedAt : state.lastAuditsSyncAt,
            }));
        } catch (error) {
            const statusCode = statusCodeFromError(error);
            const classification = classifyError(statusCode);
            const message = error instanceof Error ? error.message : "Sync failed.";
            const next = decideNextQueueState(
                liveItem,
                { classification, statusCode, message },
                new Date().toISOString(),
            );

            const failedItem: YeeSyncQueueItem = {
                ...liveItem,
                updatedAt: new Date().toISOString(),
                attempts: next.attempts,
                lastError: next.lastError,
                nextAttemptAtIso: next.nextAttemptAtIso,
                failureReason: next.failureReason,
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
 * Push a queued draft_save to the backend as OPTIONAL legacy sync.
 *
 * The local MMKV draft is the source of truth; this remote save is best-effort
 * convenience for the web mirror. A failure here is NOT treated as a sync error
 * (it does not park the item or surface an error) — the item is still removed by
 * the caller. Local recovery never depends on it.
 */
async function drainDraftSave(
    item: YeeSyncQueueItem,
    session: AuthSession,
    get: StoreGet,
): Promise<void> {
    try {
        const savedState = await saveAuditDraft(item.placeId, session, {
            participant_info: item.payload.participant_info,
            responses: item.payload.responses,
        });
        const existingDraft = get().draftsByPlace[item.placeId] ?? null;
        if (existingDraft !== null) {
            const syncedAtIso = new Date().toISOString();
            await writeDraft({
                ...existingDraft,
                version: existingDraft.version + 1,
                scorePreview: savedState.score,
                lastKnownBackendStatus: savedState.status,
                lastKnownSubmissionId: savedState.submission_id,
                syncState: "synced",
                updatedAt: syncedAtIso,
                lastUpdatedIso: syncedAtIso,
            });
        }
    } catch {
        // Legacy remote draft save is best-effort; never block local recovery.
    }
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
        ...(item.payload.idempotency_key ? { idempotency_key: item.payload.idempotency_key } : {}),
    });
    await writeSubmissionDetail(submission);
    if (item.payload.provisional_submission_id) {
        await deleteSubmissionDetail(item.payload.provisional_submission_id);
    }

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
        syncState: "synced",
    };
    const nextSubmittedAudits = [
        ...get().submittedAudits.filter(
            (audit) =>
                audit.id !== submission.id && audit.id !== item.payload.provisional_submission_id,
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
            submittedAudits: [
                ...state.submittedAudits.filter((audit) => audit.id !== syncedSubmissionSummary.id),
                syncedSubmissionSummary,
            ].sort((left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at)),
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
