import type { ReactNode } from "react";
import { Button, XStack, type ButtonProps } from "tamagui";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import { ScaledText as Text } from "./ScaledText";

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
 * @param colors Active color tokens.
 * @returns Background, border, and text colors for the variant.
 */
function resolveVariantStyle(variant: AppButtonVariant, colors: ColorTokens): VariantStyle {
    if (variant === "primary") {
        return {
            background: colors.primary,
            borderColor: colors.primary,
            textColor: colors.primaryForeground,
        };
    }

    if (variant === "secondary") {
        return {
            background: colors.surfaceMuted,
            borderColor: colors.border,
            textColor: colors.foreground,
        };
    }

    return {
        background: "transparent",
        borderColor: "transparent",
        textColor: colors.primary,
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
    const designSystem = useDesignSystem();
    const variantStyle = resolveVariantStyle(variant, designSystem.colors);

    return (
        <Button
            height={52}
            rounded={designSystem.radii.button}
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
