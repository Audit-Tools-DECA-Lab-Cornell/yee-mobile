import { describe, expect, it } from "vitest";

import { resolveScreenshotScrollAutomationParams } from "lib/screenshot-automation-params";

describe("resolveScreenshotScrollAutomationParams", () => {
    it("parses scroll offsets and custom delays from route params", () => {
        const result = resolveScreenshotScrollAutomationParams({
            rawScrollY: "720",
            rawScrollDelayMs: "900",
        });

        expect(result).toEqual({
            scrollDelayMs: 900,
            scrollOffset: 720,
        });
    });

    it("uses the first route param when Expo Router provides arrays", () => {
        const result = resolveScreenshotScrollAutomationParams({
            rawScrollY: ["1250", "2500"],
            rawScrollDelayMs: ["450"],
        });

        expect(result).toEqual({
            scrollDelayMs: 450,
            scrollOffset: 1250,
        });
    });

    it("ignores invalid scroll offsets and keeps the default delay", () => {
        const result = resolveScreenshotScrollAutomationParams({
            rawScrollY: "-1",
            rawScrollDelayMs: "not-a-number",
        });

        expect(result).toEqual({
            scrollDelayMs: 350,
            scrollOffset: null,
        });
    });
});
