import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import type { AuthSession } from "lib/auth/types";
import {
    fetchAssignedPlaces,
    fetchAuditState,
    fetchMyAudits,
    saveAuditDraft,
    submitAudit,
} from "lib/yee-api";
import {
    deleteDraft,
    readAssignedPlacesCache,
    readDraftMap,
    readOfflineMetadata,
    readSubmittedAuditsCache,
    readSyncQueue,
    removeSyncQueueItem,
    upsertSyncQueueItem,
    writeAssignedPlacesCache,
    writeDraft,
    writeOfflineMetadata,
    writeSubmittedAuditsCache,
} from "lib/yee-offline-storage";
import type {
    YeeAssignedPlace,
    YeeAuditStateResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
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
    hydrateOfflineState: () => Promise<void>;
    refreshRemoteState: (session: AuthSession) => Promise<void>;
    saveDraftLocally: (draft: YeeLocalDraft) => Promise<void>;
    queueDraftSync: (draft: YeeLocalDraft) => Promise<void>;
    queueSubmissionSync: (draft: YeeLocalDraft) => Promise<void>;
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

    hydrateOfflineState: async () => {
        set(() => ({ status: "loading", errorMessage: null }));

        try {
            const [netInfo, assignedPlaces, submittedAudits, draftsByPlace, syncQueue, metadata] =
                await Promise.all([
                    NetInfo.fetch(),
                    readAssignedPlacesCache(),
                    readSubmittedAuditsCache(),
                    readDraftMap(),
                    readSyncQueue(),
                    readOfflineMetadata(),
                ]);

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
            }));
        } catch (error) {
            set(() => ({
                status: "error",
                errorMessage:
                    error instanceof Error ? error.message : "Failed to load offline YEE mobile state.",
            }));
        }
    },

    refreshRemoteState: async (session: AuthSession) => {
        set(() => ({ status: "loading", errorMessage: null }));

        try {
            const [netInfo, assignedPlaces, submittedAudits] = await Promise.all([
                NetInfo.fetch(),
                fetchAssignedPlaces(session),
                fetchMyAudits(session),
            ]);
            const now = new Date().toISOString();

            await Promise.all([
                writeAssignedPlacesCache(assignedPlaces),
                writeSubmittedAuditsCache(submittedAudits),
                writeOfflineMetadata({
                    lastPlacesSyncAt: now,
                    lastAuditsSyncAt: now,
                    lastDraftSyncAt: get().lastDraftSyncAt,
                }),
            ]);

            set((state) => ({
                status: "ready",
                isOnline: Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false),
                assignedPlaces,
                submittedAudits,
                lastPlacesSyncAt: now,
                lastAuditsSyncAt: now,
                draftsByPlace: state.draftsByPlace,
                syncQueue: state.syncQueue,
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
        await writeDraft(draft);
        set((state) => ({
            draftsByPlace: {
                ...state.draftsByPlace,
                [draft.placeId]: draft,
            },
            lastDraftSyncAt: state.lastDraftSyncAt,
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

    queueSubmissionSync: async (draft: YeeLocalDraft) => {
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

    syncPendingQueue: async (session: AuthSession) => {
        const queue = [...get().syncQueue];
        if (queue.length === 0) {
            return;
        }

        set(() => ({ errorMessage: null }));

        for (const item of queue) {
            try {
                if (item.kind === "draft_save") {
                    await saveAuditDraft(item.placeId, session, {
                        participant_info: item.payload.participant_info,
                        responses: item.payload.responses,
                    });
                } else {
                    await submitAudit(session, {
                        place_id: item.placeId,
                        participant_info: item.payload.participant_info,
                        responses: item.payload.responses,
                    });
                    await deleteDraft(item.placeId);
                }

                await removeSyncQueueItem(item.id);
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
                        lastDraftSyncAt: new Date().toISOString(),
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
