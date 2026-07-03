import { memo } from "react";
import { YStack } from "tamagui";
import { useShallow } from "zustand/react/shallow";
import {
    openHoursAccessOptions,
    publicAccessOptions,
    seasonOptions,
    visitFrequencyOptions,
    weatherOptions,
} from "lib/yee-mobile-audit-config";
import type { InstrumentOption } from "lib/yee-mobile-instrument";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { QuestionCard, SelectionButton, SurveyCard, ReadOnlyField, OptionGrid } from "./primitives";

const VISIT_FREQUENCY = toOptions(visitFrequencyOptions);
const PUBLIC_ACCESS = toOptions(publicAccessOptions);
const OPEN_HOURS = toOptions(openHoursAccessOptions);
const SEASONS = toOptions(seasonOptions);

function toOptions(source: readonly { value: string; label: string }[]): InstrumentOption[] {
    return source.map((entry) => ({ id: entry.value, label: entry.label }));
}

/**
 * Step 1 — visit context. Each control reads and writes exactly its own draft
 * slice through the session store, so a change to one answer never rebuilds the
 * others.
 */
export const ContextStep = memo(function ContextStep() {
    const placeName = useAuditSessionStore((state) => state.draft?.placeName ?? "");
    const auditorId = useAuditSessionStore((state) => state.draft?.auditorId ?? "");
    const auditDate = useAuditSessionStore((state) => state.draft?.auditDate ?? "");

    return (
        <SurveyCard
            title="Visit details"
            description={`Record the visit context for ${placeName || "this place"}.`}
        >
            <ReadOnlyField label="Generated auditor ID" value={auditorId} />
            <ReadOnlyField label="Audit date" value={auditDate} />
            <VisitFrequencyQuestion />
            <PublicAccessQuestion />
            <OpenHoursQuestion />
            <SeasonQuestion />
            <WeatherQuestion />
        </SurveyCard>
    );
});

const VisitFrequencyQuestion = memo(function VisitFrequencyQuestion() {
    const value = useAuditSessionStore((state) => state.draft?.visitFrequency);
    const setValue = useAuditSessionStore((state) => state.setVisitFrequency);
    return (
        <QuestionCard label="How often have you been to / visited this space in the last 6 months">
            <OptionGrid value={value} options={VISIT_FREQUENCY} onChange={setValue} />
        </QuestionCard>
    );
});

const PublicAccessQuestion = memo(function PublicAccessQuestion() {
    const value = useAuditSessionStore((state) => state.draft?.publicAccess);
    const setValue = useAuditSessionStore((state) => state.setPublicAccess);
    return (
        <QuestionCard label="Is this place open to the public (or can only certain people use it)">
            <OptionGrid value={value} options={PUBLIC_ACCESS} onChange={setValue} />
        </QuestionCard>
    );
});

const OpenHoursQuestion = memo(function OpenHoursQuestion() {
    const value = useAuditSessionStore((state) => state.draft?.openHoursAccess);
    const setValue = useAuditSessionStore((state) => state.setOpenHoursAccess);
    return (
        <QuestionCard label="Is this place open all hours or is it closed for some hours (Ex: closed after 11pm)">
            <OptionGrid value={value} options={OPEN_HOURS} onChange={setValue} />
        </QuestionCard>
    );
});

const SeasonQuestion = memo(function SeasonQuestion() {
    const value = useAuditSessionStore((state) => state.draft?.season);
    const setValue = useAuditSessionStore((state) => state.setSeason);
    return (
        <QuestionCard label="What is the current season">
            <OptionGrid value={value} options={SEASONS} onChange={setValue} />
        </QuestionCard>
    );
});

const WeatherQuestion = memo(function WeatherQuestion() {
    const weather = useAuditSessionStore(useShallow((state) => state.draft?.weather ?? []));
    const toggleWeather = useAuditSessionStore((state) => state.toggleWeather);
    return (
        <QuestionCard label="What is the weather like today">
            <YStack gap="$2">
                {weatherOptions.map((option) => (
                    <SelectionButton
                        key={option.value}
                        label={option.label}
                        multi
                        selected={weather.includes(option.value)}
                        onPress={() => toggleWeather(option.value)}
                    />
                ))}
            </YStack>
        </QuestionCard>
    );
});
