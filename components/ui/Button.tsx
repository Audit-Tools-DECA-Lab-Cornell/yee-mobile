import type { ReactNode } from "react";
import { Button, Text, XStack, type ButtonProps } from "tamagui";
import { designSystem } from "lib/design-system";

/**
 * Visual hierarchy for an action button.
 *
 * - `primary`: solid YEE-green call to action.
 * - `secondary`: bordered neutral surface.
 * - `ghost`: text-only, chromeless action.
 */
export type AppButtonVariant = "primary" | "secondary" | "ghost";

export interface AppButtonProps extends Omit<ButtonProps, "children" | "icon" | "variant"> {
    readonly label: string;
    readonly variant?: AppButtonVariant;
    /** Optional leading icon element. */
    readonly leadingIcon?: ReactNode;
    /** Optional trailing icon element. */
    readonly trailingIcon?: ReactNode;
}

interface VariantStyle {
    readonly background: string;
    readonly borderColor: string;
    readonly textColor: string;
}

/**
 * Resolve the color treatment for a button variant.
 *
 * @param variant Requested visual hierarchy.
 * @returns Background, border, and text colors for the variant.
 */
function resolveVariantStyle(variant: AppButtonVariant): VariantStyle {
    if (variant === "primary") {
        return {
            background: designSystem.colors.primary,
            borderColor: designSystem.colors.primary,
            textColor: designSystem.colors.primaryForeground,
        };
    }

    if (variant === "secondary") {
        return {
            background: designSystem.colors.surfaceMuted,
            borderColor: designSystem.colors.border,
            textColor: designSystem.colors.foreground,
        };
    }

    return {
        background: "transparent",
        borderColor: "transparent",
        textColor: designSystem.colors.primary,
    };
}

/**
 * Primary action button with a single, consistent token-driven treatment.
 *
 * Replaces the bespoke `Button` configurations duplicated across the login,
 * execute, review, and report screens. Touch target height defaults to 52pt to
 * satisfy the 44pt minimum from the mobile UI guidelines.
 *
 * @param props Button props including `label`, `variant`, and optional icons.
 * @returns A themed action button.
 */
export function AppButton({
    label,
    variant = "primary",
    leadingIcon,
    trailingIcon,
    disabled,
    ...rest
}: AppButtonProps) {
    const variantStyle = resolveVariantStyle(variant);

    return (
        <Button
            height={52}
            rounded={designSystem.radii.full}
            borderWidth={variant === "ghost" ? 0 : 1}
            opacity={disabled === true ? 0.6 : 1}
            disabled={disabled}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled === true }}
            {...rest}
            style={{
                backgroundColor: variantStyle.background,
                borderColor: variantStyle.borderColor,
            }}
        >
            <XStack items="center" justify="center" gap="$2">
                {leadingIcon}
                <Text
                    style={{ color: variantStyle.textColor }}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={16}
                >
                    {label}
                </Text>
                {trailingIcon}
            </XStack>
        </Button>
    );
}
