/**
 * Action-level tests for the audit session store (Mobile performance plan).
 *
 * These prove the core "navigation feels instant" invariants WITHOUT a React
 * render harness (the vitest env is node): every assertion drives the store
 * actions directly, exactly as the audit shell's Next / Home / Save&Exit /
 * AppState-background / reconnect handlers do.
 *
 * What is pinned here:
 *   - the split commit paths — local MMKV is the only blocking write; the remote
 *     draft mirror is fire-and-forget and NEVER awaited by navigation,
 *   - dirty tracking — a no-op answer tap does not mark the draft dirty,
 *   - autosave debounces a burst of edits into a single local write,
 *   - read-only (submitted) sessions never write, enqueue, or drain,
 *   - presence/condition answer actions write only their exact backend bindings,
 *   - the remote refresh never clobbers local truth (loadPlaceAuditState guard
 *     that backgroundRefresh delegates to).
 *
 * The store pulls in heavy RN modules; tests/setup.ts mocks them. We additionally
 * mock lib/yee-api so instrument/draft/audit-state network calls are deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";
import { buildFormStateFromSources, type MobileAuditFormState } from "lib/yee-mobile-draft";
import type { InstrumentLogicalQuestion } from "lib/yee-mobile-instrument";
import { readDraft, readSyncQueue, writeInstrumentCache } from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import type {
    YeeAssignedPlace,
    YeeAuditStateResponse,
    YeeInstrumentResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSubmissionResponse,
} from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";
import { useAuditSessionStore } from "stores/yee-audit-session-store";

// --- Mock the API layer -----------------------------------------------------
// vi.mock is hoisted above the imports, so the mocks are in place before the
// stores under test resolve lib/yee-api.
const saveAuditDraftMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const submitAuditMock = vi.fn<(...args: unknown[]) => Promise<YeeSubmissionResponse>>();
const fetchYeeInstrumentMock = vi.fn<(...args: unknown[]) => Promise<YeeInstrumentResponse>>();
const fetchAuditStateMock = vi.fn<(...args: unknown[]) => Promise<YeeAuditStateResponse>>();
const fetchMyAuditsMock = vi.fn<(...args: unknown[]) => Promise<readonly YeeMyAuditItem[]>>();
const fetchAssignedPlacesMock =
    vi.fn<(...args: unknown[]) => Promise<readonly YeeAssignedPlace[]>>();

vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        saveAuditDraft: (...args: unknown[]) => saveAuditDraftMock(...args),
        submitAudit: (...args: unknown[]) => submitAuditMock(...args),
        fetchYeeInstrument: (...args: unknown[]) => fetchYeeInstrumentMock(...args),
        fetchAuditState: (...args: unknown[]) => fetchAuditStateMock(...args),
        fetchMyAudits: (...args: unknown[]) => fetchMyAuditsMock(...args),
        fetchAssignedPlaces: (...args: unknown[]) => fetchAssignedPlacesMock(...args),
    };
});

// --- Fixtures ---------------------------------------------------------------

function makeSession(): AuthSession {
    return {
        accessToken: "token-123",
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
            id: "auditor-1",
            email: "a@b.com",
            name: "A",
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
    };
}

function makeFormState(
    placeId: string,
    overrides: Partial<MobileAuditFormState> = {},
): MobileAuditFormState {
    return {
        ...buildFormStateFromSources({ placeId, placeName: "Place", auditorId: "AUDITOR" }),
        ...overrides,
    };
}

function makeLocalDraft(placeId: string, version = 1): YeeLocalDraft {
    const iso = "2026-06-25T00:00:00.000Z";
    return {
        id: placeId,
        schemaVersion: 1,
        version,
        placeId,
        updatedAt: iso,
        lastUpdatedIso: iso,
        participantInfo: { place_id: placeId },
        responses: { item1: { c1: "a1" } },
        lastKnownBackendStatus: "DRAFT",
        lastKnownSubmissionId: null,
        scorePreview: null,
        syncState: "local_only",
    };
}

function makeRemoteDraftState(placeId: string): YeeAuditStateResponse {
    return {
        audit_id: null,
        submission_id: null,
        place_id: placeId,
        place_name: "Place",
        auditor_generated_id: "AUDITOR",
        status: "DRAFT",
        submitted_at: null,
        // Deliberately different from the local draft so a clobber is detectable.
        participant_info: { place_id: placeId },
        responses: { remoteItem: { rc1: "remote-answer" } },
        score: null,
    };
}

const INSTRUMENT_FIXTURE: YeeInstrumentResponse = {
    sections: [{ block: "Access", title: "Access", intro_text: "", comment_prompt: "" }],
    scoring_items: [],
} as unknown as YeeInstrumentResponse;

function binaryQuestion(
    overrides: Partial<InstrumentLogicalQuestion> = {},
): InstrumentLogicalQuestion {
    return {
        key: "p1:c1",
        choiceId: "c1",
        prompt: "Bench present?",
        presenceItemId: "p1",
        presenceAnswers: [
            { id: "1", label: "Yes" },
            { id: "0", label: "No" },
        ],
        conditionItemId: "cond1",
        conditionAnswers: [
            { id: "2", label: "Good" },
            { id: "3", label: "Poor" },
        ],
        ...overrides,
    };
}

// --- Harness ----------------------------------------------------------------

let accountSeq = 0;
function freshAccount(): void {
    accountSeq += 1;
    setActiveAccount(`session-acct-${accountSeq}`);
}

/** Reset both stores + the session store's module-level dirty counters. */
function resetStores(): void {
    useYeeMobileStore.setState({
        status: "ready",
        isOnline: true,
        assignedPlaces: [],
        submittedAudits: [],
        draftsByPlace: {},
        syncQueue: [],
        errorMessage: null,
    });
    useAuthStore.setState({ session: null });
    // Neutralize any draft so close() has nothing to flush, then let close() reset
    // the module dirty counters (draftRevision / lastPersistedRevision) and cancel
    // any pending autosave timer from a previous test.
    useAuditSessionStore.setState({ draft: null, readOnly: false, hasLocalEdits: false });
    useAuditSessionStore.getState().close();
}

/**
 * Seed an editable, ready-to-act session directly (no async open()). loadPhase is
 * left NON-"ready" so the debounced-autosave subscription stays dormant except in
 * the tests that explicitly opt into it — keeping every other test deterministic.
 */
function seedEditable(form: MobileAuditFormState): void {
    useAuditSessionStore.setState({
        placeId: form.placeId,
        draft: form,
        instrument: null,
        step: 1,
        loadPhase: "loading",
        readOnly: false,
        saveStatus: "idle",
        hasLocalEdits: false,
        errorMessage: null,
    });
}

interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

// Track deferreds so a failed assertion can never leave the serialized queue
// chain wedged (a stuck drain would hang every later test in this file).
const openDeferreds: Deferred<YeeAuditStateResponse>[] = [];

beforeEach(() => {
    saveAuditDraftMock.mockReset();
    submitAuditMock.mockReset();
    fetchYeeInstrumentMock.mockReset();
    fetchAuditStateMock.mockReset();
    fetchMyAuditsMock.mockReset();
    fetchAssignedPlacesMock.mockReset();
    fetchYeeInstrumentMock.mockResolvedValue(INSTRUMENT_FIXTURE);
    fetchMyAuditsMock.mockResolvedValue([]);
    fetchAssignedPlacesMock.mockResolvedValue([]);
    openDeferreds.length = 0;
    freshAccount();
    resetStores();
});

afterEach(async () => {
    // Free any still-pending background drain so the serialized chain unwedges.
    for (const d of openDeferreds) {
        d.resolve({ status: "DRAFT", submission_id: null, score: null } as YeeAuditStateResponse);
    }
    await Promise.resolve();
    vi.useRealTimers();
});

describe("commit paths — local blocks, remote mirror never does", () => {
    it("commitAndQueueRemote resolves WITHOUT awaiting a hanging remote draft PUT", async () => {
        const session = makeSession();
        useAuthStore.setState({ session });
        useYeeMobileStore.setState({ isOnline: true });

        // The remote mirror hangs forever; navigation must not wait on it.
        const hanging = deferred<YeeAuditStateResponse>();
        openDeferreds.push(hanging);
        saveAuditDraftMock.mockReturnValue(hanging.promise);

        seedEditable(makeFormState("place-1"));

        // If commitAndQueueRemote awaited the PUT, this await would hang the test.
        await useAuditSessionStore.getState().commitAndQueueRemote();

        // Durable local commit + one enqueued mirror happened synchronously enough
        // that the caller already returned while the PUT is still in flight.
        expect(await readDraft("place-1")).not.toBeNull();
        const queue = await readSyncQueue();
        expect(queue.some((item) => item.id === "draft-place-1")).toBe(true);
        expect(useAuditSessionStore.getState().saveStatus).toBe("syncing");
        expect(saveAuditDraftMock).toHaveBeenCalledTimes(1); // drain runs in background

        // Free the background drain for a clean teardown.
        hanging.resolve({
            status: "DRAFT",
            submission_id: null,
            score: null,
        } as YeeAuditStateResponse);
        await useYeeMobileStore.getState().syncPendingQueue(session);
    });

    it("commitAndQueueRemote offline enqueues the mirror and marks 'queued' without a network call", async () => {
        useAuthStore.setState({ session: makeSession() });
        useYeeMobileStore.setState({ isOnline: false });
        seedEditable(makeFormState("place-1"));

        await useAuditSessionStore.getState().commitAndQueueRemote();

        expect(await readDraft("place-1")).not.toBeNull();
        expect((await readSyncQueue()).some((item) => item.id === "draft-place-1")).toBe(true);
        expect(useAuditSessionStore.getState().saveStatus).toBe("queued");
        expect(saveAuditDraftMock).not.toHaveBeenCalled();
    });

    it("commitAndQueueRemote with no session saves locally only (no queue item, no network)", async () => {
        useAuthStore.setState({ session: null });
        useYeeMobileStore.setState({ isOnline: true });
        seedEditable(makeFormState("place-1"));

        await useAuditSessionStore.getState().commitAndQueueRemote();

        expect((await readDraft("place-1"))?.syncState).toBe("local_only");
        expect(await readSyncQueue()).toHaveLength(0);
        expect(useAuditSessionStore.getState().saveStatus).toBe("saved_local");
        expect(saveAuditDraftMock).not.toHaveBeenCalled();
    });

    it("commitLocalOnly (autosave path) writes locally with no remote mirror enqueued", async () => {
        useAuthStore.setState({ session: makeSession() });
        seedEditable(makeFormState("place-1"));

        // A real edit is required for commitLocalOnly to have unpersisted work.
        useAuditSessionStore.getState().setSeason("summer");
        await useAuditSessionStore.getState().commitLocalOnly();

        expect((await readDraft("place-1"))?.syncState).toBe("local_only");
        expect(await readSyncQueue()).toHaveLength(0);
        expect(useAuditSessionStore.getState().saveStatus).toBe("saved_local");
    });
});

describe("dirty tracking — no-op taps do not create work", () => {
    it("a no-op answer tap leaves the draft clean; a real edit marks it dirty", async () => {
        seedEditable(makeFormState("place-1", { season: "summer" }));
        const before = useAuditSessionStore.getState().draft;

        // Setting the SAME value must be a true no-op: same draft reference, not dirty.
        useAuditSessionStore.getState().setSeason("summer");
        expect(useAuditSessionStore.getState().draft).toBe(before);
        expect(useAuditSessionStore.getState().hasLocalEdits).toBe(false);

        // And because nothing is dirty, a local commit persists nothing.
        await useAuditSessionStore.getState().commitLocalOnly();
        expect(await readDraft("place-1")).toBeNull();

        // A genuine change flips dirty and swaps the draft reference.
        useAuditSessionStore.getState().setSeason("winter");
        expect(useAuditSessionStore.getState().draft).not.toBe(before);
        expect(useAuditSessionStore.getState().hasLocalEdits).toBe(true);
    });

    it("debounced autosave collapses a burst of edits into a single local write", async () => {
        vi.useFakeTimers();
        useAuthStore.setState({ session: makeSession() });

        // Seed with loadPhase transitioning to "ready" WITHOUT a draft-identity
        // change on the ready transition, so the subscription only schedules from
        // the burst edits below — not from setup.
        useAuditSessionStore.setState({
            placeId: "place-1",
            draft: makeFormState("place-1"),
            instrument: null,
            step: 1,
            loadPhase: "loading",
            readOnly: false,
            hasLocalEdits: false,
        });
        useAuditSessionStore.setState({ loadPhase: "ready" });
        expect(vi.getTimerCount()).toBe(0);

        // Burst of edits: each reschedules the single debounced timer.
        useAuditSessionStore.getState().setSeason("a");
        useAuditSessionStore.getState().setSeason("b");
        useAuditSessionStore.getState().setVisitFrequency("weekly");
        expect(vi.getTimerCount()).toBe(1); // exactly one write pending, not three

        const saveSpy = vi.spyOn(useYeeMobileStore.getState(), "saveDraftLocally");
        await vi.runOnlyPendingTimersAsync();

        expect(saveSpy).toHaveBeenCalledTimes(1);
        const persisted = await readDraft("place-1");
        expect(persisted?.participantInfo.season).toBe("b");
        expect(persisted?.participantInfo.visit_frequency).toBe("weekly");
    });
});

describe("read-only (submitted) session — inert", () => {
    it("performs no local write, no enqueue, and no network on any action", async () => {
        useAuthStore.setState({ session: makeSession() });
        useYeeMobileStore.setState({ isOnline: true });
        useAuditSessionStore.setState({
            placeId: "place-1",
            draft: makeFormState("place-1", { season: "summer" }),
            instrument: null,
            step: 1,
            loadPhase: "ready",
            readOnly: true,
            hasLocalEdits: false,
        });
        const before = useAuditSessionStore.getState().draft;

        // Setters are no-ops in read-only mode.
        useAuditSessionStore.getState().setSeason("winter");
        useAuditSessionStore.getState().setPresenceAnswer(binaryQuestion(), "0");
        useAuditSessionStore.getState().setConditionAnswer(binaryQuestion(), "2");
        expect(useAuditSessionStore.getState().draft).toBe(before);
        expect(useAuditSessionStore.getState().hasLocalEdits).toBe(false);

        // Neither commit path writes or enqueues anything for a view-only audit.
        await useAuditSessionStore.getState().commitAndQueueRemote();
        await useAuditSessionStore.getState().commitLocalOnly();

        expect(await readDraft("place-1")).toBeNull();
        expect(await readSyncQueue()).toHaveLength(0);
        expect(saveAuditDraftMock).not.toHaveBeenCalled();
    });
});

describe("question answer bindings", () => {
    it("setPresenceAnswer writes only the primary item and choice binding", () => {
        const responses = {
            p1: { sibling: "existing" },
            cond1: { c1: "good", sibling: "poor" },
            unrelated: { choice: "answer" },
        };
        seedEditable(makeFormState("place-1", { responses }));

        useAuditSessionStore.getState().setPresenceAnswer(binaryQuestion(), "1");

        expect(useAuditSessionStore.getState().draft?.responses).toEqual({
            p1: { sibling: "existing", c1: "1" },
            cond1: { c1: "good", sibling: "poor" },
            unrelated: { choice: "answer" },
        });
    });

    it("setConditionAnswer writes only the condition item and choice binding", () => {
        const responses = {
            p1: { c1: "1", sibling: "0" },
            cond1: { sibling: "poor" },
            unrelated: { choice: "answer" },
        };
        seedEditable(makeFormState("place-1", { responses }));

        useAuditSessionStore.getState().setConditionAnswer(binaryQuestion(), "2");

        expect(useAuditSessionStore.getState().draft?.responses).toEqual({
            p1: { c1: "1", sibling: "0" },
            cond1: { sibling: "poor", c1: "2" },
            unrelated: { choice: "answer" },
        });
    });

    it("changing affirmative to non-affirmative keeps an exact empty condition binding", () => {
        const responses = {
            p1: { c1: "1", sibling: "1" },
            cond1: { c1: "good", sibling: "poor" },
            unrelated: { choice: "answer" },
        };
        seedEditable(makeFormState("place-1", { responses }));

        useAuditSessionStore.getState().setPresenceAnswer(binaryQuestion(), "0");

        expect(useAuditSessionStore.getState().draft?.responses).toEqual({
            p1: { c1: "0", sibling: "1" },
            cond1: { c1: "", sibling: "poor" },
            unrelated: { choice: "answer" },
        });
    });

    it("hydrates stored negative and empty bindings byte-equivalently before an unrelated edit", () => {
        const responses = {
            "manual-presence": { manual: "0" },
            "bulk-presence": { bulk: "0" },
            "condition-item": { affirmative: "" },
            "unrelated-item": { stable: "answer" },
        };
        const storedDraft = { ...makeLocalDraft("place-1"), responses };
        const hydrated = buildFormStateFromSources({
            placeId: "place-1",
            placeName: "Place",
            auditorId: "AUDITOR",
            storedDraft,
        });

        expect(hydrated.responses).toEqual(responses);
        expect(JSON.stringify(hydrated.responses)).toBe(JSON.stringify(responses));

        seedEditable(hydrated);
        useAuditSessionStore.getState().setPresenceAnswer(
            binaryQuestion({
                key: "new-presence:new-choice",
                presenceItemId: "new-presence",
                choiceId: "new-choice",
                conditionItemId: null,
                conditionAnswers: [],
            }),
            "1",
        );

        expect(useAuditSessionStore.getState().draft?.responses).toEqual({
            ...responses,
            "new-presence": { "new-choice": "1" },
        });
        expect(responses).toEqual({
            "manual-presence": { manual: "0" },
            "bulk-presence": { bulk: "0" },
            "condition-item": { affirmative: "" },
            "unrelated-item": { stable: "answer" },
        });
    });
});

describe("remote refresh never clobbers local truth (loadPlaceAuditState guard)", () => {
    it("hydrates a remote DRAFT into local storage when there is nothing unsynced to lose", async () => {
        const session = makeSession();
        fetchAuditStateMock.mockResolvedValue(makeRemoteDraftState("place-1"));

        const state = await useYeeMobileStore.getState().loadPlaceAuditState("place-1", session);

        expect(state.status).toBe("DRAFT");
        const hydrated = await readDraft("place-1");
        expect(hydrated).not.toBeNull();
        expect(hydrated?.syncState).toBe("synced");
        expect(hydrated?.responses).toEqual({ remoteItem: { rc1: "remote-answer" } });
    });

    it("does NOT overwrite a local unsynced draft with the remote mirror (local wins)", async () => {
        const session = makeSession();
        // Local, unsynced work exists on device.
        await useYeeMobileStore.getState().saveDraftLocally(makeLocalDraft("place-1"));
        fetchAuditStateMock.mockResolvedValue(makeRemoteDraftState("place-1"));

        await useYeeMobileStore.getState().loadPlaceAuditState("place-1", session);

        const local = await readDraft("place-1");
        expect(local?.syncState).toBe("local_only"); // untouched
        expect(local?.responses).toEqual({ item1: { c1: "a1" } }); // local content preserved
    });

    it("does NOT overwrite when a pending queue item exists, even if the draft is 'synced'", async () => {
        const session = makeSession();
        // Enqueue a mirror (adds the queue item)...
        await useYeeMobileStore.getState().queueDraftSync(makeLocalDraft("place-1", 2));
        // ...then restore the on-disk draft to a fully `synced` state so ONLY the
        // pending queue item (not an unsynced draft) can trip the guard.
        await useYeeMobileStore.getState().saveDraftLocally({
            ...makeLocalDraft("place-1"),
            syncState: "synced",
        });
        expect((await readDraft("place-1"))?.syncState).toBe("synced");
        fetchAuditStateMock.mockResolvedValue(makeRemoteDraftState("place-1"));

        await useYeeMobileStore.getState().loadPlaceAuditState("place-1", session);

        const local = await readDraft("place-1");
        expect(local?.responses).toEqual({ item1: { c1: "a1" } }); // remote ignored
    });

    it("backgroundRefresh via open() preserves local edits and still reaches the remote fetch", async () => {
        const session = makeSession();
        useAuthStore.setState({ session });
        useYeeMobileStore.setState({ isOnline: true });
        await writeInstrumentCache(INSTRUMENT_FIXTURE);

        // Local pending work: a saved draft + a queued mirror => the guard must win.
        await useYeeMobileStore.getState().saveDraftLocally(makeLocalDraft("place-1"));
        await useYeeMobileStore.getState().queueDraftSync(makeLocalDraft("place-1"));
        fetchAuditStateMock.mockResolvedValue(makeRemoteDraftState("place-1"));

        await useAuditSessionStore.getState().open("place-1", { place: null });
        // Let the fire-and-forget backgroundRefresh run to completion.
        await new Promise((resolve) => setTimeout(resolve, 20));
        await new Promise((resolve) => setTimeout(resolve, 20));

        // It reached the remote fetch (anti false-pass) but local content still wins.
        expect(fetchAuditStateMock).toHaveBeenCalledWith("place-1", session);
        const draft = useAuditSessionStore.getState().draft;
        expect(draft?.responses.item1?.c1).toBe("a1");
        expect(draft?.responses.remoteItem).toBeUndefined();
    });
});
