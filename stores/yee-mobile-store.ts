import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import type { AuthSession } from "lib/auth/types";
import {
    fetchAssignedPlaces,
    fetchAuditState,
    fetchYeeInstrument,
    fetchMyAudits,
    saveAuditDraft,
    submitAudit,
} from "lib/yee-api";
import {
    deleteDraft,
    deleteSubmissionDetail,
    readAssignedPlacesCache,
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
import type {
    YeeAssignedPlace,
    YeeAuditStateResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSubmissionResponse,
    YeeSyncQueueItem,
} from "lib/yee-types";

export type YeeMobileStoreStatus = "idle" | "loading" | "ready" | "error";

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
                    await writeInstrumentCache(instrument as unknown as Record<string, unknown>);
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
        const now = new Date().toISOString();
        const queueItem: YeeSyncQueueItem = {
            id: `draft-${draft.placeId}`,
            placeId: draft.placeId,
            createdAt: now,
            updatedAt: now,
            kind: "draft_save",
            payload: {
                participant_info: draft.participantInfo,
                responses: draft.responses,
            },
            attempts: 0,
            lastError: null,
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
    },

    queueSubmissionSync: async (draft: YeeLocalDraft, provisionalSubmission = null) => {
        const now = new Date().toISOString();
        const queueItem: YeeSyncQueueItem = {
            id: `submission-${draft.placeId}`,
            placeId: draft.placeId,
            createdAt: now,
            updatedAt: now,
            kind: "submission",
            payload: {
                place_id: draft.placeId,
                participant_info: draft.participantInfo,
                responses: draft.responses,
                ...(provisionalSubmission?.id
                    ? { provisional_submission_id: provisionalSubmission.id }
                    : {}),
            },
            attempts: 0,
            lastError: null,
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
                      place_name:
                          provisionalSubmission.place_name ?? provisionalSubmission.place_id,
                      submitted_at: provisionalSubmission.submitted_at,
                      total_score: provisionalSubmission.score.total_score,
                      syncState: "pending_upload" as const,
                  };

        set((state) => {
            const nextSubmittedAudits =
                nextLocalSummary === null
                    ? state.submittedAudits
                    : [
                          ...state.submittedAudits.filter(
                              (audit) => audit.id !== nextLocalSummary.id,
                          ),
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
    },

    syncPendingQueue: async (session: AuthSession) => {
        const queue = [...get().syncQueue];
        if (queue.length === 0) {
            return;
        }

        set(() => ({ errorMessage: null }));
        let auditListNeedsRefresh = false;

        for (const item of queue) {
            try {
                let syncedSubmissionSummary: YeeMyAuditItem | null = null;
                if (item.kind === "draft_save") {
                    const savedState = await saveAuditDraft(item.placeId, session, {
                        participant_info: item.payload.participant_info,
                        responses: item.payload.responses,
                    });
                    const existingDraft = get().draftsByPlace[item.placeId] ?? null;
                    if (existingDraft !== null) {
                        await writeDraft({
                            ...existingDraft,
                            scorePreview: savedState.score,
                            lastKnownBackendStatus: savedState.status,
                            lastKnownSubmissionId: savedState.submission_id,
                            syncState: "synced",
                            updatedAt: new Date().toISOString(),
                        });
                    }
                } else {
                    const submission = await submitAudit(session, {
                        place_id: item.placeId,
                        participant_info: item.payload.participant_info,
                        responses: item.payload.responses,
                    });
                    await writeSubmissionDetail(submission);
                    if (item.payload.provisional_submission_id) {
                        await deleteSubmissionDetail(item.payload.provisional_submission_id);
                    }
                    await deleteDraft(item.placeId);
                    auditListNeedsRefresh = true;
                    syncedSubmissionSummary = {
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
                                audit.id !== submission.id &&
                                audit.id !== item.payload.provisional_submission_id,
                        ),
                        syncedSubmissionSummary,
                    ].sort(
                        (left, right) =>
                            Date.parse(right.submitted_at) - Date.parse(left.submitted_at),
                    );
                    await writeSubmittedAuditsCache(nextSubmittedAudits);
                }

                await removeSyncQueueItem(item.id);
                const syncedAt = new Date().toISOString();
                const currentMetadata = await readOfflineMetadata();
                await writeOfflineMetadata({
                    ...currentMetadata,
                    lastDraftSyncAt: syncedAt,
                    lastAuditsSyncAt:
                        item.kind === "submission" ? syncedAt : currentMetadata.lastAuditsSyncAt,
                });
                set((state) => {
                    const nextDraftsByPlace = { ...state.draftsByPlace };
                    if (item.kind === "submission") {
                        delete nextDraftsByPlace[item.placeId];
                    } else {
                        const existingDraft = nextDraftsByPlace[item.placeId];
                        if (existingDraft !== undefined) {
                            nextDraftsByPlace[item.placeId] = {
                                ...existingDraft,
                                syncState: "synced",
                            };
                        }
                    }

                    return {
                        draftsByPlace: nextDraftsByPlace,
                        syncQueue: state.syncQueue.filter((entry) => entry.id !== item.id),
                        submittedAudits:
                            item.kind === "submission" && syncedSubmissionSummary !== null
                                ? [
                                      ...state.submittedAudits.filter(
                                          (audit) => audit.id !== syncedSubmissionSummary.id,
                                      ),
                                      syncedSubmissionSummary,
                                  ].sort(
                                      (left, right) =>
                                          Date.parse(right.submitted_at) -
                                          Date.parse(left.submitted_at),
                                  )
                                : state.submittedAudits,
                        lastDraftSyncAt: syncedAt,
                        lastAuditsSyncAt:
                            item.kind === "submission" ? syncedAt : state.lastAuditsSyncAt,
                    };
                });
            } catch (error) {
                const lastError = error instanceof Error ? error.message : "Sync failed.";
                const failedItem: YeeSyncQueueItem = {
                    ...item,
                    updatedAt: new Date().toISOString(),
                    attempts: item.attempts + 1,
                    lastError,
                };
                await upsertSyncQueueItem(failedItem);
                set((state) => ({
                    syncQueue: upsertLocalQueue(state.syncQueue, failedItem),
                    errorMessage: lastError,
                }));
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
    },

    loadPlaceAuditState: async (placeId: string, session: AuthSession) => {
        const state = await fetchAuditState(placeId, session);

        if (state.status === "DRAFT") {
            const localDraft: YeeLocalDraft = {
                placeId,
                updatedAt: new Date().toISOString(),
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
