import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheckBig, Clock3, Link2, Save, Send, TriangleAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import {
    AUDIT_SECTION_PREVIEW,
    YEE_PLACES,
    type PreAuditStatus,
    toCompletionPercent,
} from "lib/yee-demo-data";
import { designSystem, getPreAuditTone } from "lib/design-system";
import { useDemoUiStore } from "stores/demo-ui-store";

const PRE_AUDIT_STATUS_LABELS: Record<PreAuditStatus, string> = {
    pending: "Base scoring active",
    in_progress: "Scoring profile setup in progress",
    completed: "Scoring profile ready",
};

const PRE_AUDIT_BADGE_LABELS: Record<PreAuditStatus, string> = {
    pending: "Base mode",
    in_progress: "Profile setup",
    completed: "Profile ready",
};

/**
 * Audit execution tab that previews YEE section progress and field interactions.
 */
export default function ExecuteScreen() {
    const insets = useSafeAreaInsets();
    const selectedPlaceId = useDemoUiStore((state) => state.selectedPlaceId);
    const [ratingValue, setRatingValue] = useState<number>(4);
    const defaultPlace = YEE_PLACES[0];

    if (defaultPlace === undefined) {
        throw new Error("YEE_PLACES must define at least one place.");
    }

    const activePlace = useMemo(() => {
        return YEE_PLACES.find((place) => place.id === selectedPlaceId) ?? defaultPlace;
    }, [defaultPlace, selectedPlaceId]);
    const totalAnswered = useMemo(() => {
        return AUDIT_SECTION_PREVIEW.reduce((sum, section) => {
            return sum + section.answeredItems;
        }, 0);
    }, []);
    const totalQuestions = useMemo(() => {
        return AUDIT_SECTION_PREVIEW.reduce((sum, section) => {
            return sum + section.totalItems;
        }, 0);
    }, []);
    const mandatoryAnswered = useMemo(() => {
        return AUDIT_SECTION_PREVIEW.reduce((sum, section) => {
            if (!section.mandatory) {
                return sum;
            }

            return sum + section.answeredItems;
        }, 0);
    }, []);
    const mandatoryQuestions = useMemo(() => {
        return AUDIT_SECTION_PREVIEW.reduce((sum, section) => {
            if (!section.mandatory) {
                return sum;
            }

            return sum + section.totalItems;
        }, 0);
    }, []);
    const activeSectionIndex = useMemo(() => {
        const firstIncompleteSectionIndex = AUDIT_SECTION_PREVIEW.findIndex((section) => {
            return section.answeredItems < section.totalItems;
        });

        return Math.max(firstIncompleteSectionIndex, 0);
    }, []);

    const overallCompletion = toCompletionPercent(totalAnswered, totalQuestions);
    const mandatoryCompletion = toCompletionPercent(mandatoryAnswered, mandatoryQuestions);
    const scorePreviewBase = Math.round((ratingValue / 5) * 100);
    const preAuditTone = getPreAuditTone(activePlace.preAuditStatus);
    const activeSection = AUDIT_SECTION_PREVIEW[activeSectionIndex];

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    gap: 20,
                    paddingBottom: insets.bottom + 116,
                }}
            >
                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    p="$4"
                    gap="$3"
                    style={{
                        boxShadow: designSystem.shadows.card,
                    }}
                >
                    <XStack justify="space-between" items="center">
                        <YStack
                            rounded={designSystem.radii.sm}
                            px="$2"
                            py="$1"
                            bg={designSystem.colors.surfaceMuted}
                        >
                            <Text
                                color={designSystem.colors.warning}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                Draft
                            </Text>
                        </YStack>
                        <YStack
                            rounded={designSystem.radii.full}
                            px="$3"
                            py="$1"
                            style={{ backgroundColor: preAuditTone.surface }}
                        >
                            <Text
                                style={{ color: preAuditTone.text }}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                {PRE_AUDIT_BADGE_LABELS[activePlace.preAuditStatus]}
                            </Text>
                        </YStack>
                    </XStack>

                    <YStack gap="$1">
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.monoBold}
                            fontSize={12}
                            textTransform="uppercase"
                            letterSpacing={1.1}
                        >
                            {activePlace.id.toUpperCase()} | {activePlace.projectName}
                        </Text>
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={28}
                            lineHeight={32}
                        >
                            {activePlace.placeName}
                        </Text>
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            {activePlace.locality}
                        </Paragraph>
                    </YStack>

                    <XStack items="center" gap="$2">
                        <Link2 size={14} color={preAuditTone.text} />
                        <Paragraph
                            fontFamily={designSystem.fonts.bodyBold}
                            style={{ color: preAuditTone.text }}
                        >
                            {PRE_AUDIT_STATUS_LABELS[activePlace.preAuditStatus]}
                        </Paragraph>
                    </XStack>

                    {activeSection === undefined ? null : (
                        <YStack gap="$2">
                            <XStack justify="space-between">
                                <Text
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                    fontSize={12}
                                >
                                    Section {activeSectionIndex + 1}: {activeSection.sectionName}
                                </Text>
                                <Text
                                    color={designSystem.colors.primary}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={12}
                                >
                                    {activeSection.answeredItems}/{activeSection.totalItems}{" "}
                                    completed
                                </Text>
                            </XStack>
                            <YStack
                                height={6}
                                rounded={designSystem.radii.full}
                                bg={designSystem.colors.mutedSurface}
                                overflow="hidden"
                            >
                                <YStack
                                    height={6}
                                    rounded={designSystem.radii.full}
                                    bg={designSystem.colors.primary}
                                    width={`${toCompletionPercent(
                                        activeSection.answeredItems,
                                        activeSection.totalItems,
                                    )}%`}
                                />
                            </YStack>
                        </YStack>
                    )}
                </YStack>

                <YStack gap="$3">
                    <HeaderMetric
                        label="Overall completion"
                        value={`${overallCompletion}%`}
                        accentColor={designSystem.colors.primary}
                    />
                    <HeaderMetric
                        label="Mandatory completion"
                        value={`${mandatoryCompletion}%`}
                        accentColor={designSystem.colors.success}
                    />
                </YStack>

                <YStack gap="$2.5">
                    <XStack items="center" gap="$2">
                        <Clock3 size={14} color={designSystem.colors.mutedForeground} />
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            Autosave every 30 seconds and on section transition.
                        </Paragraph>
                    </XStack>

                    <XStack items="center" gap="$2">
                        <TriangleAlert size={14} color={designSystem.colors.warning} />
                        <Paragraph
                            color={designSystem.colors.warning}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            Mobile capture is using base scoring while weighted scoring waits for
                            the pre-audit setup flow to be completed and synced.
                        </Paragraph>
                    </XStack>
                </YStack>

                <YStack gap="$3">
                    {AUDIT_SECTION_PREVIEW.map((section, index) => {
                        const completion = toCompletionPercent(
                            section.answeredItems,
                            section.totalItems,
                        );
                        const isActiveSection = index === activeSectionIndex;
                        const accentColor = isActiveSection
                            ? designSystem.colors.primary
                            : completion >= 100
                              ? designSystem.colors.success
                              : section.mandatory
                                ? designSystem.colors.warning
                                : designSystem.colors.mutedForeground;

                        return (
                            <YStack
                                key={section.id}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={
                                    isActiveSection
                                        ? "rgba(197, 138, 92, 0.5)"
                                        : designSystem.colors.border
                                }
                                bg={designSystem.colors.surface}
                                overflow="hidden"
                                style={{
                                    boxShadow: designSystem.shadows.card,
                                }}
                            >
                                <XStack>
                                    <YStack width={4} bg={accentColor} />

                                    <YStack flex={1} p="$4" gap="$3">
                                        <XStack items="flex-start" gap="$3">
                                            <Text
                                                color={accentColor}
                                                fontFamily={designSystem.fonts.headingBold}
                                                fontSize={15}
                                            >
                                                {`${index + 1}`.padStart(2, "0")}
                                            </Text>
                                            <YStack flex={1} gap="$1">
                                                <Text
                                                    color={designSystem.colors.foreground}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={17}
                                                >
                                                    {section.sectionName}
                                                </Text>
                                                <Paragraph
                                                    color={designSystem.colors.mutedForeground}
                                                    fontFamily={designSystem.fonts.bodyMedium}
                                                >
                                                    {section.answeredItems} / {section.totalItems}{" "}
                                                    answered
                                                </Paragraph>
                                            </YStack>
                                            <YStack
                                                rounded={designSystem.radii.full}
                                                px="$3"
                                                py="$1"
                                                bg={
                                                    isActiveSection
                                                        ? designSystem.colors.primarySoft
                                                        : designSystem.colors.surfaceMuted
                                                }
                                            >
                                                <Text
                                                    color={
                                                        isActiveSection
                                                            ? designSystem.colors.primary
                                                            : designSystem.colors
                                                                  .secondaryForeground
                                                    }
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={10}
                                                    textTransform="uppercase"
                                                    letterSpacing={1.1}
                                                >
                                                    {isActiveSection ? "Active" : `${completion}%`}
                                                </Text>
                                            </YStack>
                                        </XStack>

                                        <YStack
                                            height={6}
                                            rounded={designSystem.radii.full}
                                            bg={designSystem.colors.mutedSurface}
                                            overflow="hidden"
                                        >
                                            <YStack
                                                height={6}
                                                rounded={designSystem.radii.full}
                                                bg={accentColor}
                                                width={`${completion}%`}
                                            />
                                        </YStack>

                                        <XStack
                                            justify="space-between"
                                            items="center"
                                            gap="$3"
                                            flexWrap="wrap"
                                        >
                                            <YStack
                                                rounded={designSystem.radii.sm}
                                                px="$2.5"
                                                py="$1"
                                                bg={
                                                    section.mandatory
                                                        ? designSystem.colors.warningSoft
                                                        : designSystem.colors.surfaceMuted
                                                }
                                            >
                                                <Text
                                                    color={
                                                        section.mandatory
                                                            ? designSystem.colors.warning
                                                            : designSystem.colors
                                                                  .secondaryForeground
                                                    }
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={10}
                                                    textTransform="uppercase"
                                                    letterSpacing={1.2}
                                                >
                                                    {section.mandatory ? "Mandatory" : "Optional"}
                                                </Text>
                                            </YStack>

                                            {section.mandatory ? (
                                                <Text
                                                    color={designSystem.colors.success}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={12}
                                                >
                                                    Section score {section.sectionScorePercent}%
                                                </Text>
                                            ) : (
                                                <Paragraph
                                                    color={designSystem.colors.mutedForeground}
                                                    fontFamily={designSystem.fonts.bodyMedium}
                                                    fontSize={12}
                                                >
                                                    Informational section, not scored.
                                                </Paragraph>
                                            )}
                                        </XStack>
                                    </YStack>
                                </XStack>
                            </YStack>
                        );
                    })}
                </YStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    p="$4"
                    gap="$3"
                    style={{
                        boxShadow: designSystem.shadows.card,
                    }}
                >
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={20}
                    >
                        Quick scoring preview
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        To what extent does this place enable youth participation and shared
                        decision-making?
                    </Paragraph>
                    <XStack gap="$2">
                        {[1, 2, 3, 4, 5].map((value) => {
                            const isSelected = value === ratingValue;

                            return (
                                <Button
                                    key={value}
                                    flex={1}
                                    height={46}
                                    rounded={designSystem.radii.md}
                                    borderWidth={1}
                                    borderColor={
                                        isSelected
                                            ? designSystem.colors.primary
                                            : designSystem.colors.border
                                    }
                                    bg={
                                        isSelected
                                            ? designSystem.colors.primary
                                            : designSystem.colors.input
                                    }
                                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                    onPress={() => {
                                        setRatingValue(value);
                                    }}
                                >
                                    <Text
                                        color={
                                            isSelected
                                                ? designSystem.colors.primaryForeground
                                                : designSystem.colors.foreground
                                        }
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={15}
                                    >
                                        {value}
                                    </Text>
                                </Button>
                            );
                        })}
                    </XStack>

                    <YStack
                        rounded={designSystem.radii.md}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.input}
                        p="$3"
                        gap="$1"
                    >
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.2}
                        >
                            Preview base score
                        </Paragraph>
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={22}
                        >
                            {scorePreviewBase}%
                        </Text>
                    </YStack>

                    <XStack justify="center" items="center" gap="$2" width="100%" px="$2">
                        <CircleCheckBig size={14} color={designSystem.colors.success} />
                        <Paragraph
                            color={designSystem.colors.success}
                            fontFamily={designSystem.fonts.bodyMedium}
                            lineHeight={20}
                            style={{ flexShrink: 1, textAlign: "start" }}
                        >
                            Draft ready. Mandatory sections are{" "}
                            {mandatoryCompletion >= 80
                                ? "ready for submission"
                                : "still in progress"}
                            .
                        </Paragraph>
                    </XStack>
                </YStack>
            </ScrollView>

            <YStack
                borderTopWidth={1}
                borderTopColor={designSystem.colors.border}
                bg={designSystem.colors.overlay}
                px="$4"
                pt="$3"
                pb={Math.max(insets.bottom, 12)}
                gap="$2"
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
            >
                <XStack gap="$2">
                    <Button
                        flex={1}
                        height={52}
                        rounded={designSystem.radii.md}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    >
                        <XStack items="center" gap="$2">
                            <Save size={16} color={designSystem.colors.foreground} />
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={12}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                Save local draft
                            </Text>
                        </XStack>
                    </Button>
                    <Button
                        flex={1}
                        height={52}
                        rounded={designSystem.radii.md}
                        borderWidth={0}
                        bg={designSystem.colors.primary}
                        disabled={mandatoryCompletion < 80}
                        opacity={mandatoryCompletion < 80 ? 0.6 : 1}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    >
                        <XStack items="center" gap="$2">
                            <Send size={16} color={designSystem.colors.primaryForeground} />
                            <Text
                                color={designSystem.colors.primaryForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={12}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                Submit YEE audit
                            </Text>
                        </XStack>
                    </Button>
                </XStack>
            </YStack>
        </YStack>
    );
}

interface HeaderMetricProps {
    readonly label: string;
    readonly value: string;
    readonly accentColor: string;
}

/**
 * Compact execution header metric.
 *
 * @param props Metric content and accent color.
 * @returns A small bordered metric surface.
 */
function HeaderMetric({ label, value, accentColor }: HeaderMetricProps) {
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surfaceMuted}
            p="$3"
            gap="$1"
        >
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={10}
                textTransform="uppercase"
                letterSpacing={1.2}
            >
                {label}
            </Paragraph>
            <Text
                fontFamily={designSystem.fonts.headingBold}
                fontSize={24}
                style={{ color: accentColor }}
            >
                {value}
            </Text>
        </YStack>
    );
}
