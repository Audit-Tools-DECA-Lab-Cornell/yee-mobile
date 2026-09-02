import { beforeEach, describe, expect, it } from "vitest";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { prepareLegacyMigrationOwner } from "lib/yee-legacy-draft-migration";
import {
    readAssignedPlacesCache,
    readSubmittedAuditsCache,
    writeAssignedPlacesCache,
    writeSubmittedAuditsCache,
} from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import type { YeeAssignedPlace, YeeMyAuditItem } from "lib/yee-types";

const LEGACY_PLACES_KEY = "yee.mobile.assigned-places.v1";

const placeA: YeeAssignedPlace = {
    id: "place-a",
    name: "A",
    project: "YEE",
    address: "",
    audits: 0,
};

const auditA: YeeMyAuditItem = {
    id: "audit-a",
    place_id: "place-a",
    place_name: "A",
    submitted_at: "2026-09-01T00:00:00.000Z",
    total_score: 1,
};

beforeEach(async () => {
    await AsyncStorage.clear();
    setActiveAccount(null);
});

describe("account-scoped remote caches", () => {
    it("keeps writes isolated between accounts", async () => {
        setActiveAccount("cache-a");
        await writeAssignedPlacesCache([placeA]);
        await writeSubmittedAuditsCache([auditA]);

        setActiveAccount("cache-b");
        expect(await readAssignedPlacesCache()).toEqual([]);
        expect(await readSubmittedAuditsCache()).toEqual([]);
    });

    it("allows only the restored legacy owner to import the global cache", async () => {
        await AsyncStorage.setItem(LEGACY_PLACES_KEY, JSON.stringify([placeA]));
        await prepareLegacyMigrationOwner("cache-legacy-owner");

        setActiveAccount("cache-legacy-owner");
        expect(await readAssignedPlacesCache()).toEqual([placeA]);

        setActiveAccount("cache-other");
        expect(await readAssignedPlacesCache()).toEqual([]);
    });
});
