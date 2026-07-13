import type { ReactNode } from "react";
import { Input, XStack, YStack, type InputProps } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";
import { ScaledParagraph as Paragraph } from "./ScaledText";

export interface FieldProps {
    readonly label: string;
    /** Optional trailing element rendered beside the label (e.g. a helper link). */
    readonly labelAccessory?: ReactNode;
    /** Optional helper or error text rendered below the input. */
    readonly hint?: string;
    /** Marks the hint as an error and tints it with the danger token. */
    readonly hasError?: boolean;
    readonly children: ReactNode;
}

/**
 * Labelled form field wrapper providing consistent spacing and hint handling.
 *
 * @param props Field props including `label`, optional `labelAccessory`, and `hint`.
 * @returns A vertical field group.
 */
export function Field({ label, labelAccessory, hint, hasError = false, children }: FieldProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack gap="$2">
            <XStack justify="space-between" items="center" px="$1">
                <Paragraph
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={14}
                >
                    {label}
                </Paragraph>
                {labelAccessory}
            </XStack>
            {children}
            {hint === undefined ? null : (
                <Paragraph
                    px="$1"
                    accessibilityRole={hasError ? "alert" : undefined}
                    aria-live={hasError ? "polite" : undefined}
                    style={{
                        color: hasError
                            ? designSystem.colors.dangerText
                            : designSystem.colors.mutedForeground,
                    }}
                    fontFamily={designSystem.fonts.bodyMedium}
                    fontSize={13}
                    lineHeight={18}
                >
                    {hint}
                </Paragraph>
            )}
        </YStack>
    );
}

export interface FieldInputProps extends InputProps {
    /** Optional leading icon rendered inside the input frame. */
    readonly leadingIcon?: ReactNode;
    /** Optional trailing element (e.g. a visibility toggle). */
    readonly trailingAccessory?: ReactNode;
}

/**
 * Bordered input frame with an optional leading icon and trailing accessory.
 *
 * Wraps Tamagui's unstyled {@link Input} so every text field shares the same
 * 56pt frame, border, and typography.
 *
 * @param props Input props plus optional `leadingIcon` and `trailingAccessory`.
 * @returns A themed input row.
 */
export function FieldInput({ leadingIcon, trailingAccessory, ...rest }: FieldInputProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    return (
        <XStack
            items="center"
            gap="$3"
            px="$4"
            // 56pt phone frame unchanged; grows to 56–62pt on tablet so the field
            // scales with the tier (controlHeight token).
            height={layout.controlHeight}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.input}
        >
            {leadingIcon}
            <Input
                unstyled
                flex={1}
                placeholderTextColor="$color10"
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={16}
                {...rest}
            />
            {trailingAccessory}
        </XStack>
    );
}
