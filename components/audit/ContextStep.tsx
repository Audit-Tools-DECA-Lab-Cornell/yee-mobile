import { memo } from "react";
import { YStack } from "tamagui";
import { useShallow } from "zustand/react/shallow";
import {
    CONTEXT_QUESTION_IDS,
    findContextQuestion,
    type InstrumentContextQuestion,
} from "lib/yee-mobile-instrument";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { useSurveyPalette } from "./survey-theme";
import {
    CommentField,
    QuestionCard,
    SelectionButton,
    SurveyCard,
    ReadOnlyField,
    OptionGrid,
} from "./primitives";

/**
 * Step 1 — visit context. Every question prompt and option label now comes from
 * the cached instrument (backend-supplied); the client only owns the binding of
 * each question id to its draft slice. Each control reads and writes exactly its
 * own slice, so a change to one answer never rebuilds the others.
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
            <ParticipantIdField />
            <VisitFrequencyQuestion />
            <PublicAccessQuestion />
            <OpenHoursQuestion />
            <SeasonQuestion />
            <WeatherQuestion />
        </SurveyCard>
    );
});

/** The instrument's context question for `id`, or `null` while uncached. */
function useContextQuestion(id: string): InstrumentContextQuestion | null {
    return useAuditSessionStore((state) =>
        state.instrument === null ? null : findContextQuestion(state.instrument, id),
    );
}

/**
 * Optional free-text participant ID so a study/workshop can link this audit to
 * the person who completed it. Client-owned (not part of the instrument), so
 * it renders regardless of the cached instrument version.
 */
const ParticipantIdField = memo(function ParticipantIdField() {
    const value = useAuditSessionStore((state) => state.draft?.participantId ?? "");
    const setParticipantId = useAuditSessionStore((state) => state.setParticipantId);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const palette = useSurveyPalette();
    return (
        <CommentField
            label="Participant ID (optional)"
            value={value}
            onCommit={setParticipantId}
            palette={palette}
            placeholder="e.g. P-042"
            disabled={readOnly}
            multiline={false}
            emptyFallback="No participant ID entered."
            debounceMs={0}
        />
    );
});

const VisitFrequencyQuestion = memo(function VisitFrequencyQuestion() {
    const question = useContextQuestion(CONTEXT_QUESTION_IDS.visitFrequency);
    const value = useAuditSessionStore((state) => state.draft?.visitFrequency);
    const setValue = useAuditSessionStore((state) => state.setVisitFrequency);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    if (question === null) {
        return null;
    }
    return (
        <QuestionCard label={question.prompt}>
            <OptionGrid
                value={value}
                options={question.options}
                onChange={setValue}
                disabled={readOnly}
            />
        </QuestionCard>
    );
});

const PublicAccessQuestion = memo(function PublicAccessQuestion() {
    const question = useContextQuestion(CONTEXT_QUESTION_IDS.publicAccess);
    const value = useAuditSessionStore((state) => state.draft?.publicAccess);
    const setValue = useAuditSessionStore((state) => state.setPublicAccess);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    if (question === null) {
        return null;
    }
    return (
        <QuestionCard label={question.prompt}>
            <OptionGrid
                value={value}
                options={question.options}
                onChange={setValue}
                disabled={readOnly}
            />
        </QuestionCard>
    );
});

const OpenHoursQuestion = memo(function OpenHoursQuestion() {
    const question = useContextQuestion(CONTEXT_QUESTION_IDS.openHoursAccess);
    const value = useAuditSessionStore((state) => state.draft?.openHoursAccess);
    const setValue = useAuditSessionStore((state) => state.setOpenHoursAccess);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    if (question === null) {
        return null;
    }
    return (
        <QuestionCard label={question.prompt}>
            <OptionGrid
                value={value}
                options={question.options}
                onChange={setValue}
                disabled={readOnly}
            />
        </QuestionCard>
    );
});

const SeasonQuestion = memo(function SeasonQuestion() {
    const question = useContextQuestion(CONTEXT_QUESTION_IDS.season);
    const value = useAuditSessionStore((state) => state.draft?.season);
    const setValue = useAuditSessionStore((state) => state.setSeason);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    if (question === null) {
        return null;
    }
    return (
        <QuestionCard label={question.prompt}>
            <OptionGrid
                value={value}
                options={question.options}
                onChange={setValue}
                disabled={readOnly}
            />
        </QuestionCard>
    );
});

const WeatherQuestion = memo(function WeatherQuestion() {
    const question = useContextQuestion(CONTEXT_QUESTION_IDS.weather);
    const weather = useAuditSessionStore(useShallow((state) => state.draft?.weather ?? []));
    const toggleWeather = useAuditSessionStore((state) => state.toggleWeather);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    if (question === null) {
        return null;
    }
    return (
        <QuestionCard label={question.prompt}>
            <YStack gap="$2">
                {question.options.map((option) => (
                    <SelectionButton
                        key={option.id}
                        label={option.label}
                        multi
                        selected={weather.includes(option.id)}
                        onPress={() => toggleWeather(option.id)}
                        disabled={readOnly}
                    />
                ))}
            </YStack>
        </QuestionCard>
    );
});
