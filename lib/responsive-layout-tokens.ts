export const FALLBACK_WINDOW_WIDTH = 390;
export const TABLET_BREAKPOINT = 600;
export const WIDE_TABLET_BREAKPOINT = 960;
export const PHONE_CONTENT_MAX_WIDTH = 560;
export const NARROW_TABLET_CONTENT_MAX_WIDTH = 1040;
export const WIDE_TABLET_CONTENT_MAX_WIDTH = 1200;
export const PHONE_FORM_MAX_WIDTH = 560;
export const NARROW_TABLET_FORM_MAX_WIDTH = 600;
export const WIDE_TABLET_FORM_MAX_WIDTH = 600;
/**
 * Comfortable reading column for content-light detail screens (Execute,
 * Reports, Settings). Wider than a form column so the screen doesn't read like
 * a stretched phone, but capped well short of `contentMaxWidth` so short content
 * stays a composed, centered document instead of sprawling edge-to-edge.
 */
export const TABLET_READABLE_MAX_WIDTH = 760;

/**
 * Baseline typography multiplier applied on tablet screens on top of the
 * user's stored font-scale preference. A value of 1.3 means the default
 * (scale = 1.0) tablet font size equals what the phone renders at scale = 1.3,
 * making text immediately legible without requiring the user to raise the
 * accessibility slider.
 */
export const TABLET_TYPOGRAPHY_BASE_SCALE = 1.3;

const PHONE_LAYOUT_TOKENS = {
    screenPaddingHorizontal: 16,
    screenPaddingVertical: 16,
    contentMaxWidth: PHONE_CONTENT_MAX_WIDTH,
    formMaxWidth: PHONE_FORM_MAX_WIDTH,
    readableMaxWidth: PHONE_CONTENT_MAX_WIDTH,
    twoPaneGap: 20,
    homePageSupportRailWidth: 0,
    supportRailWidth: 0,
    sectionGap: 20,
    cardPadding: 16,
    buttonHeight: 52,
    controlHeight: 56,
    formOptionHeight: 48,
    compactControlHeight: 36,
    queueCardMinHeight: 0,
    summaryCardMinHeight: 0,
    heroCardMinHeight: 0,
} as const;

// Narrow-tablet floor (600dp). This band is where the primary device - the
// Samsung Tab S5e at ~800dp - and iPad 11" (834dp) live, so it is calibrated for
// real ~800dp use rather than as a waypoint to the 960 wide-tablet MAX: padding
// and section spacing are kept denser here so the 1.3x type does not read airy.
const TABLET_LAYOUT_TOKENS_MIN = {
    screenPaddingHorizontal: 24,
    screenPaddingVertical: 20,
    contentMaxWidth: NARROW_TABLET_CONTENT_MAX_WIDTH,
    formMaxWidth: NARROW_TABLET_FORM_MAX_WIDTH,
    readableMaxWidth: TABLET_READABLE_MAX_WIDTH,
    twoPaneGap: 24,
    homePageSupportRailWidth: 250,
    supportRailWidth: 240,
    sectionGap: 24,
    cardPadding: 16,
    buttonHeight: 56,
    controlHeight: 56,
    formOptionHeight: 48,
    compactControlHeight: 44,
    queueCardMinHeight: 152,
    summaryCardMinHeight: 144,
    heroCardMinHeight: 192,
} as const;

const TABLET_LAYOUT_TOKENS_MAX = {
    screenPaddingHorizontal: 36,
    screenPaddingVertical: 28,
    contentMaxWidth: WIDE_TABLET_CONTENT_MAX_WIDTH,
    formMaxWidth: WIDE_TABLET_FORM_MAX_WIDTH,
    readableMaxWidth: TABLET_READABLE_MAX_WIDTH,
    twoPaneGap: 32,
    homePageSupportRailWidth: 290,
    supportRailWidth: 300,
    sectionGap: 32,
    cardPadding: 16,
    buttonHeight: 60,
    controlHeight: 62,
    formOptionHeight: 52,
    compactControlHeight: 46,
    queueCardMinHeight: 168,
    summaryCardMinHeight: 160,
    heroCardMinHeight: 208,
} as const;

const LEGACY_PHONE_STAT_CARD_MIN_HEIGHT = 0;
const LEGACY_TABLET_STAT_CARD_MIN_HEIGHT = 140;

/**
 * Responsive layout values shared across phone and tablet screens.
 */
export interface ResponsiveLayoutTokens {
    readonly windowWidth: number;
    readonly isTablet: boolean;
    readonly isNarrowTablet: boolean;
    readonly isWideTablet: boolean;
    readonly isLargeTablet: boolean;
    readonly screenPaddingHorizontal: number;
    readonly screenPaddingVertical: number;
    readonly contentMaxWidth: number;
    readonly formMaxWidth: number;
    readonly readableMaxWidth: number;
    readonly twoPaneGap: number;
    readonly homePageSupportRailWidth: number;
    readonly supportRailWidth: number;
    readonly sectionGap: number;
    readonly cardPadding: number;
    readonly buttonHeight: number;
    readonly formOptionHeight: number;
    readonly controlHeight: number;
    readonly compactControlHeight: number;
    readonly queueCardMinHeight: number;
    readonly summaryCardMinHeight: number;
    readonly heroCardMinHeight: number;
    readonly statCardMinHeight: number;
}

/**
 * Guard against invalid dimension values before deriving breakpoint tokens.
 *
 * @param width Raw window width from React Native.
 * @returns Safe width value for layout calculations.
 */
function normalizeWindowWidth(width: number): number {
    return Number.isFinite(width) && width > 0 ? width : FALLBACK_WINDOW_WIDTH;
}

/**
 * Bound a numeric value between a minimum and maximum.
 *
 * @param value Runtime numeric value.
 * @param minimum Minimum allowed value.
 * @param maximum Maximum allowed value.
 * @returns The clamped numeric value.
 */
function clampNumber(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Convert the current tablet width into a bounded 0..1 interpolation value.
 *
 * @param windowWidth Safe viewport width.
 * @returns Interpolation progress between the tablet and wide-tablet widths.
 */
function getTabletWidthProgress(windowWidth: number): number {
    if (windowWidth < TABLET_BREAKPOINT) {
        return 0;
    }

    return clampNumber(
        (windowWidth - TABLET_BREAKPOINT) / (WIDE_TABLET_BREAKPOINT - TABLET_BREAKPOINT),
        0,
        1,
    );
}

/**
 * Interpolate between two numeric layout values.
 *
 * @param minimum Value used at the tablet breakpoint.
 * @param maximum Value used at wide-tablet widths and above.
 * @param progress Interpolation factor between 0 and 1.
 * @returns Rounded interpolated value.
 */
function interpolateLayoutValue(minimum: number, maximum: number, progress: number): number {
    return Math.round(minimum + (maximum - minimum) * progress);
}

/**
 * Build responsive presentation tokens for a given viewport width.
 *
 * @param width Raw window width from React Native or tests.
 * @returns Responsive layout tokens for the active breakpoint tier.
 */
export function createResponsiveLayoutTokens(width: number): ResponsiveLayoutTokens {
    const windowWidth = normalizeWindowWidth(width);
    const isTablet = windowWidth >= TABLET_BREAKPOINT;
    const isWideTablet = windowWidth >= WIDE_TABLET_BREAKPOINT;
    const isNarrowTablet = isTablet && !isWideTablet;
    const tabletWidthProgress = getTabletWidthProgress(windowWidth);

    return {
        windowWidth,
        isTablet,
        isNarrowTablet,
        isWideTablet,
        isLargeTablet: isWideTablet,
        screenPaddingHorizontal: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.screenPaddingHorizontal,
                  TABLET_LAYOUT_TOKENS_MAX.screenPaddingHorizontal,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.screenPaddingHorizontal,
        screenPaddingVertical: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.screenPaddingVertical,
                  TABLET_LAYOUT_TOKENS_MAX.screenPaddingVertical,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.screenPaddingVertical,
        contentMaxWidth: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.contentMaxWidth,
                  TABLET_LAYOUT_TOKENS_MAX.contentMaxWidth,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.contentMaxWidth,
        formMaxWidth: isTablet ? NARROW_TABLET_FORM_MAX_WIDTH : PHONE_LAYOUT_TOKENS.formMaxWidth,
        readableMaxWidth: isTablet
            ? TABLET_READABLE_MAX_WIDTH
            : PHONE_LAYOUT_TOKENS.readableMaxWidth,
        twoPaneGap: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.twoPaneGap,
                  TABLET_LAYOUT_TOKENS_MAX.twoPaneGap,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.twoPaneGap,
        homePageSupportRailWidth: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.homePageSupportRailWidth,
                  TABLET_LAYOUT_TOKENS_MAX.homePageSupportRailWidth,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.homePageSupportRailWidth,
        supportRailWidth: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.supportRailWidth,
                  TABLET_LAYOUT_TOKENS_MAX.supportRailWidth,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.supportRailWidth,
        sectionGap: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.sectionGap,
                  TABLET_LAYOUT_TOKENS_MAX.sectionGap,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.sectionGap,
        cardPadding: isTablet
            ? TABLET_LAYOUT_TOKENS_MIN.cardPadding
            : PHONE_LAYOUT_TOKENS.cardPadding,
        buttonHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.buttonHeight,
                  TABLET_LAYOUT_TOKENS_MAX.buttonHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.buttonHeight,
        formOptionHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.formOptionHeight,
                  TABLET_LAYOUT_TOKENS_MAX.formOptionHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.formOptionHeight,
        controlHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.controlHeight,
                  TABLET_LAYOUT_TOKENS_MAX.controlHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.controlHeight,
        compactControlHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.compactControlHeight,
                  TABLET_LAYOUT_TOKENS_MAX.compactControlHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.compactControlHeight,
        queueCardMinHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.queueCardMinHeight,
                  TABLET_LAYOUT_TOKENS_MAX.queueCardMinHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.queueCardMinHeight,
        summaryCardMinHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.summaryCardMinHeight,
                  TABLET_LAYOUT_TOKENS_MAX.summaryCardMinHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.summaryCardMinHeight,
        heroCardMinHeight: isTablet
            ? interpolateLayoutValue(
                  TABLET_LAYOUT_TOKENS_MIN.heroCardMinHeight,
                  TABLET_LAYOUT_TOKENS_MAX.heroCardMinHeight,
                  tabletWidthProgress,
              )
            : PHONE_LAYOUT_TOKENS.heroCardMinHeight,
        statCardMinHeight: isTablet
            ? LEGACY_TABLET_STAT_CARD_MIN_HEIGHT
            : LEGACY_PHONE_STAT_CARD_MIN_HEIGHT,
    };
}
