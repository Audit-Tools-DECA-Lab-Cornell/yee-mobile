import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const LEGACY_DRAFTS_KEY = "yee.mobile.local-drafts.v1";
const LEGACY_QUEUE_KEY = "yee.mobile.sync-queue.v1";
const JOURNAL_KEY = "yee.mobile.legacy-owner.v2";
const ACCOUNT_MIGRATION_MARKER = "yee.migration.async-to-mmkv.v1";
const ACCOUNT_OWNERSHIP_MARKER = "yee.migration.async-to-mmkv.owner-v2";

const PersistedObjectSchema = z.record(z.string(), z.unknown());
const LegacyDraftMapSchema = z.record(z.string(), PersistedObjectSchema);
const LegacyQueueSchema = z.array(PersistedObjectSchema);
const LegacyJournalSchema = z.discriminatedUnion("phase", [
    z.object({ version: z.literal(2), phase: z.literal("unresolved") }),
    z.object({
        version: z.literal(2),
        phase: z.literal("claimed"),
        ownerAccountId: z.string(),
        draftsRaw: z.string().nullable().optional(),
        queueRaw: z.string().nullable().optional(),
    }),
    z.object({
        version: z.literal(2),
        phase: z.literal("verified"),
        ownerAccountId: z.string(),
        draftsRaw: z.string().nullable(),
        queueRaw: z.string().nullable(),
    }),
]);

type LegacyJournal = z.infer<typeof LegacyJournalSchema>;

export interface LegacyMigrationTarget {
    contains(key: string): boolean;
    getString(key: string): string | undefined;
    set(key: string, value: string): void;
    remove(key: string): boolean;
}

export class YeeLegacyMigrationError extends Error {
    readonly key: string;

    constructor(message: string, key: string, options?: { readonly cause?: unknown }) {
        super(message, options);
        this.name = "YeeLegacyMigrationError";
        this.key = key;
    }
}

let migrationChain: Promise<void> = Promise.resolve();

function runMigrationExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = migrationChain.then(operation);
    migrationChain = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}

export async function prepareLegacyMigrationOwner(accountId: string | null): Promise<void> {
    await runMigrationExclusive(async () => {
        if ((await readJournal()) !== null) {
            return;
        }
        const journal: LegacyJournal =
            accountId === null
                ? { version: 2, phase: "unresolved" }
                : { version: 2, phase: "claimed", ownerAccountId: accountId };
        await writeJournal(journal);
    });
}

export async function isLegacyMigrationOwner(accountId: string): Promise<boolean> {
    const journal = await readJournal();
    return (
        journal !== null && journal.phase !== "unresolved" && journal.ownerAccountId === accountId
    );
}

export async function migrateLegacyDraftStorage(
    accountId: string,
    target: LegacyMigrationTarget,
): Promise<void> {
    await runMigrationExclusive(async () => {
        if (target.contains(ACCOUNT_OWNERSHIP_MARKER)) {
            return;
        }

        const sourceDrafts = await readSource(LEGACY_DRAFTS_KEY);
        const sourceQueue = await readSource(LEGACY_QUEUE_KEY);
        let journal = await readJournal();
        if (journal === null) {
            if (sourceDrafts === null && sourceQueue === null) {
                target.set(ACCOUNT_OWNERSHIP_MARKER, new Date().toISOString());
                return;
            }
            throw new YeeLegacyMigrationError(
                "Legacy offline work has no verified account owner.",
                JOURNAL_KEY,
            );
        }
        if (journal.phase === "unresolved") {
            if (sourceDrafts !== null || sourceQueue !== null) {
                throw new YeeLegacyMigrationError(
                    "Legacy offline work requires account recovery before it can be loaded.",
                    JOURNAL_KEY,
                );
            }
            target.set(ACCOUNT_OWNERSHIP_MARKER, new Date().toISOString());
            return;
        }

        const draftsRaw = journal.draftsRaw ?? sourceDrafts;
        const queueRaw = journal.queueRaw ?? sourceQueue;
        const drafts = parseDrafts(draftsRaw);
        const queue = parseQueue(queueRaw);
        if (journal.phase === "claimed" && journal.draftsRaw === undefined) {
            journal = {
                version: 2,
                phase: "claimed",
                ownerAccountId: journal.ownerAccountId,
                draftsRaw,
                queueRaw,
            };
            await writeJournal(journal);
        }

        if (journal.ownerAccountId !== accountId) {
            removeExactLegacyCopies(target, drafts, queue);
            target.set(ACCOUNT_OWNERSHIP_MARKER, new Date().toISOString());
            return;
        }

        copyOwnerRecords(target, drafts, queue);
        verifyOwnerRecords(target, drafts, queue);
        await writeJournal({
            version: 2,
            phase: "verified",
            ownerAccountId: accountId,
            draftsRaw,
            queueRaw,
        });
        target.set(ACCOUNT_MIGRATION_MARKER, new Date().toISOString());
        target.set(ACCOUNT_OWNERSHIP_MARKER, new Date().toISOString());
    });
}

function parseDrafts(raw: string | null): ReadonlyMap<string, string> {
    if (raw === null) {
        return new Map();
    }
    const parsed = parseJson(raw, LEGACY_DRAFTS_KEY, LegacyDraftMapSchema);
    const entries: [string, string][] = [];
    for (const draft of Object.values(parsed)) {
        const placeId = draft.placeId;
        if (typeof placeId !== "string") {
            throw new YeeLegacyMigrationError(
                "Legacy draft is missing its place id.",
                LEGACY_DRAFTS_KEY,
            );
        }
        entries.push([`draft.${placeId}`, JSON.stringify(draft)]);
    }
    return new Map(entries);
}

function parseQueue(raw: string | null): ReadonlyMap<string, string> {
    if (raw === null) {
        return new Map();
    }
    const parsed = parseJson(raw, LEGACY_QUEUE_KEY, LegacyQueueSchema);
    const entries: [string, string][] = [];
    for (const item of parsed) {
        const id = item.id;
        if (typeof id !== "string") {
            throw new YeeLegacyMigrationError(
                "Legacy queue item is missing its id.",
                LEGACY_QUEUE_KEY,
            );
        }
        entries.push([`queue.${id}`, JSON.stringify(item)]);
    }
    return new Map(entries);
}

function copyOwnerRecords(
    target: LegacyMigrationTarget,
    drafts: ReadonlyMap<string, string>,
    queue: ReadonlyMap<string, string>,
): void {
    for (const [key, value] of [...drafts, ...queue]) {
        const existing = target.getString(key);
        if (existing !== undefined && existing !== value) {
            throw new YeeLegacyMigrationError(`Legacy migration conflicts with "${key}".`, key);
        }
        if (existing === undefined) {
            target.set(key, value);
        }
    }
}

function verifyOwnerRecords(
    target: LegacyMigrationTarget,
    drafts: ReadonlyMap<string, string>,
    queue: ReadonlyMap<string, string>,
): void {
    for (const [key, value] of [...drafts, ...queue]) {
        if (target.getString(key) !== value) {
            throw new YeeLegacyMigrationError(`Legacy migration could not verify "${key}".`, key);
        }
    }
}

function removeExactLegacyCopies(
    target: LegacyMigrationTarget,
    drafts: ReadonlyMap<string, string>,
    queue: ReadonlyMap<string, string>,
): void {
    for (const [key, value] of [...drafts, ...queue]) {
        if (target.getString(key) === value) {
            target.remove(key);
        }
    }
}

async function readJournal(): Promise<LegacyJournal | null> {
    const raw = await readSource(JOURNAL_KEY);
    return raw === null ? null : parseJson(raw, JOURNAL_KEY, LegacyJournalSchema);
}

async function writeJournal(journal: LegacyJournal): Promise<void> {
    const serialized = JSON.stringify(journal);
    try {
        await AsyncStorage.setItem(JOURNAL_KEY, serialized);
        if ((await AsyncStorage.getItem(JOURNAL_KEY)) !== serialized) {
            throw new YeeLegacyMigrationError("Legacy owner journal was not durable.", JOURNAL_KEY);
        }
    } catch (error) {
        if (error instanceof YeeLegacyMigrationError) {
            throw error;
        }
        throw new YeeLegacyMigrationError("Could not persist legacy owner journal.", JOURNAL_KEY, {
            cause: error,
        });
    }
}

async function readSource(key: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(key);
    } catch (error) {
        throw new YeeLegacyMigrationError(`Could not read legacy storage "${key}".`, key, {
            cause: error,
        });
    }
}

function parseJson<T>(raw: string, key: string, schema: z.ZodType<T>): T {
    try {
        return schema.parse(JSON.parse(raw));
    } catch (error) {
        throw new YeeLegacyMigrationError(`Corrupt persisted payload for "${key}".`, key, {
            cause: error,
        });
    }
}
