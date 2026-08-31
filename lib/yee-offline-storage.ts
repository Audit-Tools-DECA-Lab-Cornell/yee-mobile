import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    deleteDraftFromMmkv,
    evictUnpinnedInstrumentsFromMmkv,
    readActiveInstrumentFromMmkv,
    readDraftFromMmkv,
    readDraftMapFromMmkv,
    readInstrumentFromMmkv,
    readSyncQueueFromMmkv,
    removeSyncQueueItemFromMmkv,
    upsertSyncQueueItemInMmkv,
    writeDraftToMmkv,
    writeInstrumentToMmkv,
    writeSyncQueueToMmkv,
    type YeeInstrumentStamp,
} from "lib/yee-secure-draft-storage";
import type {
    YeeAssignedPlace,
    YeeInstrumentResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSyncQueueItem,
} from "lib/yee-types";

/**
 * AsyncStorage namespaces still owned by this module.
 *
 * Drafts (`yee.mobile.local-drafts.v1`) and the sync queue
 * (`yee.mobile.sync-queue.v1`) have moved to per-account MMKV
 * (lib/yee-secure-draft-storage.ts) for crash safety. The cache-only namespaces
 * below remain on AsyncStorage because they are reconstructable from the backend
 * on next sync and do not carry unsynced user work.
 */
const STORAGE_KEYS = {
    places: "yee.mobile.assigned-places.v1",
    audits: "yee.mobile.submitted-audits.v1",
    metadata: "yee.mobile.offline-metadata.v1",
} as const;

const inMemoryFallback = new Map<string, string>();

export interface YeeOfflineMetadata {
    readonly lastPlacesSyncAt: string | null;
    readonly lastAuditsSyncAt: string | null;
    readonly lastDraftSyncAt: string | null;
}

const DEFAULT_METADATA: YeeOfflineMetadata = {
    lastPlacesSyncAt: null,
    lastAuditsSyncAt: null,
    lastDraftSyncAt: null,
};

export async function readAssignedPlacesCache(): Promise<readonly YeeAssignedPlace[]> {
    return readJson(STORAGE_KEYS.places, [] as readonly YeeAssignedPlace[]);
}

export async function writeAssignedPlacesCache(places: readonly YeeAssignedPlace[]): Promise<void> {
    await writeJson(STORAGE_KEYS.places, places);
}

export async function readSubmittedAuditsCache(): Promise<readonly YeeMyAuditItem[]> {
    return readJson(STORAGE_KEYS.audits, [] as readonly YeeMyAuditItem[]);
}

export async function writeSubmittedAuditsCache(audits: readonly YeeMyAuditItem[]): Promise<void> {
    await writeJson(STORAGE_KEYS.audits, audits);
}

/**
 * Drafts and the sync queue are persisted in per-account, crash-safe MMKV (see
 * lib/yee-secure-draft-storage.ts). These wrappers preserve the existing
 * promise-based signatures the store depends on while delegating to MMKV.
 */
export async function readDraftMap(): Promise<Record<string, YeeLocalDraft>> {
    return readDraftMapFromMmkv();
}

export async function readDraft(placeId: string): Promise<YeeLocalDraft | null> {
    return readDraftFromMmkv(placeId);
}

export async function writeDraft(draft: YeeLocalDraft): Promise<void> {
    await writeDraftToMmkv(draft);
}

export async function deleteDraft(placeId: string): Promise<void> {
    await deleteDraftFromMmkv(placeId);
}

export async function readSyncQueue(): Promise<readonly YeeSyncQueueItem[]> {
    return readSyncQueueFromMmkv();
}

export async function writeSyncQueue(queue: readonly YeeSyncQueueItem[]): Promise<void> {
    await writeSyncQueueToMmkv(queue);
}

export async function upsertSyncQueueItem(item: YeeSyncQueueItem): Promise<void> {
    await upsertSyncQueueItemInMmkv(item);
}

export async function removeSyncQueueItem(itemId: string): Promise<void> {
    await removeSyncQueueItemFromMmkv(itemId);
}

export async function readOfflineMetadata(): Promise<YeeOfflineMetadata> {
    return readJson(STORAGE_KEYS.metadata, DEFAULT_METADATA);
}

export async function writeOfflineMetadata(metadata: YeeOfflineMetadata): Promise<void> {
    await writeJson(STORAGE_KEYS.metadata, metadata);
}

export async function readInstrumentCache(
    stamp?: YeeInstrumentStamp | null,
): Promise<YeeInstrumentResponse | null> {
    return stamp === null || stamp === undefined
        ? readActiveInstrumentFromMmkv()
        : readInstrumentFromMmkv(stamp);
}

export async function writeInstrumentCache(
    instrument: YeeInstrumentResponse,
    options: { readonly asActive?: boolean } = {},
): Promise<void> {
    const stamp = await writeInstrumentToMmkv(instrument, options);
    const [drafts, submittedAudits] = await Promise.all([
        readDraftMapFromMmkv(),
        readSubmittedAuditsCache(),
    ]);
    const pinnedStamps = [
        ...Object.values(drafts).flatMap((draft) =>
            stampFromValues(draft.instrumentKey, draft.instrumentVersion),
        ),
        ...submittedAudits.flatMap((audit) =>
            stampFromValues(audit.instrument_key, audit.instrument_version),
        ),
        stamp,
    ];
    await evictUnpinnedInstrumentsFromMmkv(pinnedStamps);
}

function stampFromValues(
    instrumentKey: string | null | undefined,
    instrumentVersion: string | null | undefined,
): readonly YeeInstrumentStamp[] {
    const key = instrumentKey?.trim() ?? "";
    const version = instrumentVersion?.trim() ?? "";
    return key.length > 0 && version.length > 0
        ? [{ instrumentKey: key, instrumentVersion: version }]
        : [];
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
    const rawValue = await getStoredValue(key);
    if (rawValue === null) {
        return fallback;
    }

    try {
        return JSON.parse(rawValue) as T;
    } catch {
        return fallback;
    }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
    await setStoredValue(key, JSON.stringify(value));
}

async function getStoredValue(key: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(key);
    } catch {
        return inMemoryFallback.get(key) ?? null;
    }
}

async function setStoredValue(key: string, value: string): Promise<void> {
    try {
        await AsyncStorage.setItem(key, value);
    } catch {
        inMemoryFallback.set(key, value);
    }
}
