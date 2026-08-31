/**
 * The backend now derives an authoring document for instruments that were
 * published without one, so this app switches from its legacy `scoring_items`
 * adapter to the authoring path for the SAME instrument.
 *
 * That switch must be invisible to an auditor. These tests compare both paths
 * over the real shipped instrument: same questions, same order, same bindings,
 * same triggers, same requiredness. `yee-instrument.authoring.snapshot.json` is
 * the document the backend actually derives from the fixture beside it.
 *
 * A difference here is not cosmetic — the binding is where an answer is stored,
 * so a mismatch would file answers under the wrong key and change scores.
 */
import { describe, expect, it } from "vitest";

import legacyFixture from "../fixtures/yee-instrument.snapshot.json";
import derivedAuthoring from "../fixtures/yee-instrument.authoring.snapshot.json";
import { normalizeInstrument, type InstrumentLogicalQuestion } from "lib/yee-mobile-instrument";
import type { YeeInstrumentResponse } from "lib/yee-types";

const asLegacy = legacyFixture as YeeInstrumentResponse;
const asAuthored = {
    ...legacyFixture,
    authoring: derivedAuthoring,
} as unknown as YeeInstrumentResponse;

function comparable(question: InstrumentLogicalQuestion) {
    return {
        key: question.key,
        presenceItemId: question.presenceItemId,
        choiceId: question.choiceId,
        conditionItemId: question.conditionItemId,
        presenceAnswers: question.presenceAnswers,
        conditionAnswers: question.conditionAnswers,
        conditionTriggerAnswerIds: question.conditionTriggerAnswerIds,
        conditionRequiredWhenShown: question.conditionRequiredWhenShown,
    };
}

describe("legacy and authoring instruments render the same audit", () => {
    it("produces the same sections in the same order", () => {
        const legacy = normalizeInstrument(asLegacy);
        const authored = normalizeInstrument(asAuthored);
        expect(authored.sections.map((section) => section.domain)).toEqual(
            legacy.sections.map((section) => section.domain),
        );
        expect(authored.sections.map((section) => section.step)).toEqual(
            legacy.sections.map((section) => section.step),
        );
    });

    it("produces identical questions, bindings, triggers and requiredness", () => {
        const legacy = normalizeInstrument(asLegacy).sections.flatMap((s) => s.questions);
        const authored = normalizeInstrument(asAuthored).sections.flatMap((s) => s.questions);

        expect(authored).toHaveLength(54);
        expect(authored.map(comparable)).toEqual(legacy.map(comparable));
    });

    it("uses the authoring document rather than silently ignoring it", () => {
        // Guards the premise of the tests above: if the authoring path were dead
        // code, they would pass while proving nothing.
        const emptied = {
            ...legacyFixture,
            authoring: { ...derivedAuthoring, sections: [] },
        } as unknown as YeeInstrumentResponse;
        expect(normalizeInstrument(emptied).sections).toHaveLength(0);
    });
});
