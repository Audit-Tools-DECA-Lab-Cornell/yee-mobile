# SHARED DESIGN-SYSTEM CORE (identical for every screen)

### package.json

```json
{
    "name": "yee-mobile",
    "version": "2.0.0-rc.22-1772903013031",
    "private": true,
    "main": "expo-router/entry",
    "scripts": {
        "dev": "bunx expo start --dev-client --tunnel",
        "upgrade:tamagui": "bunx npm-check-updates -u '*tamagui*' '@tamagui/*' && bun install",
        "start": "bunx expo start -c",
        "android": "expo run:android",
        "ios": "expo run:ios",
        "build": "expo export --platform all",
        "build:android": "expo export --platform android",
        "build:ios": "expo export --platform ios",
        "version:show": "node scripts/bump-version.mjs --show",
        "version:patch": "node scripts/bump-version.mjs --patch",
        "version:minor": "node scripts/bump-version.mjs --minor",
        "doctor": "npx expo-doctor",
        "test": "npx playwright test",
        "test:unit": "vitest run",
        "test:e2e": "npx playwright test",
        "typecheck": "tsc --noEmit",
        "lint": "eslint . --cache",
        "lint:fix": "eslint . --cache --fix",
        "format": "prettier . --write --ignore-unknown",
        "format:check": "prettier . --check --ignore-unknown",
        "check": "bun run typecheck && bun run lint && bun run format:check",
        "screenshots:ios": "node scripts/capture-screenshots.mjs --platform ios",
        "screenshots:android": "node scripts/capture-screenshots.mjs --platform android",
        "screenshots": "bun run screenshots:ios && bun run screenshots:android",
        "ci:quality": "bun run check && bun run doctor",
        "prepare": "husky"
    },
    "resolutions": {
        "@babel/core": "7.29.7",
        "@babel/helper-create-class-features-plugin": "7.29.7",
        "@babel/plugin-transform-class-static-block": "7.29.7"
    },
    "dependencies": {
        "@expo-google-fonts/geist": "^0.4.1",
        "@expo-google-fonts/jetbrains-mono": "^0.4.1",
        "@expo-google-fonts/space-grotesk": "^0.4.1",
        "@react-native-async-storage/async-storage": "2.2.0",
        "@react-native-community/netinfo": "11.5.2",
        "@react-navigation/native": "^7.0.14",
        "@tamagui/config": "2.0.0-rc.41",
        "@tamagui/toast": "2.0.0-rc.41",
        "babel-preset-expo": "~55.0.8",
        "burnt": "^0.12.2",
        "expo": "~55.0.27",
        "expo-build-properties": "~55.0.15",
        "expo-constants": "~55.0.7",
        "expo-dev-client": "~55.0.36",
        "expo-font": "~55.0.4",
        "expo-linking": "~55.0.16",
        "expo-navigation-bar": "~55.0.14",
        "expo-router": "~55.0.4",
        "expo-secure-store": "~55.0.15",
        "expo-splash-screen": "~55.0.22",
        "expo-status-bar": "~55.0.4",
        "expo-system-ui": "~55.0.19",
        "expo-updates": "~55.0.25",
        "expo-web-browser": "~55.0.17",
        "patch-package": "^8.0.1",
        "react": "19.2.0",
        "react-dom": "19.2.0",
        "react-native": "0.83.6",
        "react-native-keyboard-controller": "1.20.7",
        "react-native-mmkv": "^4.3.2",
        "react-native-nitro-modules": "^0.35.10",
        "react-native-reanimated": "4.2.1",
        "react-native-safe-area-context": "~5.6.0",
        "react-native-screens": "~4.23.0",
        "react-native-svg": "15.15.3",
        "react-native-web": "^0.21.0",
        "react-native-worklets": "0.7.4",
        "tamagui": "2.0.0-rc.41",
        "zod": "^4.3.6",
        "zustand": "^5.0.11"
    },
    "devDependencies": {
        "@babel/core": "7.29.7",
        "@babel/helper-create-class-features-plugin": "7.29.7",
        "@babel/plugin-transform-class-static-block": "7.29.7",
        "@expo/metro-runtime": "~55.0.6",
        "@playwright/test": "^1.49.1",
        "@tamagui/babel-plugin": "2.0.0-rc.41",
        "@types/react": "~19.2.10",
        "eslint": "^9.39.4",
        "eslint-config-expo": "^55.0.0",
        "eslint-config-prettier": "^10.1.8",
        "husky": "^9.1.7",
        "lint-staged": "^16.3.2",
        "prettier": "^3.8.1",
        "serve": "^14.2.5",
        "typescript": "~5.9.2",
        "vitest": "^4.1.9"
    },
    "lint-staged": {
        "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "prettier --write"],
        "*.{json,md,yml,yaml}": "prettier --write --ignore-unknown"
    },
    "packageManager": "bun@1.3.9"
}
```

### tamagui.config.ts

```tsx
import { defaultConfig } from "@tamagui/config/v5";
import { createFont, createTamagui } from "tamagui";
import { themes } from "./themes";

/**
 * Create a Tamagui font token backed by a single native family.
 *
 * @param family Native font family name loaded through `expo-font`.
 * @param sourceFont Base Tamagui font token to inherit sizing from.
 * @returns Tamagui font configuration for the given family.
 */
function createStaticFont(family: string, sourceFont: typeof defaultConfig.fonts.body) {
    return createFont({
        ...sourceFont,
        family,
        face: {
            400: { normal: family },
            500: { normal: family },
            600: { normal: family },
            700: { normal: family },
        },
    });
}

const bodyFont = createStaticFont("Geist-Regular", defaultConfig.fonts.body);
const bodyMediumFont = createStaticFont("Geist-Medium", defaultConfig.fonts.body);
const bodySemiBoldFont = createStaticFont("Geist-SemiBold", defaultConfig.fonts.body);
const bodyBoldFont = createStaticFont("Geist-Bold", defaultConfig.fonts.body);
const headingMediumFont = createStaticFont("SpaceGrotesk-Medium", defaultConfig.fonts.heading);
const headingBoldFont = createStaticFont("SpaceGrotesk-Bold", defaultConfig.fonts.heading);
const monoFont = createStaticFont("JetBrainsMono-Regular", defaultConfig.fonts.body);
const monoMediumFont = createStaticFont("JetBrainsMono-Medium", defaultConfig.fonts.body);
const monoBoldFont = createStaticFont("JetBrainsMono-Bold", defaultConfig.fonts.body);
const dyslexicFont = createStaticFont("OpenDyslexic-Regular", defaultConfig.fonts.body);
const dyslexicBoldFont = createStaticFont("OpenDyslexic-Bold", defaultConfig.fonts.body);

export const config = createTamagui({
    ...defaultConfig,
    fonts: {
        ...defaultConfig.fonts,
        body: bodyFont,
        bodyMedium: bodyMediumFont,
        bodySemiBold: bodySemiBoldFont,
        bodyBold: bodyBoldFont,
        heading: headingBoldFont,
        headingMedium: headingMediumFont,
        headingBold: headingBoldFont,
        mono: monoFont,
        monoMedium: monoMediumFont,
        monoBold: monoBoldFont,
        dyslexic: dyslexicFont,
        dyslexicBold: dyslexicBoldFont,
    },
    themes,
    media: {
        ...defaultConfig.media,
    },
});

type OurConfig = typeof config;

declare module "tamagui" {
    // This is required for Tamagui module augmentation.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface TamaguiCustomConfig extends OurConfig {}
}

export default config;
```

### themes.ts

```tsx
import { createV5Theme, defaultChildrenThemes } from "@tamagui/config/v5";
import { v5ComponentThemes } from "@tamagui/themes/v5";
import { yellow, yellowDark, red, redDark, green, greenDark } from "@tamagui/colors";

const darkPalette = [
    "hsla(32, 15%, 27%, 1)",
    "hsla(32, 16%, 25%, 1)",
    "hsla(32, 17%, 24%, 1)",
    "hsla(32, 18%, 22%, 1)",
    "hsla(110, 18%, 32%, 1)",
    "hsla(188, 19%, 43%, 1)",
    "hsla(135, 19%, 45%, 1)",
    "hsla(83, 20%, 48%, 1)",
    "hsla(30, 20%, 50%, 1)",
    "hsla(28, 22%, 85%, 1)",
    "hsla(25, 25%, 95%, 1)",
    "hsla(22, 28%, 98%, 1)",
];
const lightPalette = [
    "hsla(32, 25%, 97%, 1)",
    "hsla(31, 27%, 93%, 1)",
    "hsla(31, 28%, 89%, 1)",
    "hsla(30, 30%, 85%, 1)",
    "hsla(29, 31%, 74%, 1)",
    "hsla(27, 33%, 64%, 1)",
    "hsla(26, 33%, 59%, 1)",
    "hsla(26, 34%, 55%, 1)",
    "hsla(25, 35%, 50%, 1)",
    "hsla(20, 40%, 20%, 1)",
    "hsla(15, 45%, 10%, 1)",
    "hsla(10, 50%, 5%, 1)",
];

// Your custom accent color theme
const accentLight = {
    accent1: "hsla(180, 50%, 70%, 1)",
    accent2: "hsla(180, 48%, 68%, 1)",
    accent3: "hsla(180, 45%, 65%, 1)",
    accent4: "hsla(35, 60%, 60%, 1)",
    accent5: "hsla(36, 59%, 58%, 1)",
    accent6: "hsla(37, 58%, 56%, 1)",
    accent7: "hsla(38, 57%, 54%, 1)",
    accent8: "hsla(39, 56%, 52%, 1)",
    accent9: "hsla(40, 55%, 50%, 1)",
    accent10: "hsla(30, 65%, 35%, 1)",
    accent11: "hsla(28, 70%, 30%, 1)",
    accent12: "hsla(25, 75%, 25%, 1)",
};

const accentDark = {
    accent1: "hsla(180, 60%, 30%, 1)",
    accent2: "hsla(180, 57%, 32%, 1)",
    accent3: "hsla(180, 55%, 35%, 1)",
    accent4: "hsla(35, 70%, 40%, 1)",
    accent5: "hsla(36, 69%, 44%, 1)",
    accent6: "hsla(37, 68%, 48%, 1)",
    accent7: "hsla(38, 67%, 52%, 1)",
    accent8: "hsla(39, 66%, 56%, 1)",
    accent9: "hsla(40, 65%, 60%, 1)",
    accent10: "hsla(45, 50%, 80%, 1)",
    accent11: "hsla(48, 45%, 90%, 1)",
    accent12: "hsla(50, 40%, 95%, 1)",
};

const builtThemes = createV5Theme({
    darkPalette,
    lightPalette,
    componentThemes: v5ComponentThemes,
    accent: {
        light: accentLight,
        dark: accentDark,
    },
    childrenThemes: {
        // Include default color themes (blue, red, green, yellow, etc.)
        ...defaultChildrenThemes,

        // Semantic color themes for warnings, errors, and success states
        warning: {
            light: yellow,
            dark: yellowDark,
        },
        error: {
            light: red,
            dark: redDark,
        },
        success: {
            light: green,
            dark: greenDark,
        },
    },
});

export type Themes = typeof builtThemes;

export const themes: Themes = builtThemes;
```

### lib/design-system.ts

```tsx
import { useMemo } from "react";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import type { MetricTone, PlaceStatus, PreAuditStatus } from "./yee-demo-data";

/**
 * Calm, warm light palette used as the product's default appearance.
 */
export const lightColors = {
    background: "#FBFAF6",
    backgroundAccent: "#F6F3EC",
    foreground: "#0F1720",
    primary: "#10231F",
    primaryForeground: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F8F4EE",
    mutedSurface: "#F0EBE2",
    input: "#FBFCFE",
    border: "#DDD6CB",
    mutedForeground: "#6B706F",
    secondaryForeground: "#4D5966",
    success: "#5E9C83",
    warning: "#C89A57",
    danger: "#B5483D",
    info: "#7B9ED9",
    mint: "#9DDCCF",
    sky: "#DFE9FB",
    amber: "#F8E6BE",
    rose: "#F6DADF",
    violet: "#C6B6EE",
    overlay: "rgba(251, 250, 246, 0.92)",
    primarySoft: "rgba(16, 35, 31, 0.06)",
    successSoft: "rgba(94, 156, 131, 0.14)",
    warningSoft: "rgba(200, 154, 87, 0.18)",
    dangerSoft: "rgba(181, 72, 61, 0.10)",
    infoSoft: "rgba(123, 158, 217, 0.16)",
    mintSoft: "rgba(157, 220, 207, 0.24)",
    skySoft: "rgba(223, 233, 251, 0.92)",
    amberSoft: "rgba(248, 230, 190, 0.88)",
    roseSoft: "rgba(246, 218, 223, 0.85)",
    violetSoft: "rgba(198, 182, 238, 0.18)",
} as const;

/** Color token names shared by every theme. */
export type ColorTokens = Record<keyof typeof lightColors, string>;

/**
 * Warm dark palette tuned for low-light field use. Foreground/background pairs
 * keep AA contrast, and accent tints are softened so they read on dark surfaces.
 *
 * Declared `as const` so each value keeps its literal type and remains a valid
 * Tamagui color; `satisfies` enforces shape parity with the light palette.
 */
export const darkColors = {
    background: "#141513",
    backgroundAccent: "#1B1C18",
    foreground: "#F3F1EC",
    primary: "#7FBFA3",
    primaryForeground: "#0E1A16",
    surface: "#1E201C",
    surfaceMuted: "#24261F",
    mutedSurface: "#2B2D26",
    input: "#1B1D19",
    border: "#34362E",
    mutedForeground: "#A7A99F",
    secondaryForeground: "#C9C8BF",
    success: "#7FBFA3",
    warning: "#E0B873",
    danger: "#E08379",
    info: "#9DB8E6",
    mint: "#9DDCCF",
    sky: "#9DB8E6",
    amber: "#E0B873",
    rose: "#E08379",
    violet: "#C6B6EE",
    overlay: "rgba(20, 21, 19, 0.92)",
    primarySoft: "rgba(127, 191, 163, 0.16)",
    successSoft: "rgba(127, 191, 163, 0.16)",
    warningSoft: "rgba(224, 184, 115, 0.16)",
    dangerSoft: "rgba(224, 131, 121, 0.16)",
    infoSoft: "rgba(157, 184, 230, 0.16)",
    mintSoft: "rgba(157, 220, 207, 0.18)",
    skySoft: "rgba(157, 184, 230, 0.14)",
    amberSoft: "rgba(224, 184, 115, 0.16)",
    roseSoft: "rgba(224, 131, 121, 0.16)",
    violetSoft: "rgba(198, 182, 238, 0.16)",
} as const satisfies ColorTokens;

/** Default typeface tokens (Geist body, Space Grotesk headings). */
const defaultFonts = {
    bodyRegular: "$body",
    bodyMedium: "$bodyMedium",
    bodySemiBold: "$bodySemiBold",
    bodyBold: "$bodyBold",
    headingMedium: "$headingMedium",
    headingBold: "$headingBold",
    monoMedium: "$monoMedium",
    monoBold: "$monoBold",
} as const;

/** Font token names shared by every typeface set. */
export type FontTokens = Record<keyof typeof defaultFonts, string>;

/**
 * Dyslexia-friendly typeface set. OpenDyslexic ships Regular and Bold only, so
 * medium/semibold map to the nearest available weight; data figures stay
 * monospaced for column alignment.
 */
const dyslexicFonts = {
    bodyRegular: "$dyslexic",
    bodyMedium: "$dyslexic",
    bodySemiBold: "$dyslexicBold",
    bodyBold: "$dyslexicBold",
    headingMedium: "$dyslexicBold",
    headingBold: "$dyslexicBold",
    monoMedium: "$monoMedium",
    monoBold: "$monoBold",
} as const satisfies FontTokens;

const fontWeights = {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
} as const;

const radii = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    /**
     * Shared corner radius for interactive buttons (option rows, primary/secondary
     * actions, nav pills). Kept deliberately tight so buttons read as a polished,
     * professional app rather than fully-rounded "toy" pills. Tune this single knob
     * to adjust button roundness everywhere; badges/progress tracks/avatars keep
     * their own `full` pill radius.
     */
    button: 10,
    full: 999,
} as const;

const spacing = {
    screenPaddingHorizontal: 15,
    screenPaddingVertical: 16,
} as const;

const lightShadows = {
    card: "0 12px 34px rgba(46, 56, 52, 0.08)",
    accent: "0 10px 24px rgba(86, 108, 98, 0.12)",
} as const;

const darkShadows = {
    card: "0 14px 34px rgba(0, 0, 0, 0.45)",
    accent: "0 10px 24px rgba(0, 0, 0, 0.4)",
} as const;

/**
 * Static light token set.
 *
 * Used by module-level style constants (which cannot call hooks) and remains the
 * default for any surface that has not adopted {@link useDesignSystem}. Screens
 * that need live theme switching should read the hook instead.
 */
export const designSystem = {
    colors: lightColors,
    fonts: defaultFonts,
    fontWeights,
    radii,
    spacing,
    shadows: lightShadows,
} as const;

interface GetDesignSystemOptions {
    readonly fontScale?: number;
    readonly dyslexicFont?: boolean;
}

/**
 * Build a resolved design system for a given theme and accessibility options.
 *
 * The return type is inferred so color and font values keep their literal types
 * and stay assignable to Tamagui's token-constrained props.
 *
 * @param theme Active light or dark theme.
 * @param options Text scale and dyslexia-friendly font selection.
 * @returns Theme-aware tokens.
 */
export function getDesignSystem(theme: ResolvedTheme, options: GetDesignSystemOptions = {}) {
    return {
        colors: theme === "dark" ? darkColors : lightColors,
        fonts: options.dyslexicFont ? dyslexicFonts : defaultFonts,
        fontWeights,
        radii,
        spacing,
        shadows: theme === "dark" ? darkShadows : lightShadows,
        fontScale: options.fontScale ?? 1,
        theme,
    };
}

/** Resolved, theme-aware design tokens consumed across the app. */
export type DesignSystem = ReturnType<typeof getDesignSystem>;

/**
 * Subscribe to the resolved, theme-aware design system.
 *
 * Re-renders the caller whenever the auditor changes theme, text size, or the
 * dyslexia-friendly font preference.
 *
 * @returns Live design tokens for the current preferences.
 */
export function useDesignSystem(): DesignSystem {
    const theme = usePreferencesStore((state) => state.resolvedTheme);
    const fontScale = usePreferencesStore((state) => state.fontScale);
    const dyslexicFont = usePreferencesStore((state) => state.dyslexicFont);

    return useMemo(
        () => getDesignSystem(theme, { fontScale, dyslexicFont }),
        [theme, fontScale, dyslexicFont],
    );
}

/**
 * Shared tone model for chips, badges, and accent surfaces.
 */
export interface DesignTone {
    readonly accent: string;
    readonly surface: string;
    readonly text: string;
}

/**
 * Resolve metric colors into the active palette.
 *
 * @param tone Dashboard metric tone.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the metric.
 */
export function getMetricTone(tone: MetricTone, colors: ColorTokens = lightColors): DesignTone {
    if (tone === "green") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (tone === "purple") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violet };
    }

    if (tone === "orange") {
        return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
    }

    return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
}

/**
 * Resolve place status colors into a consistent badge treatment.
 *
 * @param status Place workflow status.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the status.
 */
export function getPlaceStatusTone(
    status: PlaceStatus,
    colors: ColorTokens = lightColors,
): DesignTone {
    if (status === "submitted") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (status === "ready_for_review") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violet };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
}

/**
 * Resolve pre-audit readiness colors into the active palette.
 *
 * @param status Pre-audit setup status.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the status.
 */
export function getPreAuditTone(
    status: PreAuditStatus,
    colors: ColorTokens = lightColors,
): DesignTone {
    if (status === "completed") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
}
```

### lib/responsive-layout.ts

```tsx
import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import {
    createResponsiveLayoutTokens,
    type ResponsiveLayoutTokens,
} from "lib/responsive-layout-tokens";

export {
    FALLBACK_WINDOW_WIDTH,
    NARROW_TABLET_CONTENT_MAX_WIDTH,
    NARROW_TABLET_FORM_MAX_WIDTH,
    PHONE_CONTENT_MAX_WIDTH,
    PHONE_FORM_MAX_WIDTH,
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

export function getResponsiveTabBarLayout(
    layout: Pick<ResponsiveLayout, "buttonHeight" | "isTablet">,
    bottomInset: number,
): ResponsiveTabBarLayout {
    const safeBottomInset = Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;
    const contentHeight = layout.isTablet ? layout.buttonHeight : 26;
    const paddingTop = layout.isTablet ? 10 : 8;
    const paddingBottom = 8 + safeBottomInset;

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
```

### lib/responsive-layout-tokens.ts

```tsx
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
 * Baseline typography multiplier applied on tablet screens on top of the
 * user's stored font-scale preference. A value of 1.3 means the default
 * (scale = 1.0) tablet font size equals what the phone renders at scale = 1.3,
 * making text immediately legible without requiring the user to raise the
 * accessibility slider.
 */
export const TABLET_TYPOGRAPHY_BASE_SCALE = 1.3;

const PHONE_LAYOUT_TOKENS = {
    screenPaddingHorizontal: 15,
    screenPaddingVertical: 16,
    contentMaxWidth: PHONE_CONTENT_MAX_WIDTH,
    formMaxWidth: PHONE_FORM_MAX_WIDTH,
    twoPaneGap: 20,
    homePageSupportRailWidth: 0,
    supportRailWidth: 0,
    sectionGap: 20,
    cardPadding: 16,
    buttonHeight: 52,
    formOptionHeight: 42,
    compactControlHeight: 36,
    queueCardMinHeight: 0,
    summaryCardMinHeight: 0,
    heroCardMinHeight: 0,
} as const;

const TABLET_LAYOUT_TOKENS_MIN = {
    screenPaddingHorizontal: 28,
    screenPaddingVertical: 24,
    contentMaxWidth: NARROW_TABLET_CONTENT_MAX_WIDTH,
    formMaxWidth: NARROW_TABLET_FORM_MAX_WIDTH,
    twoPaneGap: 24,
    homePageSupportRailWidth: 250,
    supportRailWidth: 240,
    sectionGap: 28,
    cardPadding: 16,
    buttonHeight: 56,
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
    twoPaneGap: 32,
    homePageSupportRailWidth: 290,
    supportRailWidth: 300,
    sectionGap: 32,
    cardPadding: 16,
    buttonHeight: 60,
    formOptionHeight: 52,
    compactControlHeight: 46,
    queueCardMinHeight: 168,
    summaryCardMinHeight: 160,
    heroCardMinHeight: 208,
} as const;

const LEGACY_PHONE_CONTROL_HEIGHT = 52;
const LEGACY_TABLET_CONTROL_HEIGHT = 56;
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
        controlHeight: isTablet ? LEGACY_TABLET_CONTROL_HEIGHT : LEGACY_PHONE_CONTROL_HEIGHT,
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
```

### lib/system-bars.ts

```tsx
import { useEffect } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

export function applyHiddenNavBar(): void {
    if (Platform.OS !== "android") {
        return;
    }
    void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
}

export function useHiddenAndroidNavBar(routeKey: string): void {
    useEffect(() => {
        applyHiddenNavBar();

        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
                applyHiddenNavBar();
            }
        });
        const keyboardShowSubscription = Keyboard.addListener("keyboardDidShow", applyHiddenNavBar);
        const keyboardHideSubscription = Keyboard.addListener("keyboardDidHide", applyHiddenNavBar);

        return () => {
            subscription.remove();
            keyboardShowSubscription.remove();
            keyboardHideSubscription.remove();
        };
    }, []);

    useEffect(() => {
        applyHiddenNavBar();
    }, [routeKey]);
}
```

### components/Provider.tsx

```tsx
import { TamaguiProvider, type TamaguiProviderProps } from "tamagui";
import { ToastProvider, ToastViewport } from "@tamagui/toast";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CurrentToast } from "./CurrentToast";
import { config as tamaguiConfig } from "../tamagui.config";
import { usePreferencesStore } from "stores/preferences-store";

function SafeToastViewport() {
    const insets = useSafeAreaInsets();

    return <ToastViewport top={insets.top + 8} left={insets.left} right={insets.right} />;
}

export function Provider({
    children,
    ...rest
}: Readonly<Omit<TamaguiProviderProps, "config" | "defaultTheme">>) {
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    return (
        <KeyboardProvider>
            <SafeAreaProvider>
                <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme} {...rest}>
                    <ToastProvider swipeDirection="horizontal" duration={6000} native={[]}>
                        {children}
                        <CurrentToast />
                        <SafeToastViewport />
                    </ToastProvider>
                </TamaguiProvider>
            </SafeAreaProvider>
        </KeyboardProvider>
    );
}
```

### app/_layout.tsx

```tsx
import "../tamagui.generated.css";

import {
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import NetInfo from "@react-native-community/netinfo";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Provider } from "components/Provider";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import { useHiddenAndroidNavBar } from "lib/system-bars";
import { useEffect, useMemo, useState } from "react";
import { Appearance, KeyboardAvoidingView, Platform } from "react-native";
import { useAuthStore } from "stores/auth-store";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

export { ErrorBoundary } from "expo-router";

const SCREENSHOT_AUTOMATION_ENABLED = __DEV__;

export const unstable_settings = {
    initialRouteName: "(auth)",
};

/**
 * Keep splash visible until fonts and auth startup are ready.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Load saved display preferences synchronously before first paint so the app
// opens directly in the auditor's chosen theme without a flash.
usePreferencesStore.getState().hydrate();

/**
 * Build a React Navigation theme from the active palette.
 *
 * @param colors Active color tokens.
 * @param scheme Resolved light or dark theme.
 * @returns Navigation theme matching the app palette.
 */
function buildNavigationTheme(colors: ColorTokens, scheme: ResolvedTheme) {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
        ...base,
        colors: {
            ...base.colors,
            background: colors.background,
            card: colors.surface,
            primary: colors.primary,
            text: colors.foreground,
            border: colors.border,
            notification: colors.primary,
        },
    };
}

/**
 * Root app layout that mounts providers and tab routes.
 */
const STARTUP_FALLBACK_TIMEOUT_MS = 8000;

export default function RootLayout() {
    const [startupFallbackElapsed, setStartupFallbackElapsed] = useState(false);
    const [fontsLoaded, fontError] = useFonts({
        "Geist-Regular": Geist_400Regular,
        "Geist-Medium": Geist_500Medium,
        "Geist-SemiBold": Geist_600SemiBold,
        "Geist-Bold": Geist_700Bold,
        "SpaceGrotesk-Regular": SpaceGrotesk_400Regular,
        "SpaceGrotesk-Medium": SpaceGrotesk_500Medium,
        "SpaceGrotesk-SemiBold": SpaceGrotesk_600SemiBold,
        "SpaceGrotesk-Bold": SpaceGrotesk_700Bold,
        "JetBrainsMono-Regular": JetBrainsMono_400Regular,
        "JetBrainsMono-Medium": JetBrainsMono_500Medium,
        "JetBrainsMono-SemiBold": JetBrainsMono_600SemiBold,
        "JetBrainsMono-Bold": JetBrainsMono_700Bold,
        "OpenDyslexic-Regular": require("../assets/fonts/OpenDyslexic-Regular.ttf"),
        "OpenDyslexic-Bold": require("../assets/fonts/OpenDyslexic-Bold.ttf"),
    });
    const canRenderApp = fontsLoaded || Boolean(fontError) || startupFallbackElapsed;

    useEffect(() => {
        if (canRenderApp) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setStartupFallbackElapsed(true);
            void SplashScreen.hideAsync().catch(() => undefined);
        }, STARTUP_FALLBACK_TIMEOUT_MS);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [canRenderApp]);

    if (!canRenderApp) {
        return null;
    }

    return (
        <Providers>
            <RootLayoutNav />
        </Providers>
    );
}

interface ProvidersProps {
    readonly children: React.ReactNode;
}

/**
 * Wrapper for all global providers.
 */
function Providers({ children }: ProvidersProps) {
    return <Provider>{children}</Provider>;
}

/**
 * Root navigator with auth and app route groups.
 */
function RootLayoutNav() {
    const router = useRouter();
    const segments = useSegments();
    const routeKey = segments.join("/");
    const authStatus = useAuthStore((state) => state.status);
    const session = useAuthStore((state) => state.session);
    const initializeAuth = useAuthStore((state) => state.initialize);
    const hydrateOfflineState = useYeeMobileStore((state) => state.hydrateOfflineState);
    const refreshRemoteState = useYeeMobileStore((state) => state.refreshRemoteState);
    const syncPendingQueue = useYeeMobileStore((state) => state.syncPendingQueue);
    const setConnectivityState = useYeeMobileStore((state) => state.setConnectivityState);
    const isOnline = useYeeMobileStore((state) => state.isOnline);
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    const syncSystemTheme = usePreferencesStore((state) => state.syncSystemTheme);
    const designSystem = useDesignSystem();
    const navigationTheme = useMemo(
        () => buildNavigationTheme(designSystem.colors, resolvedTheme),
        [designSystem.colors, resolvedTheme],
    );

    useHiddenAndroidNavBar(routeKey);

    useEffect(() => {
        void initializeAuth();
        void hydrateOfflineState();
    }, [hydrateOfflineState, initializeAuth]);

    useEffect(() => {
        const subscription = Appearance.addChangeListener(() => {
            syncSystemTheme();
        });

        return () => {
            subscription.remove();
        };
    }, [syncSystemTheme]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setConnectivityState(Boolean(state.isConnected && state.isInternetReachable !== false));
        });

        return () => {
            unsubscribe();
        };
    }, [setConnectivityState]);

    useEffect(() => {
        if (authStatus !== "authenticated" || session === null || !isOnline) {
            return;
        }

        void syncPendingQueue(session).then(() => refreshRemoteState(session));
    }, [authStatus, isOnline, refreshRemoteState, session, syncPendingQueue]);

    useEffect(() => {
        if (authStatus !== "loading") {
            void SplashScreen.hideAsync().catch(() => undefined);
        }
    }, [authStatus]);

    useEffect(() => {
        if (authStatus === "loading") {
            return;
        }

        const segment0 = String(segments[0] ?? "");
        const inAuthGroup = segment0 === "(auth)";
        const isScreenshotAutomationRoute = segment0 === "__screenshot-bootstrap";
        const canBypassAuthForScreenshotAutomation =
            SCREENSHOT_AUTOMATION_ENABLED && isScreenshotAutomationRoute;

        // Allow the screenshot bootstrap route to manage auth state and
        // redirection itself so simulator automation can open any target page.
        if (canBypassAuthForScreenshotAutomation) {
            return;
        }

        if (authStatus === "authenticated" && inAuthGroup) {
            router.replace("/(tabs)");
            return;
        }

        if (authStatus === "unauthenticated" && !inAuthGroup) {
            router.replace("/(auth)/login");
        }
    }, [authStatus, router, segments]);

    if (authStatus === "loading") {
        return null;
    }

    return (
        <ThemeProvider value={navigationTheme}>
            <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <Stack
                    screenOptions={{
                        contentStyle: {
                            backgroundColor: designSystem.colors.background,
                            paddingTop: 20,
                        },
                    }}
                >
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="audit/[placeId]" options={{ headerShown: false }} />
                    <Stack.Screen
                        name="reports/[submissionId]"
                        options={{ headerShown: true, title: "Report" }}
                    />
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                </Stack>
            </KeyboardAvoidingView>
        </ThemeProvider>
    );
}
```

### app/(tabs)/_layout.tsx

```tsx
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { BarChart3, ClipboardCheck, LayoutDashboard, MapPinned } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import {
    getResponsiveTabBarLayout,
    useResponsiveLayout,
    type ResponsiveLayout,
} from "lib/responsive-layout";

interface TabIconProps {
    readonly focused: boolean;
    readonly size: number;
    readonly color: string;
}

/**
 * Dashboard tab icon renderer.
 */
function DashboardTabIcon({ size, color }: TabIconProps) {
    return <LayoutDashboard color={color} size={size} />;
}

/**
 * Places tab icon renderer.
 */
function PlacesTabIcon({ size, color }: TabIconProps) {
    return <MapPinned color={color} size={size} />;
}

/**
 * Execute tab icon renderer.
 */
function ExecuteTabIcon({ size, color }: TabIconProps) {
    return <ClipboardCheck color={color} size={size} />;
}

/**
 * Reports tab icon renderer.
 */
function ReportsTabIcon({ size, color }: TabIconProps) {
    return <BarChart3 color={color} size={size} />;
}

function getResponsiveTabIconSize(
    layout: Pick<ResponsiveLayout, "isTablet">,
    defaultSize: number,
): number {
    return layout.isTablet ? 22 : defaultSize;
}

/**
 * Main tab layout for the YEE mobile app.
 */
export default function TabLayout() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const tabBarLayout = getResponsiveTabBarLayout(layout, insets.bottom);
    const tabBarLabelFontSize = layout.isTablet ? 12 : 10;
    const tabBarLabelLineHeight = layout.isTablet ? 16 : 14;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: {
                    backgroundColor: designSystem.colors.background,
                },
                tabBarActiveTintColor: designSystem.colors.primary,
                tabBarInactiveTintColor: designSystem.colors.mutedForeground,
                tabBarStyle: {
                    backgroundColor: designSystem.colors.background,
                    borderTopColor: designSystem.colors.border,
                    height: tabBarLayout.height,
                    paddingTop: tabBarLayout.paddingTop - 10,
                    paddingBottom: tabBarLayout.paddingBottom,
                },
                tabBarItemStyle: {
                    borderRadius: layout.isTablet ? designSystem.radii.md : 0,
                    marginHorizontal: layout.isTablet ? 4 : 0,
                    marginVertical: layout.isTablet ? 6 : 0,
                    paddingTop: 0,
                },
                tabBarLabelStyle: {
                    fontSize: tabBarLabelFontSize,
                    lineHeight: tabBarLabelLineHeight,
                    fontFamily: designSystem.fonts.bodyBold,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <DashboardTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="places"
                options={{
                    title: "Places",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <PlacesTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="execute"
                options={{
                    title: "Execute",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <ExecuteTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: "Reports",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <ReportsTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
```

### components/ui/Badge.tsx

```tsx
import { XStack, type XStackProps } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import type { DesignTone } from "lib/design-system";
import { ScaledText } from "./ScaledText";

export interface BadgeProps extends XStackProps {
    /** Label rendered inside the badge. */
    readonly label: string;
    /** Tone providing accent/surface/text colors. Defaults to the primary tone. */
    readonly tone?: DesignTone;
    /** Render as a small uppercase eyebrow pill. Defaults to `false`. */
    readonly uppercase?: boolean;
}

/**
 * Pill-shaped status indicator backed by a {@link DesignTone}.
 *
 * Consolidates the inline status/eyebrow pills that were re-declared across the
 * execute, places, dashboard, and report screens.
 *
 * @param props Badge props including `label`, `tone`, and `uppercase`.
 * @returns A themed pill element.
 */
export function Badge({ label, tone, uppercase = true, ...rest }: BadgeProps) {
    const designSystem = useDesignSystem();
    const resolvedTone: DesignTone = tone ?? {
        accent: designSystem.colors.primary,
        surface: designSystem.colors.primarySoft,
        text: designSystem.colors.primary,
    };

    return (
        <XStack
            rounded={designSystem.radii.full}
            px="$3"
            py="$1"
            style={{ backgroundColor: resolvedTone.surface, alignSelf: "flex-start" }}
            {...rest}
        >
            <ScaledText
                style={{ color: resolvedTone.text }}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={uppercase ? 10 : 12}
                {...(uppercase ? { textTransform: "uppercase", letterSpacing: 1.2 } : null)}
            >
                {label}
            </ScaledText>
        </XStack>
    );
}
```

### components/ui/Button.tsx

```tsx
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
```

### components/ui/Card.tsx

```tsx
import type { ReactNode } from "react";
import { YStack, type YStackProps } from "tamagui";
import { useDesignSystem } from "lib/design-system";

/**
 * Visual emphasis applied to a card surface.
 *
 * - `raised`: elevated surface with the standard card shadow.
 * - `flat`: bordered surface without a shadow, for nested groupings.
 * - `muted`: tinted inset surface used inside a raised card.
 */
export type CardVariant = "raised" | "flat" | "muted";

export interface CardProps extends YStackProps {
    /** Visual emphasis for the surface. Defaults to `raised`. */
    readonly variant?: CardVariant;
    readonly children?: ReactNode;
}

/**
 * Standard bordered surface used to group related content across screens.
 *
 * Replaces the inline `YStack` card declarations that were duplicated across
 * the dashboard, execute, places, and report screens.
 *
 * @param props Card props including the visual `variant` and standard layout props.
 * @returns A themed surface container.
 */
export function Card({ variant = "raised", children, ...rest }: CardProps) {
    const designSystem = useDesignSystem();
    const backgroundColor =
        variant === "muted" ? designSystem.colors.input : designSystem.colors.surface;

    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={backgroundColor}
            p="$4"
            gap="$3"
            {...(variant === "raised" ? { style: { boxShadow: designSystem.shadows.card } } : null)}
            {...rest}
        >
            {children}
        </YStack>
    );
}

/**
 * Card preset for full-width content sections with a heading and body.
 *
 * @param props Standard {@link CardProps}.
 * @returns A raised section surface.
 */
export function SectionCard(props: CardProps) {
    return <Card {...props} />;
}
```

### components/ui/EmptyState.tsx

```tsx
import type { ReactNode } from "react";
import { YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { Card } from "./Card";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface EmptyStateProps {
    readonly title: string;
    readonly description?: string;
    /** Optional decorative icon rendered above the title. */
    readonly icon?: ReactNode;
    /** Optional call-to-action element (e.g. an {@link AppButton}). */
    readonly action?: ReactNode;
}

/**
 * Consistent empty-state card for lists and detail screens with no content.
 *
 * Replaces the ad-hoc "select a place" / "no reports yet" inline blocks.
 *
 * @param props Empty-state props including `title`, `description`, `icon`, and `action`.
 * @returns A centered empty-state surface.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    const designSystem = useDesignSystem();
    return (
        <Card gap="$3" items="center" accessibilityRole="summary">
            {icon === undefined ? null : (
                <YStack
                    width={48}
                    height={48}
                    items="center"
                    justify="center"
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surfaceMuted}
                >
                    {icon}
                </YStack>
            )}
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                style={{ textAlign: "center" }}
            >
                {title}
            </Text>
            {description === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    style={{ textAlign: "center" }}
                >
                    {description}
                </Paragraph>
            )}
            {action}
        </Card>
    );
}
```

### components/ui/ErrorState.tsx

```tsx
import type { ReactNode } from "react";
import { useDesignSystem } from "lib/design-system";
import { Card } from "./Card";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface ErrorStateProps {
    readonly title: string;
    readonly description?: string;
    /** Optional decorative icon rendered above the title. */
    readonly icon?: ReactNode;
    /** Optional recovery action (e.g. a retry {@link AppButton}). */
    readonly action?: ReactNode;
}

/**
 * Inline error surface for recoverable failures (e.g. failed sync or load).
 *
 * @param props Error-state props including `title`, `description`, and `action`.
 * @returns A danger-tinted error card with an alert status region.
 */
export function ErrorState({ title, description, icon, action }: ErrorStateProps) {
    const designSystem = useDesignSystem();
    return (
        <Card
            variant="flat"
            gap="$3"
            items="center"
            borderColor={designSystem.colors.danger}
            bg={designSystem.colors.dangerSoft}
            accessibilityRole="alert"
            aria-live="assertive"
        >
            {icon}
            <Text
                color={designSystem.colors.danger}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                style={{ textAlign: "center" }}
            >
                {title}
            </Text>
            {description === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    style={{ textAlign: "center" }}
                >
                    {description}
                </Paragraph>
            )}
            {action}
        </Card>
    );
}
```

### components/ui/Field.tsx

```tsx
import type { ReactNode } from "react";
import { Input, XStack, YStack, type InputProps } from "tamagui";
import { useDesignSystem } from "lib/design-system";
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
                    style={{
                        color: hasError
                            ? designSystem.colors.danger
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
    return (
        <XStack
            items="center"
            gap="$3"
            px="$4"
            height={56}
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
```

### components/ui/ListRow.tsx

```tsx
import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface ListRowProps {
    readonly title: string;
    /** Optional secondary line rendered below the title. */
    readonly subtitle?: string;
    /** Optional leading element (e.g. an icon avatar). */
    readonly leading?: ReactNode;
    /** Optional trailing element (e.g. a badge or chevron). */
    readonly trailing?: ReactNode;
    /** Press handler; when provided the row becomes an accessible button. */
    readonly onPress?: () => void;
}

/**
 * Tappable list row with leading/trailing slots, tuned for dense field lists.
 *
 * Replaces the inline place/report row layouts repeated across the places and
 * reports screens.
 *
 * @param props Row props including `title`, `subtitle`, slots, and `onPress`.
 * @returns A list row surface.
 */
export function ListRow({ title, subtitle, leading, trailing, onPress }: ListRowProps) {
    const designSystem = useDesignSystem();
    const isInteractive = onPress !== undefined;

    return (
        <XStack
            items="center"
            gap="$3"
            px="$4"
            py="$3.5"
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            onPress={onPress}
            {...(isInteractive
                ? {
                      pressStyle: { opacity: 0.92, scale: 0.99 },
                      accessibilityRole: "button" as const,
                      accessibilityLabel: title,
                  }
                : null)}
        >
            {leading}
            <YStack flex={1} gap="$1">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={15}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {subtitle === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                        fontSize={13}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Paragraph>
                )}
            </YStack>
            {trailing}
        </XStack>
    );
}
```

### components/ui/LoadingState.tsx

```tsx
import { Spinner, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { ScaledParagraph as Paragraph } from "./ScaledText";

export interface LoadingStateProps {
    /** Optional caption rendered beneath the spinner. */
    readonly label?: string;
    /** Fill the available space and center vertically. Defaults to `true`. */
    readonly fullScreen?: boolean;
}

/**
 * Centered loading indicator used while async screen data resolves.
 *
 * @param props Loading-state props including an optional `label`.
 * @returns A centered spinner with an accessible status region.
 */
export function LoadingState({ label, fullScreen = true }: LoadingStateProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            {...(fullScreen ? { flex: 1 } : { py: "$6" })}
            items="center"
            justify="center"
            gap="$3"
            bg={designSystem.colors.background}
            accessibilityRole="progressbar"
            accessibilityLabel={label ?? "Loading"}
            aria-busy
        >
            <Spinner size="large" color={designSystem.colors.primary} />
            {label === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {label}
                </Paragraph>
            )}
        </YStack>
    );
}
```

### components/ui/MetricCard.tsx

```tsx
import { YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import type { DesignTone } from "lib/design-system";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface MetricCardProps {
    readonly label: string;
    readonly value: string;
    /** Optional supporting caption rendered below the value. */
    readonly caption?: string;
    /** Optional tone used to accent the value text. */
    readonly tone?: DesignTone;
}

/**
 * Compact metric tile for dashboard grids and report summaries.
 *
 * Consolidates the inline `MetricCard`/`InfoCard`/`SummaryTile` declarations
 * previously duplicated across the dashboard, execute, and report screens.
 *
 * @param props Metric props including `label`, `value`, `caption`, and `tone`.
 * @returns A metric tile surface.
 */
export function MetricCard({ label, value, caption, tone }: MetricCardProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$1.5"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.2}
            >
                {label}
            </Paragraph>
            <Text
                style={{ color: tone?.text ?? designSystem.colors.foreground }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={24}
                lineHeight={28}
            >
                {value}
            </Text>
            {caption === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    fontSize={12}
                >
                    {caption}
                </Paragraph>
            )}
        </YStack>
    );
}
```

### components/ui/ProgressBar.tsx

```tsx
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";

export interface ProgressBarProps {
    /** Completed fraction in the inclusive range [0, 1]. */
    readonly value: number;
    /** Optional accent color for the filled track. Defaults to the primary token. */
    readonly color?: string;
    /** Accessible label describing what the progress represents. */
    readonly accessibilityLabel?: string;
}

/**
 * Clamp a fraction into the inclusive [0, 1] range.
 *
 * @param value Raw fraction that may fall outside the valid range.
 * @returns A safe fraction between 0 and 1.
 */
function clampFraction(value: number): number {
    if (Number.isNaN(value) || value < 0) {
        return 0;
    }

    return value > 1 ? 1 : value;
}

/**
 * Slim progress track used for wizard completion and score previews.
 *
 * @param props Progress props including `value` (0-1) and an optional `color`.
 * @returns A progress track with an accessible status role.
 */
export function ProgressBar({ value, color, accessibilityLabel }: ProgressBarProps) {
    const designSystem = useDesignSystem();
    const fraction = clampFraction(value);
    const percent = Math.round(fraction * 100);

    return (
        <YStack
            height={8}
            rounded={designSystem.radii.full}
            bg={designSystem.colors.mutedSurface}
            overflow="hidden"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            {...(accessibilityLabel === undefined ? null : { accessibilityLabel })}
        >
            <XStack
                width={`${percent}%`}
                height="100%"
                rounded={designSystem.radii.full}
                style={{ backgroundColor: color ?? designSystem.colors.primary }}
            />
        </YStack>
    );
}
```

### components/ui/ScaledText.tsx

```tsx
import { Paragraph, Text, type ParagraphProps, type TextProps } from "tamagui";
import { usePreferencesStore } from "stores/preferences-store";

/**
 * Multiply an explicit numeric size by the active text scale.
 *
 * Token sizes and undefined values pass through untouched so Tamagui keeps
 * deriving them as usual.
 *
 * @param value Original size prop.
 * @param scale Active font scale multiplier.
 * @returns Scaled size, or the original value when not a number.
 */
function scaleSize<T>(value: T, scale: number): T | number {
    return typeof value === "number" ? Math.round(value * scale) : value;
}

/**
 * Heading/inline text that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Text` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference.
 */
export function ScaledText({ fontSize, lineHeight, ...rest }: TextProps) {
    const fontScale = usePreferencesStore((state) => state.fontScale);
    return (
        <Text
            fontSize={scaleSize(fontSize, fontScale)}
            lineHeight={scaleSize(lineHeight, fontScale)}
            {...rest}
        />
    );
}

/**
 * Body copy that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Paragraph` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference.
 */
export function ScaledParagraph({ fontSize, lineHeight, ...rest }: ParagraphProps) {
    const fontScale = usePreferencesStore((state) => state.fontScale);
    return (
        <Paragraph
            fontSize={scaleSize(fontSize, fontScale)}
            lineHeight={scaleSize(lineHeight, fontScale)}
            {...rest}
        />
    );
}
```

### components/ui/ScreenHeader.tsx

```tsx
import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface ScreenHeaderProps {
    readonly title: string;
    /** Optional uppercase eyebrow rendered above the title. */
    readonly eyebrow?: string;
    /** Optional supporting copy rendered below the title. */
    readonly subtitle?: string;
    /** Optional trailing element (e.g. a status badge or icon button). */
    readonly trailing?: ReactNode;
}

/**
 * Standard screen title block with an optional eyebrow, subtitle, and trailing slot.
 *
 * @param props Header props including `title`, `eyebrow`, `subtitle`, and `trailing`.
 * @returns A screen header layout.
 */
export function ScreenHeader({ title, eyebrow, subtitle, trailing }: ScreenHeaderProps) {
    const designSystem = useDesignSystem();
    return (
        <XStack justify="space-between" items="flex-start" gap="$3">
            <YStack flex={1} gap="$1.5">
                {eyebrow === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.monoBold}
                        fontSize={12}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {eyebrow}
                    </Paragraph>
                )}
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={28}
                    lineHeight={32}
                    accessibilityRole="header"
                >
                    {title}
                </Text>
                {subtitle === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {subtitle}
                    </Paragraph>
                )}
            </YStack>
            {trailing}
        </XStack>
    );
}
```

### components/ui/StatusBanner.tsx

```tsx
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { CloudOff, RefreshCcw } from "components/icons";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface StatusBannerProps {
    /** Whether the device currently has a usable connection. */
    readonly isOnline: boolean;
    /** Number of items waiting in the offline sync queue. */
    readonly pendingCount?: number;
}

/**
 * Online/offline connectivity banner with a pending-sync summary.
 *
 * Surfaces the offline-first state consistently instead of re-deriving copy on
 * each screen. Uses an `aria-live` region so screen readers announce changes.
 *
 * @param props Banner props including `isOnline` and `pendingCount`.
 * @returns A connectivity status banner.
 */
export function StatusBanner({ isOnline, pendingCount = 0 }: StatusBannerProps) {
    const designSystem = useDesignSystem();
    const hasPending = pendingCount > 0;
    const accent = isOnline ? designSystem.colors.success : designSystem.colors.warning;
    const surface = isOnline ? designSystem.colors.successSoft : designSystem.colors.warningSoft;
    const title = isOnline ? "Online" : "Offline";
    const description = isOnline
        ? hasPending
            ? `Syncing ${pendingCount} pending ${pendingCount === 1 ? "change" : "changes"}…`
            : "All changes are synced."
        : hasPending
          ? `${pendingCount} pending ${pendingCount === 1 ? "change" : "changes"} saved locally — they sync when you reconnect.`
          : "Drafts are saved locally and stay safe until you reconnect.";

    return (
        <XStack
            items="center"
            gap="$3"
            px="$3.5"
            py="$3"
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            style={{ backgroundColor: surface }}
            accessibilityRole="summary"
            aria-live="polite"
        >
            {isOnline ? (
                <RefreshCcw size={16} color={accent} />
            ) : (
                <CloudOff size={16} color={accent} />
            )}
            <YStack flex={1} gap="$1">
                <Text
                    style={{ color: accent }}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={13}
                    textTransform="uppercase"
                    letterSpacing={1.1}
                >
                    {title}
                </Text>
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    fontSize={13}
                    lineHeight={18}
                >
                    {description}
                </Paragraph>
            </YStack>
        </XStack>
    );
}
```

### components/navigation/YeeStackHeaderTitle.tsx

```tsx
import { ScrollView } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";

export interface YeeStackHeaderTitleProps {
    readonly primary: string;
    readonly secondary?: string | undefined;
    readonly size?: "md" | "lg";
}

const TABLET_LIMIT = 120;
const MOBILE_PRIMARY_LIMIT = 34;
const MOBILE_SECONDARY_LIMIT = 52;

function truncateHeaderText(text: string, limit: number): string {
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, Math.max(limit - 3, 0))}...`;
}

export function YeeStackHeaderTitle({ primary, secondary, size = "md" }: YeeStackHeaderTitleProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const primarySize = Math.round((size === "lg" ? 17 : 15) * designSystem.fontScale);
    const secondarySize = Math.round(12 * designSystem.fontScale);
    const primaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_PRIMARY_LIMIT;
    const secondaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_SECONDARY_LIMIT;
    const displayPrimary = truncateHeaderText(primary, primaryLimit);
    const displaySecondary =
        secondary === undefined ? undefined : truncateHeaderText(secondary, secondaryLimit);

    return (
        <YStack justify="center" style={{ maxWidth: "100%" }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center" }}
            >
                {layout.isTablet && displaySecondary !== undefined ? (
                    <XStack items="center" gap="$2">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            |
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displaySecondary}
                        </Text>
                    </XStack>
                ) : (
                    <YStack justify="center">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        {displaySecondary === undefined ? null : (
                            <Text
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={secondarySize}
                                lineHeight={secondarySize + 4}
                            >
                                {displaySecondary}
                            </Text>
                        )}
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
```

### components/navigation/useYeeStackHeaderOptions.ts

```tsx
import { useMemo } from "react";
import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useDesignSystem } from "lib/design-system";

export function useYeeStackHeaderOptions() {
    const designSystem = useDesignSystem();

    return useMemo<NativeStackNavigationOptions>(() => {
        const headerTitleAlign: NativeStackNavigationOptions["headerTitleAlign"] =
            Platform.OS === "ios" ? "center" : "left";

        return {
            headerShown: true,
            headerBackButtonDisplayMode: "generic",
            headerBackButtonMenuEnabled: true,
            headerBackVisible: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: designSystem.colors.surfaceMuted },
            headerTintColor: designSystem.colors.primary,
            headerTitleAlign,
            headerTitleStyle: {
                color: designSystem.colors.foreground,
                fontFamily: designSystem.fonts.bodyBold,
            },
        };
    }, [designSystem]);
}
```
