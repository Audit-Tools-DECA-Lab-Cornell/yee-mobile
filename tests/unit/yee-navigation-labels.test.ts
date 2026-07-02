import { describe, expect, it } from "vitest";
import { buildAuditStepHeaderLabels, buildReportHeaderLabels } from "lib/yee-navigation-labels";

describe("YEE deep-screen navigation labels", () => {
    it("uses the fetched place name and current audit step as header context", () => {
        const labels = buildAuditStepHeaderLabels({
            placeName: "West End Youth Center",
            stepTitle: "Access",
        });

        expect(labels).toEqual({
            primary: "West End Youth Center",
            secondary: "Access",
        });
    });

    it("falls back to friendly copy instead of promoting route ids", () => {
        const labels = buildReportHeaderLabels({
            placeName: null,
            isPendingUpload: false,
        });

        expect(labels).toEqual({
            primary: "Submitted audit",
            secondary: "Audit report",
        });
    });
});
