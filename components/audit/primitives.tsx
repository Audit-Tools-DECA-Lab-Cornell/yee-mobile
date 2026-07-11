import {
    memo,
    useCallback,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
    type ReactNode,
} from "react";
import { Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { Check } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { ensureQuestionMark } from "lib/yee-mobile-audit-config";
import type { InstrumentOption } from "lib/yee-mobile-instrument";
import { useSurveyPalette, type SurveyPalette } from "./survey-theme";

/**
 * Section container card. The single elevated surface every step's content sits
 * on, giving the survey one consistent card language.
 */
export const SurveyCard = memo(function SurveyCard({
    title,
    description,
    children,
}: PropsWithChildren<{ title: string; description?: string }>) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            p="$4"
            gap="$3.5"
            style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <YStack gap="$1.5">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={21}
                >
                    {title}
                </Text>
                {description ? (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {description}
                    </Paragraph>
                ) : null}
            </YStack>
            {children}
        </YStack>
    );
});

/** Soft accent intro card that opens a domain section. */
export const SectionIntroCard = memo(function SectionIntroCard({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$4"
            gap="$2.5"
            style={{
                backgroundColor: palette.intro,
                borderColor: palette.introBorder,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                style={{ color: palette.accentText }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={22}
            >
                {title}
            </Text>
            <Paragraph
                style={{ color: palette.mutedAccentText }}
                fontFamily={designSystem.fonts.bodyMedium}
                lineHeight={21}
            >
                {description}
            </Paragraph>
        </YStack>
    );
});

/** A single labelled question frame that hosts an answer control. */
export const QuestionCard = memo(function QuestionCard({
    label,
    children,
}: PropsWithChildren<{ label: string }>) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$4"
            gap="$3"
            style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                lineHeight={22}
            >
                {ensureQuestionMark(label)}
            </Text>
            {children}
        </YStack>
    );
});

/**
 * Single selectable option row. Built from a pressable XStack (not a Button) so
 * long labels wrap and the row grows with them. A leading radio/checkbox
 * signifier makes the selection affordance explicit (Norman: signifiers).
 */
export const SelectionButton = memo(function SelectionButton({
    label,
    selected,
    onPress,
    multi = false,
    disabled = false,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    /** Render a square (checkbox) signifier instead of a round (radio) one. */
    multi?: boolean;
    /** View-only: ignore presses and dim unselected rows. */
    disabled?: boolean;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <XStack
            items="center"
            gap="$3"
            rounded={designSystem.radii.button}
            borderWidth={1}
            py="$3"
            px="$3.5"
            cursor={disabled ? "default" : "pointer"}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            hoverStyle={disabled ? null : { opacity: 0.98 }}
            pressStyle={disabled ? null : { opacity: 0.92, scale: 0.985 }}
            onPress={disabled ? undefined : onPress}
            style={{
                backgroundColor: selected ? palette.selected : palette.inner,
                borderColor: selected ? palette.selectedBorder : palette.innerBorder,
                boxShadow: selected ? designSystem.shadows.elevated : "none",
                // Keep the chosen answer fully legible; fade the rest so a locked
                // audit still reads clearly as "this is what was selected".
                opacity: disabled && !selected ? 0.55 : 1,
            }}
        >
            <YStack
                width={22}
                height={22}
                items="center"
                justify="center"
                borderWidth={2}
                style={{
                    borderRadius: multi ? 6 : 999,
                    borderColor: selected
                        ? designSystem.colors.primaryForeground
                        : palette.innerBorder,
                    backgroundColor: selected
                        ? designSystem.colors.primaryForeground
                        : "transparent",
                }}
            >
                {selected ? <Check size={14} color={designSystem.colors.primary} /> : null}
            </YStack>
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                style={{
                    color: selected ? designSystem.colors.primaryForeground : palette.accentText,
                    flexShrink: 1,
                    textAlign: "left",
                }}
            >
                {label}
            </Text>
        </XStack>
    );
});

/** Vertical list of single-select options. */
export const OptionGrid = memo(function OptionGrid({
    value,
    options,
    onChange,
    disabled = false,
}: {
    value: string | undefined;
    options: readonly InstrumentOption[];
    onChange: (value: string) => void;
    /** View-only: forward to every option so the group is non-interactive. */
    disabled?: boolean;
}) {
    return (
        <YStack gap="$2">
            {options.map((option) => (
                <SelectionButton
                    key={option.id}
                    label={option.label}
                    selected={value === option.id}
                    onPress={() => onChange(option.id)}
                    disabled={disabled}
                />
            ))}
        </YStack>
    );
});

/** Read-only labelled value (auditor id, audit date). */
export const ReadOnlyField = memo(function ReadOnlyField({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack gap="$1.5">
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
                rounded={designSystem.radii.sm}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                p="$3"
                style={{ backgroundColor: designSystem.colors.surface }}
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

/** Inline notice for sync/validation messages. */
export const NoticeCard = memo(function NoticeCard({
    tone,
    title,
    body,
}: {
    tone: "danger" | "warning";
    title: string;
    body: string;
}) {
    const designSystem = useDesignSystem();
    const color = tone === "danger" ? designSystem.colors.danger : designSystem.colors.warning;
    const textColor =
        tone === "danger" ? designSystem.colors.dangerText : designSystem.colors.warningText;
    const surface =
        tone === "danger" ? designSystem.colors.dangerSoft : designSystem.colors.warningSoft;
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={color}
            bg={surface}
            p="$4"
            gap="$1.5"
        >
            <Text style={{ color: textColor }} fontFamily={designSystem.fonts.bodyBold}>
                {title}
            </Text>
            <Paragraph color={designSystem.colors.secondaryForeground}>{body}</Paragraph>
        </YStack>
    );
});

/** Progress meter shown at the foot of each section. */
export const SectionProgressCard = memo(function SectionProgressCard({
    title,
    helperText,
    completedCount,
    totalCount,
}: {
    title: string;
    helperText: string;
    completedCount: number;
    totalCount: number;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$3.5"
            gap="$2.5"
            style={{ backgroundColor: palette.progress, borderColor: palette.cardBorder }}
        >
            <XStack justify="space-between" items="center" gap="$3">
                <YStack gap="$0.5" flex={1}>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={15}
                    >
                        {title}
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {helperText}
                    </Paragraph>
                </YStack>
                <Text
                    style={{ color: palette.accentText }}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={20}
                >
                    {percentage}%
                </Text>
            </XStack>
            <YStack
                height={10}
                rounded={designSystem.radii.full}
                style={{ backgroundColor: palette.progressTrack }}
                overflow="hidden"
            >
                <YStack
                    height={10}
                    rounded={designSystem.radii.full}
                    style={{
                        backgroundColor: palette.accent,
                        width: `${Math.max(0, Math.min(percentage, 100))}%`,
                    }}
                />
            </YStack>
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {completedCount} of {totalCount} answered
            </Paragraph>
        </YStack>
    );
});

/**
 * Multiline comment field with LOCAL text state so keystrokes are instant and
 * never mutate the global draft per character. The value is committed to the
 * store on a short debounce and on blur; the store's own 500ms autosave then
 * persists it, so there is no data-loss risk. This is the fix for the reported
 * typing lag.
 */
export const CommentField = memo(function CommentField({
    label,
    value,
    onCommit,
    palette,
    placeholder = "Optional notes",
    disabled = false,
    multiline = true,
    emptyFallback = "No comments added.",
    debounceMs = 400,
}: {
    label: string;
    value: string;
    onCommit: (value: string) => void;
    palette: SurveyPalette;
    placeholder?: string;
    /** View-only: lock the input and show a muted empty placeholder. */
    disabled?: boolean;
    /** Single-line mode for short identifiers (participant ID, codes). */
    multiline?: boolean;
    /** Muted text shown in view-only mode when no value was entered. */
    emptyFallback?: string;
    /**
     * Commit debounce. Pass 0 for short identifier fields so every keystroke
     * lands in the store immediately — a navigation-time save can then never
     * race a pending debounce and drop the typed value. Long comment fields
     * keep the default to avoid per-keystroke draft rebuilds.
     */
    debounceMs?: number;
}) {
    const designSystem = useDesignSystem();
    const [text, setText] = useState(value);
    const committedRef = useRef(value);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Adopt external changes (e.g. background remote merge) only when they differ
    // from what we last committed, so they never stomp in-progress typing.
    useEffect(() => {
        if (value !== committedRef.current) {
            committedRef.current = value;
            setText(value);
        }
    }, [value]);

    const commit = useCallback(
        (next: string) => {
            if (next === committedRef.current) {
                return;
            }
            committedRef.current = next;
            onCommit(next);
        },
        [onCommit],
    );

    const handleChange = useCallback(
        (next: string) => {
            setText(next);
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
            if (debounceMs <= 0) {
                commit(next);
                return;
            }
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                commit(next);
            }, debounceMs);
        },
        [commit, debounceMs],
    );

    const handleBlur = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        commit(text);
    }, [commit, text]);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    // View-only: render the saved comment as locked text rather than a disabled
    // input frame — clearer that nothing here is editable.
    if (disabled) {
        const trimmed = value.trim();
        return (
            <YStack gap="$2">
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    {label}
                </Paragraph>
                <YStack
                    rounded={designSystem.radii.md}
                    borderWidth={1}
                    px="$3"
                    py="$3"
                    style={{
                        minHeight: multiline ? 56 : 48,
                        backgroundColor: palette.inner,
                        borderColor: palette.innerBorder,
                    }}
                >
                    <Paragraph
                        color={
                            trimmed.length > 0
                                ? designSystem.colors.foreground
                                : designSystem.colors.mutedForeground
                        }
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {trimmed.length > 0 ? trimmed : emptyFallback}
                    </Paragraph>
                </YStack>
            </YStack>
        );
    }

    return (
        <YStack gap="$2">
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {label}
            </Paragraph>
            <Input
                value={text}
                onChangeText={handleChange}
                onBlur={handleBlur}
                multiline={multiline}
                color={designSystem.colors.foreground}
                placeholder={placeholder}
                rounded={designSystem.radii.md}
                borderWidth={1}
                px="$3"
                py="$3"
                verticalAlign={multiline ? "top" : "middle"}
                style={{
                    minHeight: multiline ? 110 : 48,
                    backgroundColor: palette.inner,
                    borderColor: palette.innerBorder,
                }}
            />
        </YStack>
    );
});

/** Small helper for step components that need a labelled choice group frame. */
export function ChoiceField({
    label,
    helperText,
    children,
}: PropsWithChildren<{ label: string; helperText?: ReactNode }>) {
    const designSystem = useDesignSystem();
    return (
        <QuestionCard label={label}>
            {helperText ? (
                <Paragraph color={designSystem.colors.mutedForeground}>{helperText}</Paragraph>
            ) : null}
            {children}
        </QuestionCard>
    );
}
