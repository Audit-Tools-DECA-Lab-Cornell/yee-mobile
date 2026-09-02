import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveYeeAccountId } from "lib/yee-account-scope";
import { isLegacyMigrationOwner } from "lib/yee-legacy-draft-migration";
import {
    YeeStorageError,
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
    places: "yee.mobile.assigned-places.v2",
    audits: "yee.mobile.submitted-audits.v2",
    metadata: "yee.mobile.offline-metadata.v2",
} as const;

const LEGACY_STORAGE_KEYS = {
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

export async function readAssignedPlacesCache(
    accountId?: string,
): Promise<readonly YeeAssignedPlace[]> {
    return readAccountJson(
        STORAGE_KEYS.places,
        LEGACY_STORAGE_KEYS.places,
        resolveCacheAccountId(accountId),
        [] as readonly YeeAssignedPlace[],
    );
}

export async function writeAssignedPlacesCache(
    places: readonly YeeAssignedPlace[],
    accountId?: string,
): Promise<void> {
    await writeJson(accountKey(STORAGE_KEYS.places, resolveCacheAccountId(accountId)), places);
}

export async function readSubmittedAuditsCache(
    accountId?: string,
): Promise<readonly YeeMyAuditItem[]> {
    return readAccountJson(
        STORAGE_KEYS.audits,
        LEGACY_STORAGE_KEYS.audits,
        resolveCacheAccountId(accountId),
        [] as readonly YeeMyAuditItem[],
    );
}

export async function writeSubmittedAuditsCache(
    audits: readonly YeeMyAuditItem[],
    accountId?: string,
): Promise<void> {
    await writeJson(accountKey(STORAGE_KEYS.audits, resolveCacheAccountId(accountId)), audits);
}

/**
 * Drafts and the sync queue are persisted in per-account, crash-safe MMKV (see
 * lib/yee-secure-draft-storage.ts). These wrappers preserve the existing
 * promise-based signatures the store depends on while delegating to MMKV.
 */
export async function readDraftMap(accountId?: string): Promise<Record<string, YeeLocalDraft>> {
    return readDraftMapFromMmkv(accountId);
}

export async function readDraft(
    placeId: string,
    accountId?: string,
): Promise<YeeLocalDraft | null> {
    return readDraftFromMmkv(placeId, accountId);
}

export async function writeDraft(draft: YeeLocalDraft, accountId?: string): Promise<void> {
    await writeDraftToMmkv(draft, accountId);
}

export async function deleteDraft(placeId: string, accountId?: string): Promise<void> {
    await deleteDraftFromMmkv(placeId, accountId);
}

export async function readSyncQueue(accountId?: string): Promise<readonly YeeSyncQueueItem[]> {
    return readSyncQueueFromMmkv(accountId);
}

export async function writeSyncQueue(
    queue: readonly YeeSyncQueueItem[],
    accountId?: string,
): Promise<void> {
    await writeSyncQueueToMmkv(queue, accountId);
}

export async function upsertSyncQueueItem(
    item: YeeSyncQueueItem,
    accountId?: string,
): Promise<void> {
    await upsertSyncQueueItemInMmkv(item, accountId);
}

export async function removeSyncQueueItem(itemId: string, accountId?: string): Promise<void> {
    await removeSyncQueueItemFromMmkv(itemId, accountId);
}

export async function readOfflineMetadata(accountId?: string): Promise<YeeOfflineMetadata> {
    return readAccountJson(
        STORAGE_KEYS.metadata,
        LEGACY_STORAGE_KEYS.metadata,
        resolveCacheAccountId(accountId),
        DEFAULT_METADATA,
    );
}

export async function writeOfflineMetadata(
    metadata: YeeOfflineMetadata,
    accountId?: string,
): Promise<void> {
    await writeJson(accountKey(STORAGE_KEYS.metadata, resolveCacheAccountId(accountId)), metadata);
}

export async function readInstrumentCache(
    stamp?: YeeInstrumentStamp | null,
    accountId?: string,
): Promise<YeeInstrumentResponse | null> {
    return stamp === null || stamp === undefined
        ? readActiveInstrumentFromMmkv(accountId)
        : readInstrumentFromMmkv(stamp, accountId);
}

export async function writeInstrumentCache(
    instrument: YeeInstrumentResponse,
    options: { readonly asActive?: boolean } = {},
    accountId?: string,
): Promise<void> {
    const stamp = await writeInstrumentToMmkv(instrument, options, accountId);
    const [drafts, submittedAudits] = await Promise.all([
        readDraftMapFromMmkv(accountId),
        readSubmittedAuditsCache(accountId),
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
    await evictUnpinnedInstrumentsFromMmkv(pinnedStamps, accountId);
}

export async function hasAnyAssignedPlacesCache(): Promise<boolean> {
    const legacy = await readJson(LEGACY_STORAGE_KEYS.places, [] as readonly YeeAssignedPlace[]);
    if (legacy.length > 0) {
        return true;
    }
    try {
        const keys = await AsyncStorage.getAllKeys();
        const accountKeys = keys.filter((key) => key.startsWith(`${STORAGE_KEYS.places}.`));
        const entries = await AsyncStorage.multiGet(accountKeys);
        return entries.some(([, value]) => value !== null && value !== "[]");
    } catch {
        return [...inMemoryFallback.entries()].some(
            ([key, value]) => key.startsWith(`${STORAGE_KEYS.places}.`) && value !== "[]",
        );
    }
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

async function readAccountJson<T>(
    baseKey: string,
    legacyKey: string,
    accountId: string,
    fallback: T,
): Promise<T> {
    const scopedKey = accountKey(baseKey, accountId);
    const scopedValue = await getStoredValue(scopedKey);
    if (scopedValue !== null) {
        return parseJson(scopedValue, fallback);
    }
    const legacyValue = await getStoredValue(legacyKey);
    if (legacyValue === null || !(await isLegacyMigrationOwner(accountId))) {
        return fallback;
    }
    const migrated = parseJson(legacyValue, fallback);
    await writeJson(scopedKey, migrated);
    return migrated;
}

function parseJson<T>(rawValue: string, fallback: T): T {
    try {
        return JSON.parse(rawValue) as T;
    } catch {
        return fallback;
    }
}

function resolveCacheAccountId(accountId: string | undefined): string {
    const resolved = accountId ?? getActiveYeeAccountId();
    if (resolved === null) {
        throw new YeeStorageError("No active account for offline cache storage.", "<account>");
    }
    return resolved;
}

function accountKey(baseKey: string, accountId: string): string {
    return `${baseKey}.${encodeURIComponent(accountId)}`;
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
