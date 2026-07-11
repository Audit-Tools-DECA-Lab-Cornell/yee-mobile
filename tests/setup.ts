import { vi } from "vitest";

// ---------------------------------------------------------------------------
// expo-secure-store mock
// Backed by an in-memory Map so tests can read what was written.
// ---------------------------------------------------------------------------
const secureStoreMap = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
    isAvailableAsync: async () => true,
    getItemAsync: async (key: string) => secureStoreMap.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
        secureStoreMap.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
        secureStoreMap.delete(key);
    },
}));

// ---------------------------------------------------------------------------
// react-native-mmkv mock
// Tiny in-memory Map-backed stub matching the MMKV v4 API surface used in tests.
//
// MMKV v4 exposes `createMMKV({ id })` returning an instance with
// `set / getString / contains / remove / getAllKeys / clearAll`. Each distinct
// `id` gets its own backing store so per-account isolation can be tested.
// The maps persist for the whole test process so a "reopen" (a second
// createMMKV call with the same id) sees previously written data, mirroring
// real on-disk durability across app restarts.
// ---------------------------------------------------------------------------
const mmkvStoresById = new Map<string, Map<string, string>>();

class MMKVStub {
    private readonly store: Map<string, string>;

    constructor(id: string) {
        const existing = mmkvStoresById.get(id);
        if (existing === undefined) {
            this.store = new Map<string, string>();
            mmkvStoresById.set(id, this.store);
        } else {
            this.store = existing;
        }
    }

    getString(key: string): string | undefined {
        return this.store.get(key);
    }

    set(key: string, value: string): void {
        this.store.set(key, value);
    }

    remove(key: string): boolean {
        return this.store.delete(key);
    }

    getAllKeys(): string[] {
        return [...this.store.keys()];
    }

    contains(key: string): boolean {
        return this.store.has(key);
    }

    clearAll(): void {
        this.store.clear();
    }
}

vi.mock("react-native-mmkv", () => ({
    createMMKV: ({ id }: { id: string }) => new MMKVStub(id),
    __mmkvStoresById: mmkvStoresById,
}));

// ---------------------------------------------------------------------------
// @react-native-async-storage/async-storage mock
// Backed by an in-memory Map so tests can simulate AsyncStorage reads/writes.
// ---------------------------------------------------------------------------
const asyncStorageMap = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: async (key: string) => asyncStorageMap.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            asyncStorageMap.set(key, value);
        },
        removeItem: async (key: string) => {
            asyncStorageMap.delete(key);
        },
        clear: async () => {
            asyncStorageMap.clear();
        },
        getAllKeys: async () => [...asyncStorageMap.keys()],
        multiGet: async (keys: string[]) =>
            keys.map((key) => [key, asyncStorageMap.get(key) ?? null] as [string, string | null]),
    },
    __asyncStorageMap: asyncStorageMap,
}));

// ---------------------------------------------------------------------------
// expo-application / expo-device mocks
// Deterministic device identity so lib/device-identity.ts is testable in Node.
// getAndroidId throws (as on iOS) so tests exercise the vendor-ID fallback.
// ---------------------------------------------------------------------------
vi.mock("expo-application", () => ({
    getAndroidId: () => {
        throw new Error("getAndroidId is unavailable in tests");
    },
    getIosIdForVendorAsync: async () => "test-vendor-id",
}));

vi.mock("expo-device", () => ({
    modelName: "Test Tablet",
}));

// ---------------------------------------------------------------------------
// @react-native-community/netinfo mock
// Returns a default "online" state that tests can override via the exported getter.
// ---------------------------------------------------------------------------
vi.mock("@react-native-community/netinfo", () => ({
    default: {
        fetch: async () => ({ isConnected: true, isInternetReachable: true }),
        addEventListener: () => () => undefined,
    },
}));
