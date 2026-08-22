import { memo } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import type { MobileYeeDomainKey, MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import { SurveyDomainContext, useSurveyPalette } from "components/audit/survey-theme";
import { SurveyCard } from "components/audit/primitives";

export type ReviewRow = {
    readonly prompt: string;
    readonly response: string;
    readonly condition: string | null;
};

export type ReviewSection = {
    readonly domain: MobileYeeDomainKey;
    readonly label: string;
    readonly step: MobileYeeStepNumber;
    readonly rows: readonly ReviewRow[];
    readonly answeredCount: number;
    readonly totalCount: number;
};

/**
 * One domain's read-only answer summary. Memoized so scrolling the long review
 * list only re-renders the section whose underlying data actually changed —
 * every other section keeps its previous render output.
 */
/**
 * One domain's read-only summary, wrapped in that domain's colour context.
 *
 * The provider is what makes the review screen match the audit itself: every
 * primitive inside — the card tint, the edit button, the nested rows — reads
 * `useSurveyPalette()`, which resolves the hue from {@link SurveyDomainContext}.
 * Without it all six sections rendered in the same neutral green and the review
 * lost the one cue telling the auditor which section they were looking at.
 */
export const ReviewSectionCard = memo(function ReviewSectionCard(props: {
    section: ReviewSection;
    sectionComment: string;
    onEditSection: (step: MobileYeeStepNumber) => void;
}) {
    return (
        <SurveyDomainContext.Provider value={props.section.domain}>
            <ReviewSectionCardBody {...props} />
        </SurveyDomainContext.Provider>
    );
});

const ReviewSectionCardBody = memo(function ReviewSectionCardBody({
    section,
    sectionComment,
    onEditSection,
}: {
    section: ReviewSection;
    sectionComment: string;
    onEditSection: (step: MobileYeeStepNumber) => void;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();

    return (
        <SurveyCard title={section.label}>
            <XStack justify="space-between" items="center" gap="$3" flexWrap="wrap">
                <Paragraph color={designSystem.colors.secondaryForeground}>
                    {section.answeredCount} of {section.totalCount} question rows answered
                </Paragraph>
                <Button
                    rounded={designSystem.radii.button}
                    borderWidth={1}
                    style={{
                        backgroundColor: palette.accent,
                        borderColor: palette.accent,
                    }}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => onEditSection(section.step)}
                >
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Edit section
                    </Button.Text>
                </Button>
            </XStack>
            <YStack gap="$3">
                {section.rows.map((row, index) => (
                    <ReviewRowCard key={`${section.domain}-${index}`} row={row} />
                ))}
                <ReviewSummaryRow
                    label={`${section.label} comments`}
                    value={sectionComment || "No section comments added."}
                />
            </YStack>
        </SurveyCard>
    );
});

const ReviewRowCard = memo(function ReviewRowCard({ row }: { row: ReviewRow }) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();

    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$3.5"
            gap="$2"
            style={{
                backgroundColor: palette.inner,
                borderColor: palette.innerBorder,
            }}
        >
            <Text color={designSystem.colors.foreground} fontFamily={designSystem.fonts.bodyBold}>
                {row.prompt}
            </Text>
            <AnswerPill label="Answer" value={row.response} />
            {row.condition === null ? null : <AnswerPill label="Condition" value={row.condition} />}
        </YStack>
    );
});

const AnswerPill = memo(function AnswerPill({ label, value }: { label: string; value: string }) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <YStack gap="$1">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.1}
            >
                {label}
            </Paragraph>
            <YStack
                // Matches the survey option rows' radius (web option cards, `md`).
                rounded={designSystem.radii.md}
                px="$3"
                py="$2"
                borderWidth={1}
                style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
            >
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    {value}
                </Text>
            </YStack>
        </YStack>
    );
});

/** Read-only labelled value row, shared across review summary blocks. */
export const ReviewSummaryRow = memo(function ReviewSummaryRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack gap="$0.5">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.1}
            >
                {label}
            </Paragraph>
            <Text color={designSystem.colors.foreground} fontFamily={designSystem.fonts.bodyMedium}>
                {value}
            </Text>
        </YStack>
    );
});
