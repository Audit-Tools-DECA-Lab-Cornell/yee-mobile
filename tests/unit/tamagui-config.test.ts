import { describe, expect, it } from "vitest";
import { config } from "../../tamagui.config";

describe("Tamagui config", () => {
    it("registers the React Native animation driver used by animated components", () => {
        const configuredAnimationDriver = config.animations;
        const resolvedDriverIsStub = configuredAnimationDriver?.isStub;

        expect(resolvedDriverIsStub).not.toBe(true);
        expect(configuredAnimationDriver?.animations).toHaveProperty("quick");
    });
});
