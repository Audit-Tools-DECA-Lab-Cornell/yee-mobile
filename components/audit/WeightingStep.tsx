import { memo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import type { InstrumentOption, InstrumentWeightingDomain } from "lib/yee-mobile-instrument";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { asMobileYeeDomainKey } from "lib/yee-mobile-audit-config";
import { SurveyDomainContext, useSurveyPalette } from "./survey-theme";
import {
    CommentField,
    OptionGrid,
    QuestionCard,
    SectionProgressCard,
    SurveyCard,
} from "./primitives";

/**
 * Step 2 — youth weighting. The step description, the per-domain prompts, and the
 * importance scale are all backend-supplied via the cached instrument. Each
 * domain importance selection is its own self-subscribing row, and the progress
 * meter subscribes to a derived count, so choosing one weight re-renders only
 * that row plus the meter.
 */
export const WeightingStep = memo(function WeightingStep() {
    const title = useAuditSessionStore((state) => state.instrument?.weighting.title ?? "");
    const description = useAuditSessionStore(
        (state) => state.instrument?.weighting.description ?? "",
    );
    const domains = useAuditSessionStore(
        useShallow((state) => state.instrument?.weighting.domains ?? []),
    );
    const options = useAuditSessionStore(
        useShallow((state) => state.instrument?.weighting.options ?? []),
    );

    return (
        <SurveyCard title={title || "Youth weighting"} description={description}>
            {domains.map((domain) => (
                <WeightRow key={domain.key} domain={domain} options={options} />
            ))}
            <WeightingCommentsField />
            <WeightingProgress totalCount={domains.length} />
        </SurveyCard>
    );
});

const WeightRow = memo(function WeightRow({
    domain,
    options,
}: {
    domain: InstrumentWeightingDomain;
    options: readonly InstrumentOption[];
}) {
    const value = useAuditSessionStore((state) => state.draft?.weights[domain.key]);
    const setWeight = useAuditSessionStore((state) => state.setWeight);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const onChange = useCallback(
        (next: string) => setWeight(domain.key, next),
        [setWeight, domain.key],
    );
    // The step itself is not a domain, but each row IS one — so the row carries
    // that domain's colours, the same ones it will wear on its own audit step.
    return (
        <SurveyDomainContext.Provider value={asMobileYeeDomainKey(domain.key)}>
            <QuestionCard label={domain.prompt}>
                <OptionGrid
                    value={value}
                    options={options}
                    onChange={onChange}
                    disabled={readOnly}
                />
            </QuestionCard>
        </SurveyDomainContext.Provider>
    );
});

const WeightingCommentsField = memo(function WeightingCommentsField() {
    const value = useAuditSessionStore((state) => state.draft?.weightingComments ?? "");
    const setWeightingComments = useAuditSessionStore((state) => state.setWeightingComments);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const palette = useSurveyPalette();
    return (
        <CommentField
            label="Optional weighting comments"
            value={value}
            onCommit={setWeightingComments}
            palette={palette}
            disabled={readOnly}
        />
    );
});

const WeightingProgress = memo(function WeightingProgress({ totalCount }: { totalCount: number }) {
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
            totalCount={totalCount}
        />
    );
});
