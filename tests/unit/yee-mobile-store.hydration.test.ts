/**
 * The hydration flag the queue drain gates on, and why it is not `status`.
 *
 * Gating the drain on the store's `status` put the app into a request storm:
 * `refreshRemoteState` moves `status` "ready" -> "loading" -> "ready", and the
 * drain effect calls that refresh, so the gate re-enabled itself on every pass
 * and the app hit the backend continuously from the home screen.
 *
 * `hasLoadedOfflineState` exists to be the value that cannot do that. These
 * tests assert the property directly — that a refresh never moves it — rather
 * than the symptom, which only appears in a rendered React tree.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import { useYeeMobileStore } from "stores/yee-mobile-store";

vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        fetchAssignedPlaces: () => Promise.resolve([]),
        fetchMyAudits: () => Promise.resolve([]),
        fetchYeeInstrument: () => Promise.resolve({}),
    };
});

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

let accountSeq = 0;
beforeEach(() => {
    accountSeq += 1;
    setActiveAccount(`hydration-acct-${accountSeq}`);
    useYeeMobileStore.setState({ hasLoadedOfflineState: false, status: "idle" });
});

describe("hasLoadedOfflineState", () => {
    it("starts false, so the queue is never drained before it is read off disk", () => {
        expect(useYeeMobileStore.getState().hasLoadedOfflineState).toBe(false);
    });

    it("is set once hydration finishes", async () => {
        await useYeeMobileStore.getState().hydrateOfflineState();
        expect(useYeeMobileStore.getState().hasLoadedOfflineState).toBe(true);
    });

    it("is NEVER cleared by a remote refresh, at any point during it", async () => {
        await useYeeMobileStore.getState().hydrateOfflineState();

        const observed: boolean[] = [];
        const unsubscribe = useYeeMobileStore.subscribe((state) => {
            observed.push(state.hasLoadedOfflineState);
        });
        await useYeeMobileStore.getState().refreshRemoteState(makeSession());
        unsubscribe();

        // The refresh must have emitted at least once, or this proves nothing.
        expect(observed.length).toBeGreaterThan(0);
        expect(observed).not.toContain(false);
        expect(useYeeMobileStore.getState().hasLoadedOfflineState).toBe(true);
    });

    it("status DOES toggle during a refresh, which is exactly why the gate cannot use it", async () => {
        await useYeeMobileStore.getState().hydrateOfflineState();
        expect(useYeeMobileStore.getState().status).toBe("ready");

        const observed: string[] = [];
        const unsubscribe = useYeeMobileStore.subscribe((state) => {
            observed.push(state.status);
        });
        await useYeeMobileStore.getState().refreshRemoteState(makeSession());
        unsubscribe();

        // "ready" -> "loading" -> "ready". An effect gated on this while also
        // calling the refresh re-enables itself forever.
        expect(observed).toContain("loading");
        expect(observed).toContain("ready");
    });
});
