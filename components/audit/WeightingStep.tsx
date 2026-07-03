import { memo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import {
    getWeightPrompt,
    mobileYeeDomainLabels,
    mobileYeeWeightOptions,
    type MobileYeeDomainKey,
} from "lib/yee-mobile-audit-config";
import type { InstrumentOption } from "lib/yee-mobile-instrument";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { useSurveyPalette } from "./survey-theme";
import {
    CommentField,
    OptionGrid,
    QuestionCard,
    SectionProgressCard,
    SurveyCard,
} from "./primitives";

const WEIGHT_OPTIONS: InstrumentOption[] = mobileYeeWeightOptions.map((entry) => ({
    id: entry.value,
    label: entry.label,
}));
const DOMAIN_KEYS = Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[];

/**
 * Step 2 — youth weighting. Each domain importance selection is its own
 * self-subscribing row, and the progress meter subscribes to a derived count, so
 * choosing one weight re-renders only that row plus the meter.
 */
export const WeightingStep = memo(function WeightingStep() {
    const placeName = useAuditSessionStore((state) => state.draft?.placeName ?? "");
    return (
        <SurveyCard
            title="Youth weighting"
            description={`Tell us how important each of the following issues are to you, especially about the play/recreation and green spaces in your community and at ${placeName || "this place"}.`}
        >
            {DOMAIN_KEYS.map((domain) => (
                <WeightRow key={domain} domain={domain} />
            ))}
            <WeightingCommentsField />
            <WeightingProgress />
        </SurveyCard>
    );
});

const WeightRow = memo(function WeightRow({ domain }: { domain: MobileYeeDomainKey }) {
    const value = useAuditSessionStore((state) => state.draft?.weights[domain]);
    const setWeight = useAuditSessionStore((state) => state.setWeight);
    const onChange = useCallback((next: string) => setWeight(domain, next), [setWeight, domain]);
    return (
        <QuestionCard label={getWeightPrompt(domain)}>
            <OptionGrid value={value} options={WEIGHT_OPTIONS} onChange={onChange} />
        </QuestionCard>
    );
});

const WeightingCommentsField = memo(function WeightingCommentsField() {
    const value = useAuditSessionStore((state) => state.draft?.weightingComments ?? "");
    const setWeightingComments = useAuditSessionStore((state) => state.setWeightingComments);
    const palette = useSurveyPalette();
    return (
        <CommentField
            label="Optional weighting comments"
            value={value}
            onCommit={setWeightingComments}
            palette={palette}
        />
    );
});

const WeightingProgress = memo(function WeightingProgress() {
    const completedCount = useAuditSessionStore(
        useShallow((state) =>
            state.draft === null
                ? 0
                : Object.values(state.draft.weights).filter((value) => value.length > 0).length,
        ),
    );
    return (
        <SectionProgressCard
            title="Weighting progress"
            helperText="Each domain needs one importance selection before the scored sections."
            completedCount={completedCount}
            totalCount={DOMAIN_KEYS.length}
        />
    );
});
