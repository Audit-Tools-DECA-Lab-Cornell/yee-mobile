import type { ReactNode } from "react";
import { Button, Spinner, XStack, type ButtonProps } from "tamagui";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";
import { ScaledText as Text } from "./ScaledText";

/**
 * Visual hierarchy for an action button.
 *
 * - `primary`: solid YEE-green call to action.
 * - `secondary`: bordered neutral surface.
 * - `ghost`: text-only, chromeless action.
 */
export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface AppButtonProps extends Omit<ButtonProps, "children" | "icon" | "variant"> {
    readonly label: string;
    readonly variant?: AppButtonVariant;
    /** Optional leading icon element. */
    readonly leadingIcon?: ReactNode;
    /** Optional trailing icon element. */
    readonly trailingIcon?: ReactNode;
    readonly isLoading?: boolean;
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
            background: colors.surface,
            borderColor: colors.border,
            textColor: colors.foreground,
        };
    }

    if (variant === "danger") {
        return {
            background: colors.danger,
            borderColor: colors.danger,
            textColor: colors.primaryForeground,
        };
    }

    return {
        background: "transparent",
        borderColor: "transparent",
        textColor: colors.primaryText,
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
    isLoading = false,
    ...rest
}: AppButtonProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const variantStyle = resolveVariantStyle(variant, designSystem.colors);
    const isDisabled = disabled === true || isLoading;
    // Filled/bordered buttons carry a resting shadow so they read as tappable on
    // the near-white app background; ghost stays chromeless.
    const boxShadow = variant === "ghost" ? undefined : designSystem.shadows.card;

    return (
        <Button
            // Source height from the tier token so the tap target grows with the
            // 1.3x tablet type (52pt phone unchanged → 56–60pt tablet). A caller
            // that passes an explicit height (e.g. a square icon button) still
            // wins via {...rest} below.
            height={layout.buttonHeight}
            rounded={designSystem.radii.button}
            borderWidth={variant === "ghost" ? 0 : 1}
            opacity={isDisabled ? 0.6 : 1}
            disabled={isDisabled}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            accessibilityRole="button"
            accessibilityState={{ busy: isLoading, disabled: isDisabled }}
            {...rest}
            style={{
                backgroundColor: variantStyle.background,
                borderColor: variantStyle.borderColor,
                ...(boxShadow === undefined ? null : { boxShadow }),
            }}
        >
            <XStack items="center" justify="center" gap="$2">
                {isLoading ? <Spinner size="small" color={variantStyle.textColor} /> : leadingIcon}
                <Text
                    style={{ color: variantStyle.textColor }}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={16}
                >
                    {label}
                </Text>
                {isLoading ? null : trailingIcon}
            </XStack>
        </Button>
    );
}
