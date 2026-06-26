import { Appearance } from "react-native";
import { create } from "zustand";
import {
    clampFontScale,
    readPersistedPreferences,
    savePersistedPreferences,
    type ThemeMode,
} from "lib/preferences/storage";

export type { ThemeMode } from "lib/preferences/storage";

/** Concrete display theme after resolving the system preference. */
export type ResolvedTheme = "light" | "dark";

interface PreferencesStoreState {
    /** Auditor-selected theme preference. */
    readonly themeMode: ThemeMode;
    /** Concrete light/dark theme the UI should render. */
    readonly resolvedTheme: ResolvedTheme;
    /** Text scale multiplier applied to scalable typography. */
    readonly fontScale: number;
    /** Whether the dyslexia-friendly typeface is active. */
    readonly dyslexicFont: boolean;
    /** True once persisted preferences have been loaded. */
    readonly isHydrated: boolean;

    /** Load saved preferences from device storage. */
    hydrate: () => void;
    /** Re-resolve the theme after a system appearance change. */
    syncSystemTheme: () => void;
    setThemeMode: (mode: ThemeMode) => void;
    setFontScale: (scale: number) => void;
    setDyslexicFont: (enabled: boolean) => void;
}

/**
 * Resolve the concrete display theme from a selected mode.
 *
 * @param mode Selected theme preference.
 * @returns Light or dark theme to render.
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
    if (mode === "light" || mode === "dark") {
        return mode;
    }

    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

/**
 * Display preferences store for theme, text size, and dyslexia-friendly font.
 *
 * Hydrated once at startup from synchronous device storage so the first paint
 * already reflects the auditor's saved theme.
 */
export const usePreferencesStore = create<PreferencesStoreState>((set, get) => ({
    themeMode: "system",
    resolvedTheme: resolveTheme("system"),
    fontScale: 1,
    dyslexicFont: false,
    isHydrated: false,

    hydrate: () => {
        if (get().isHydrated) {
            return;
        }

        const persisted = readPersistedPreferences();
        set(() => ({
            themeMode: persisted.theme_mode,
            resolvedTheme: resolveTheme(persisted.theme_mode),
            fontScale: clampFontScale(persisted.font_scale),
            dyslexicFont: persisted.dyslexic_font,
            isHydrated: true,
        }));
    },

    syncSystemTheme: () => {
        const { themeMode } = get();
        if (themeMode !== "system") {
            return;
        }

        set(() => ({ resolvedTheme: resolveTheme("system") }));
    },

    setThemeMode: (mode: ThemeMode) => {
        set(() => ({ themeMode: mode, resolvedTheme: resolveTheme(mode) }));
        const { fontScale, dyslexicFont } = get();
        savePersistedPreferences({
            theme_mode: mode,
            font_scale: fontScale,
            dyslexic_font: dyslexicFont,
        });
    },

    setFontScale: (scale: number) => {
        const clamped = clampFontScale(scale);
        set(() => ({ fontScale: clamped }));
        const { themeMode, dyslexicFont } = get();
        savePersistedPreferences({
            theme_mode: themeMode,
            font_scale: clamped,
            dyslexic_font: dyslexicFont,
        });
    },

    setDyslexicFont: (enabled: boolean) => {
        set(() => ({ dyslexicFont: enabled }));
        const { themeMode, fontScale } = get();
        savePersistedPreferences({
            theme_mode: themeMode,
            font_scale: fontScale,
            dyslexic_font: enabled,
        });
    },
}));
