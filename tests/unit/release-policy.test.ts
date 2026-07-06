import { describe, expect, it } from "vitest";

import {
    compareAppVersions,
    evaluateReleasePolicy,
    type MobileReleasePolicyResponse,
} from "lib/release-policy-core";

const policy: MobileReleasePolicyResponse = {
    product: "yee",
    message: "Install the latest YEE app.",
    android: {
        latest_version: "0.6.2",
        minimum_supported_version: "0.6.2",
        latest_build: 18,
        minimum_supported_build: 17,
        update_url: "https://play.google.com/store/apps/details?id=test",
    },
    ios: {
        latest_version: "0.6.2",
        minimum_supported_version: "0.6.2",
        latest_build: null,
        minimum_supported_build: null,
        update_url: "https://apps.apple.com/app/test/id1",
    },
};

describe("release policy", () => {
    it("blocks Android builds below the minimum supported build", () => {
        const decision = evaluateReleasePolicy(policy, {
            platform: "android",
            version: "0.6.2",
            buildNumber: "16",
        });

        expect(decision.shouldBlock).toBe(true);
        expect(decision.reason).toBe("build");
    });

    it("blocks versions below the minimum supported version", () => {
        const decision = evaluateReleasePolicy(policy, {
            platform: "ios",
            version: "0.6.1",
            buildNumber: null,
        });

        expect(decision.shouldBlock).toBe(true);
        expect(decision.reason).toBe("version");
    });

    it("allows the current minimum version and build", () => {
        const decision = evaluateReleasePolicy(policy, {
            platform: "android",
            version: "0.6.2",
            buildNumber: "17",
        });

        expect(decision.shouldBlock).toBe(false);
    });

    it("compares dotted app versions numerically", () => {
        expect(compareAppVersions("0.6.10", "0.6.2")).toBe(1);
        expect(compareAppVersions("0.6.1", "0.6.2")).toBe(-1);
        expect(compareAppVersions("0.6.2", "0.6.2")).toBe(0);
    });
});
