/**
 * Per-account MMKV storage substrate for YEE offline drafts and the sync queue.
 *
 * This module owns the crash-safe local persistence for the two pieces of state
 * that must survive app restart, network loss, and token expiry: in-progress
 * audit drafts and the pending sync queue. Both live in the SAME per-account
 * MMKV instance so their durability story is coherent (no split-brain where
 * drafts persist but the queue is lost).
 *
 * Design notes:
 * - One MMKV instance per account, keyed by the authenticated user's id, so two
 *   auditors sharing a device never collide.
 * - Drafts are stored ONE KEY PER PLACE ID (and queue items one key per item id)
 *   rather than a single JSON map, which removes the read-modify-write race the
 *   previous AsyncStorage map implementation had.
 * - A one-time, idempotent migration copies the legacy AsyncStorage payloads
 *   into MMKV on first load and records a completion marker so a second launch
 *   never re-runs or duplicates.
 *
 * Encryption is intentionally DEFERRED (product decision). The MMKV construction
 * exposes an optional `encryptionKey` seam that is left undefined for now. Plain
 * MMKV is used, exactly like the production reference app. See the
 * `// TODO(encryption):` markers below.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from "react-native-mmkv";
import { readAuthSession } from "lib/auth/storage";
import { activateYeeAccount, getActiveYeeAccountId } from "lib/yee-account-scope";
import { migrateLegacyDraftStorage, YeeLegacyMigrationError } from "lib/yee-legacy-draft-migration";
import type { YeeInstrumentResponse, YeeLocalDraft, YeeSyncQueueItem } from "lib/yee-types";

/**
 * Minimal subset of the MMKV v4 instance API this module depends on.
 *
 * Declared locally (rather than importing the `MMKV` type) so the module stays
 * decoupled from the nitro spec surface and remains easy to substitute in tests.
 */
interface MmkvInstance {
    getString(key: string): string | undefined;
    set(key: string, value: string): void;
    remove(key: string): boolean;
    getAllKeys(): string[];
    contains(key: string): boolean;
    clearAll(): void;
}

/**
 * Typed storage error surfaced when a persisted payload cannot be parsed.
 *
 * Corrupt payloads are NOT silently dropped - callers receive this error so the
 * failure can be surfaced rather than masked as missing data.
 */
export class YeeStorageError extends Error {
    readonly key: string;

    constructor(message: string, key: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "YeeStorageError";
        this.key = key;
    }
}

const DRAFT_KEY_PREFIX = "draft.";
const QUEUE_KEY_PREFIX = "queue.";
const INSTRUMENT_KEY_PREFIX = "instrument.version.";
const ACTIVE_INSTRUMENT_STAMP_KEY = "instrument.active-stamp";
const INSTRUMENT_MIGRATION_MARKER_KEY = "yee.migration.instrument-to-mmkv.v1";

const LEGACY_INSTRUMENT_KEY = "yee.mobile.instrument.v1";

export interface YeeInstrumentStamp {
    readonly instrumentKey: string;
    readonly instrumentVersion: string;
}

interface InstrumentCacheEntry {
    readonly cachedAtIso: string;
    readonly instrument: YeeInstrumentResponse;
}

/**
 * Per-account MMKV instances, memoized by account id so we open each native
 * instance only once.
 */
const instancesByAccount = new Map<string, MmkvInstance>();

/**
 * The active account id. Set explicitly via {@link setActiveAccount} on login /
 * hydrate. When unset, the active account is resolved lazily from the persisted
 * auth session so existing store actions (which do not pass an account id) keep
 * working without signature changes.
 */
/**
 * Set or switch the active account whose draft store should be used.
 *
 * Call this on login and on hydrate once the persisted session is known. Passing
 * `null` clears the active account (e.g. on logout) WITHOUT deleting any drafts -
 * drafts survive logout for the same account by design and are only removed via
 * {@link clearAccountStorage}.
 *
 * @param accountId Authenticated user id, or null to clear.
 */
export function setActiveAccount(accountId: string | null): void {
    activateYeeAccount(accountId);
}

/**
 * Resolve the active account id, falling back to the persisted auth session.
 *
 * YEE auditors log in before doing field work, so an account id is always
 * available by the time drafts are read or written. This asserts that contract
 * rather than building an anonymous-draft path.
 *
 * @returns The resolved account id.
 * @throws {YeeStorageError} When no account can be resolved.
 */
async function resolveAccountId(): Promise<string> {
    const activeAccountId = getActiveYeeAccountId();
    if (activeAccountId !== null) {
        return activeAccountId;
    }

    const session = await readAuthSession();
    const accountId = session?.user.id ?? null;
    if (accountId === null || accountId.trim().length === 0) {
        throw new YeeStorageError(
            "No active account for draft storage; log in before reading or writing drafts.",
            "<account>",
        );
    }

    activateYeeAccount(accountId);
    return accountId;
}

/**
 * Get (or lazily open) the per-account MMKV instance.
 *
 * @param accountId Account id used to namespace the MMKV instance id.
 * @returns The MMKV instance for the account.
 */
function getInstance(accountId: string): MmkvInstance {
    const existing = instancesByAccount.get(accountId);
    if (existing !== undefined) {
        return existing;
    }

    // TODO(encryption): generate/lookup a per-account key in expo-secure-store and
    // pass it here as `encryptionKey` to encrypt drafts at rest. Deferred by
    // product decision - drafts are stored in plaintext MMKV for now, matching
    // the production reference app. The seam below is intentionally left wired so
    // enabling encryption later is a single-line change.
    const encryptionKey: string | undefined = undefined;
    const instance = createMMKV({
        id: `yee.drafts.${accountId}`,
        ...(encryptionKey === undefined ? {} : { encryptionKey }),
    });
    instancesByAccount.set(accountId, instance);
    return instance;
}

/**
 * Resolve the active account's MMKV instance, running the one-time migration if
 * it has not yet completed for this account.
 */
async function getActiveInstance(explicitAccountId?: string): Promise<MmkvInstance> {
    const accountId = explicitAccountId ?? (await resolveAccountId());
    const instance = getInstance(accountId);
    try {
        await migrateLegacyDraftStorage(accountId, instance);
    } catch (error) {
        if (error instanceof YeeLegacyMigrationError) {
            throw new YeeStorageError(error.message, error.key, { cause: error });
        }
        throw error;
    }
    await runInstrumentMigrationIfNeeded(instance);
    return instance;
}

function draftKey(placeId: string): string {
    return `${DRAFT_KEY_PREFIX}${placeId}`;
}

function queueKey(itemId: string): string {
    return `${QUEUE_KEY_PREFIX}${itemId}`;
}

function instrumentStorageKey(stamp: YeeInstrumentStamp): string {
    return `${INSTRUMENT_KEY_PREFIX}${encodeURIComponent(stamp.instrumentKey)}.${encodeURIComponent(stamp.instrumentVersion)}`;
}

/**
 * Parse a persisted JSON value, raising a typed error on corruption.
 *
 * @param raw Raw stored string.
 * @param key Storage key, included in the error for diagnostics.
 */
function parseJson<T>(raw: string, key: string): T {
    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        throw new YeeStorageError(`Corrupt persisted payload for "${key}".`, key, {
            cause: error,
        });
    }
}

async function runInstrumentMigrationIfNeeded(instance: MmkvInstance): Promise<void> {
    if (instance.contains(INSTRUMENT_MIGRATION_MARKER_KEY)) {
        return;
    }

    const legacyRaw = await readLegacyAsyncValue(LEGACY_INSTRUMENT_KEY);
    if (legacyRaw !== null) {
        try {
            const instrument = JSON.parse(legacyRaw) as YeeInstrumentResponse;
            const stamp = instrumentStamp(instrument);
            if (stamp !== null) {
                const key = instrumentStorageKey(stamp);
                if (!instance.contains(key)) {
                    instance.set(
                        key,
                        JSON.stringify({
                            cachedAtIso: new Date().toISOString(),
                            instrument,
                        } satisfies InstrumentCacheEntry),
                    );
                }
                if (!instance.contains(ACTIVE_INSTRUMENT_STAMP_KEY)) {
                    instance.set(ACTIVE_INSTRUMENT_STAMP_KEY, JSON.stringify(stamp));
                }
            }
        } catch {
            instance.set(INSTRUMENT_MIGRATION_MARKER_KEY, new Date().toISOString());
            return;
        }
    }

    instance.set(INSTRUMENT_MIGRATION_MARKER_KEY, new Date().toISOString());
}

/**
 * Read a legacy AsyncStorage value, tolerating storage failures (treated as
 * "nothing to migrate") but NOT swallowing parse errors - those are surfaced by
 * the caller via {@link parseJson}.
 */
async function readLegacyAsyncValue(key: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(key);
    } catch {
        return null;
    }
}

function instrumentStamp(instrument: YeeInstrumentResponse): YeeInstrumentStamp | null {
    const instrumentKey = instrument.instrument_key?.trim() ?? "";
    const instrumentVersion = instrument.instrument_version?.trim() ?? "";
    if (instrumentKey.length === 0 || instrumentVersion.length === 0) {
        return null;
    }
    return { instrumentKey, instrumentVersion };
}

function sameInstrumentStamp(left: YeeInstrumentStamp, right: YeeInstrumentStamp): boolean {
    return (
        left.instrumentKey === right.instrumentKey &&
        left.instrumentVersion === right.instrumentVersion
    );
}

export async function readInstrumentFromMmkv(
    stamp: YeeInstrumentStamp,
    accountId?: string,
): Promise<YeeInstrumentResponse | null> {
    const instance = await getActiveInstance(accountId);
    const key = instrumentStorageKey(stamp);
    const raw = instance.getString(key);
    if (raw === undefined) {
        return null;
    }
    return parseJson<InstrumentCacheEntry>(raw, key).instrument;
}

export async function readActiveInstrumentFromMmkv(
    accountId?: string,
): Promise<YeeInstrumentResponse | null> {
    const instance = await getActiveInstance(accountId);
    const rawStamp = instance.getString(ACTIVE_INSTRUMENT_STAMP_KEY);
    if (rawStamp === undefined) {
        return null;
    }
    const stamp = parseJson<YeeInstrumentStamp>(rawStamp, ACTIVE_INSTRUMENT_STAMP_KEY);
    const key = instrumentStorageKey(stamp);
    const rawInstrument = instance.getString(key);
    if (rawInstrument === undefined) {
        throw new YeeStorageError(
            "The active instrument pointer refers to a missing cached version.",
            key,
        );
    }
    return parseJson<InstrumentCacheEntry>(rawInstrument, key).instrument;
}

export async function writeInstrumentToMmkv(
    instrument: YeeInstrumentResponse,
    options: { readonly asActive?: boolean } = {},
    accountId?: string,
): Promise<YeeInstrumentStamp> {
    const instance = await getActiveInstance(accountId);
    const stamp = instrumentStamp(instrument);
    if (stamp === null) {
        throw new YeeStorageError(
            "Cannot cache an instrument without instrument_key and instrument_version.",
            "<instrument-stamp>",
        );
    }

    instance.set(
        instrumentStorageKey(stamp),
        JSON.stringify({
            cachedAtIso: new Date().toISOString(),
            instrument,
        } satisfies InstrumentCacheEntry),
    );
    if (options.asActive !== false) {
        instance.set(ACTIVE_INSTRUMENT_STAMP_KEY, JSON.stringify(stamp));
    }
    return stamp;
}

export async function evictUnpinnedInstrumentsFromMmkv(
    pinnedStamps: readonly YeeInstrumentStamp[],
    accountId?: string,
): Promise<void> {
    const instance = await getActiveInstance(accountId);
    const rawActive = instance.getString(ACTIVE_INSTRUMENT_STAMP_KEY);
    const activeStamp =
        rawActive === undefined
            ? null
            : parseJson<YeeInstrumentStamp>(rawActive, ACTIVE_INSTRUMENT_STAMP_KEY);

    const entries = instance
        .getAllKeys()
        .filter((key) => key.startsWith(INSTRUMENT_KEY_PREFIX))
        .map((key) => {
            const raw = instance.getString(key);
            if (raw === undefined) {
                return null;
            }
            const entry = parseJson<InstrumentCacheEntry>(raw, key);
            const stamp = instrumentStamp(entry.instrument);
            return stamp === null ? null : { key, entry, stamp };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .sort((left, right) => right.entry.cachedAtIso.localeCompare(left.entry.cachedAtIso));

    for (const candidate of entries) {
        const isPinned =
            (activeStamp !== null && sameInstrumentStamp(candidate.stamp, activeStamp)) ||
            pinnedStamps.some((stamp) => sameInstrumentStamp(candidate.stamp, stamp));
        if (isPinned) {
            continue;
        }
        instance.remove(candidate.key);
    }
}

export async function listCachedInstrumentStampsFromMmkv(
    accountId?: string,
): Promise<readonly YeeInstrumentStamp[]> {
    const instance = await getActiveInstance(accountId);
    const stamps: YeeInstrumentStamp[] = [];
    for (const key of instance.getAllKeys()) {
        if (!key.startsWith(INSTRUMENT_KEY_PREFIX)) {
            continue;
        }
        const raw = instance.getString(key);
        if (raw === undefined) {
            continue;
        }
        const stamp = instrumentStamp(parseJson<InstrumentCacheEntry>(raw, key).instrument);
        if (stamp !== null) {
            stamps.push(stamp);
        }
    }
    return stamps;
}

// ---------------------------------------------------------------------------
// Draft storage (one key per place id)
// ---------------------------------------------------------------------------

/**
 * Read every persisted draft for the active account, keyed by place id.
 *
 * @throws {YeeStorageError} If any persisted draft payload is corrupt.
 */
export async function readDraftMapFromMmkv(
    accountId?: string,
): Promise<Record<string, YeeLocalDraft>> {
    const instance = await getActiveInstance(accountId);
    const result: Record<string, YeeLocalDraft> = {};

    for (const key of instance.getAllKeys()) {
        if (!key.startsWith(DRAFT_KEY_PREFIX)) {
            continue;
        }
        const raw = instance.getString(key);
        if (raw === undefined) {
            continue;
        }
        const draft = parseJson<YeeLocalDraft>(raw, key);
        result[draft.placeId] = draft;
    }

    return result;
}

/**
 * Read a single draft by place id, or null when absent.
 *
 * @throws {YeeStorageError} If the persisted payload is corrupt.
 */
export async function readDraftFromMmkv(
    placeId: string,
    accountId?: string,
): Promise<YeeLocalDraft | null> {
    const instance = await getActiveInstance(accountId);
    const raw = instance.getString(draftKey(placeId));
    if (raw === undefined) {
        return null;
    }
    return parseJson<YeeLocalDraft>(raw, draftKey(placeId));
}

/** Persist a single draft under its place-id key. */
export async function writeDraftToMmkv(draft: YeeLocalDraft, accountId?: string): Promise<void> {
    const instance = await getActiveInstance(accountId);
    instance.set(draftKey(draft.placeId), JSON.stringify(draft));
}

/** Remove a single draft by place id. No-op when absent. */
export async function deleteDraftFromMmkv(placeId: string, accountId?: string): Promise<void> {
    const instance = await getActiveInstance(accountId);
    instance.remove(draftKey(placeId));
}

// ---------------------------------------------------------------------------
// Sync queue storage (one key per item id) - substrate for Stage 3
// ---------------------------------------------------------------------------

/**
 * Read every persisted sync queue item for the active account.
 *
 * @throws {YeeStorageError} If any persisted queue payload is corrupt.
 */
export async function readSyncQueueFromMmkv(
    accountId?: string,
): Promise<readonly YeeSyncQueueItem[]> {
    const instance = await getActiveInstance(accountId);
    const items: YeeSyncQueueItem[] = [];

    for (const key of instance.getAllKeys()) {
        if (!key.startsWith(QUEUE_KEY_PREFIX)) {
            continue;
        }
        const raw = instance.getString(key);
        if (raw === undefined) {
            continue;
        }
        items.push(parseJson<YeeSyncQueueItem>(raw, key));
    }

    return items;
}

/**
 * Insert or replace a single sync queue item, keyed by its deterministic id.
 *
 * Per-key storage gives idempotent check-and-set semantics for free: writing the
 * same id twice overwrites in place rather than appending a duplicate.
 */
export async function upsertSyncQueueItemInMmkv(
    item: YeeSyncQueueItem,
    accountId?: string,
): Promise<void> {
    const instance = await getActiveInstance(accountId);
    instance.set(queueKey(item.id), JSON.stringify(item));
}

/** Remove a single sync queue item by id. No-op when absent. */
export async function removeSyncQueueItemFromMmkv(
    itemId: string,
    accountId?: string,
): Promise<void> {
    const instance = await getActiveInstance(accountId);
    instance.remove(queueKey(itemId));
}

/**
 * Replace the entire persisted sync queue with the provided items.
 *
 * Existing queue keys are removed first so the persisted set matches the input
 * exactly, preserving the semantics of the previous whole-array writer.
 */
export async function writeSyncQueueToMmkv(
    queue: readonly YeeSyncQueueItem[],
    accountId?: string,
): Promise<void> {
    const instance = await getActiveInstance(accountId);

    for (const key of instance.getAllKeys()) {
        if (key.startsWith(QUEUE_KEY_PREFIX)) {
            instance.remove(key);
        }
    }

    for (const item of queue) {
        instance.set(queueKey(item.id), JSON.stringify(item));
    }
}

// ---------------------------------------------------------------------------
// Account lifecycle
// ---------------------------------------------------------------------------

/**
 * Delete ALL drafts and queue items for an account.
 *
 * Only called on explicit account removal. Ordinary logout (including
 * token-expiry logout) must NOT call this - unsynced work survives logout for
 * the same account by design.
 *
 * @param accountId Account whose storage should be wiped.
 */
export function clearAccountStorage(accountId: string): void {
    const instance = getInstance(accountId);
    instance.clearAll();
    if (getActiveYeeAccountId() === accountId) {
        activateYeeAccount(null);
    }
    instancesByAccount.delete(accountId);
}
