import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import {
    createResponsiveLayoutTokens,
    TABLET_TYPOGRAPHY_BASE_SCALE,
    type ResponsiveLayoutTokens,
} from "lib/responsive-layout-tokens";

export {
    FALLBACK_WINDOW_WIDTH,
    NARROW_TABLET_CONTENT_MAX_WIDTH,
    NARROW_TABLET_FORM_MAX_WIDTH,
    PHONE_CONTENT_MAX_WIDTH,
    PHONE_FORM_MAX_WIDTH,
    TABLET_READABLE_MAX_WIDTH,
    TABLET_BREAKPOINT,
    TABLET_TYPOGRAPHY_BASE_SCALE,
    WIDE_TABLET_BREAKPOINT,
    WIDE_TABLET_CONTENT_MAX_WIDTH,
    WIDE_TABLET_FORM_MAX_WIDTH,
} from "lib/responsive-layout-tokens";

interface ResponsiveContentWidthOptions {
    readonly bottomPadding: number;
    readonly gap?: number;
    readonly maxWidth?: number;
    readonly includeTopPadding?: boolean;
    /**
     * Top safe-area inset (`useSafeAreaInsets().top`) to add on top of the
     * vertical screen padding. Screens that render under the status bar pass
     * this so content clears the notch/status bar. Ignored when top padding is
     * disabled. Defaults to 0.
     */
    readonly topInset?: number;
}

/** Responsive layout values shared across phone and tablet screens. */
export type ResponsiveLayout = ResponsiveLayoutTokens;

export interface ResponsiveTabBarLayout {
    readonly contentHeight: number;
    readonly height: number;
    readonly paddingBottom: number;
    readonly paddingTop: number;
}

/**
 * Resolve a max-width override to a safe positive value.
 *
 * @param maxWidth Requested content max-width override.
 * @param fallback Default content max-width for the active layout tier.
 * @returns Safe max-width value.
 */
function resolveMaxWidth(maxWidth: number | undefined, fallback: number): number {
    return typeof maxWidth === "number" && Number.isFinite(maxWidth) && maxWidth > 0
        ? maxWidth
        : fallback;
}

/**
 * Convert spare tablet width into symmetric gutters once the viewport is wider
 * than the intended content track.
 *
 * @param layout Responsive layout tokens for the current viewport.
 * @param resolvedMaxWidth Requested content max-width.
 * @returns Horizontal padding that centers tablet content without constraining
 *          the outer container.
 */
function getAdaptiveHorizontalPadding(
    layout: Readonly<ResponsiveLayout>,
    resolvedMaxWidth: number,
): number {
    if (!layout.isTablet) {
        return layout.screenPaddingHorizontal;
    }

    const centeredPadding = Math.floor((layout.windowWidth - resolvedMaxWidth) / 2);

    return Math.max(centeredPadding, layout.screenPaddingHorizontal);
}

/**
 * Inner width of the centered content column (matches {@link getResponsiveContentContainerStyle}).
 * Use for report tables, charts, and other full-bleed components inside the standard content track.
 *
 * @param layout Active responsive layout tokens.
 * @param maxWidthOverride Optional `maxWidth` from container options (defaults to `contentMaxWidth`).
 * @returns Positive pixel width; zero only on pathological inputs.
 */
export function getContentTrackInnerWidth(
    layout: Readonly<ResponsiveLayout>,
    maxWidthOverride?: number,
): number {
    const resolvedMaxWidth = resolveMaxWidth(maxWidthOverride, layout.contentMaxWidth);
    const horizontalPadding = getAdaptiveHorizontalPadding(layout, resolvedMaxWidth);
    const inner = layout.windowWidth - horizontalPadding * 2;
    return Math.max(0, Math.min(inner, resolvedMaxWidth));
}

/**
 * Build responsive presentation tokens for a given viewport width.
 *
 * @param width Raw window width from React Native or tests.
 * @returns Responsive layout tokens for the active breakpoint tier.
 */
export function createResponsiveLayout(width: number): ResponsiveLayout {
    return createResponsiveLayoutTokens(width);
}

/**
 * Compose the auditor's text-size preference with the tablet baseline type
 * scale.
 *
 * Tablets multiply the stored preference by
 * {@link TABLET_TYPOGRAPHY_BASE_SCALE} so default-preference text is legible at
 * tablet viewing distance; phones return the preference unchanged.
 *
 * @param fontScale Stored font-scale preference multiplier.
 * @param isTablet Whether the active viewport uses the tablet layout tier.
 * @returns Effective multiplier for numeric font sizes and line heights.
 */
export function getEffectiveFontScale(fontScale: number, isTablet: boolean): number {
    return fontScale * (isTablet ? TABLET_TYPOGRAPHY_BASE_SCALE : 1);
}

export function getResponsiveTabBarLayout(
    layout: ResponsiveLayout,
    bottomInset: number,
): ResponsiveTabBarLayout {
    const safeBottomInset = Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;
    const contentHeight = layout.isTablet ? layout.buttonHeight : 26;
    const paddingTop = layout.isWideTablet ? 18 : layout.isTablet ? 10 : 16;
    const paddingBottom = layout.isWideTablet ? safeBottomInset - 8 : 6 + safeBottomInset;

    return {
        contentHeight,
        height: contentHeight + paddingTop + paddingBottom,
        paddingBottom,
        paddingTop,
    };
}

/**
 * Centralize tablet-aware padding and sizing so screens stay visually balanced
 * on iPad without disturbing compact phone layouts.
 *
 * @returns Responsive spacing and size tokens for the active viewport width.
 */
export function useResponsiveLayout(): ResponsiveLayout {
    const { width } = useWindowDimensions();

    return useMemo(() => createResponsiveLayout(width), [width]);
}

/**
 * Build a centered content container style for scroll and list screens.
 *
 * @param layout Responsive layout tokens for the current viewport.
 * @param options Padding, max-width, gap, and top-inset overrides.
 * @returns View style that centers wide-screen content safely.
 */
export function getResponsiveContentContainerStyle(
    layout: Readonly<ResponsiveLayout>,
    options: Readonly<ResponsiveContentWidthOptions>,
): ViewStyle {
    const resolvedMaxWidth = resolveMaxWidth(options.maxWidth, layout.contentMaxWidth);
    const horizontalPadding = getAdaptiveHorizontalPadding(layout, resolvedMaxWidth);
    const usesAdaptiveTabletGutters =
        layout.isTablet && horizontalPadding > layout.screenPaddingHorizontal;
    const style: ViewStyle = {
        width: "100%",
        paddingHorizontal: horizontalPadding,
        paddingBottom: Math.max(options.bottomPadding, 0),
    };

    if (!usesAdaptiveTabletGutters) {
        style.alignSelf = "center";
        style.maxWidth = resolvedMaxWidth + layout.screenPaddingHorizontal * 2;
    }

    if (options.includeTopPadding !== false) {
        const topInset =
            typeof options.topInset === "number" && options.topInset > 0 ? options.topInset : 0;
        style.paddingTop = layout.screenPaddingVertical + topInset;
    }

    if (typeof options.gap === "number" && Number.isFinite(options.gap) && options.gap > 0) {
        style.gap = options.gap;
    }

    return style;
}
