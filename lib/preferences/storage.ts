import { createMMKV } from "react-native-mmkv";

/**
 * Device-local persistence for auditor display preferences (theme, text size,
 * dyslexia-friendly font).
 *
 * Preferences are device-scoped rather than account-scoped: a shared field
 * device keeps the same readability settings regardless of which auditor signs
 * in. Backed by a single MMKV instance for synchronous reads, which lets the
 * app resolve the correct theme on first paint without a flash. Reads and writes
 * are wrapped so a storage failure degrades to in-memory defaults instead of
 * crashing startup.
 */

/** User-selected theme preference. */
export type ThemeMode = "system" | "light" | "dark";

/** Serialized preferences payload persisted on device. */
export interface PersistedPreferences {
    readonly theme_mode: ThemeMode;
    readonly font_scale: number;
    readonly dyslexic_font: boolean;
}

/** Smallest text scale the auditor can select. */
export const MIN_FONT_SCALE = 0.9;

/** Largest text scale the auditor can select. */
export const MAX_FONT_SCALE = 1.3;

/** Defaults applied before any preference has been saved. */
export const DEFAULT_PREFERENCES: PersistedPreferences = {
    theme_mode: "system",
    font_scale: 1,
    dyslexic_font: false,
};

const PREFERENCES_KEY = "yee.preferences.v1";

let storage: ReturnType<typeof createMMKV> | null = null;
let memoryCache: PersistedPreferences | null = null;

/**
 * Lazily open the shared preferences MMKV instance.
 *
 * @returns The MMKV instance, or null when native storage is unavailable.
 */
function getStorage(): ReturnType<typeof createMMKV> | null {
    if (storage !== null) {
        return storage;
    }

    try {
        storage = createMMKV({ id: "yee.preferences" });
        return storage;
    } catch {
        return null;
    }
}

/**
 * Clamp a raw text scale into the supported range and round to two decimals.
 *
 * @param scale Raw scale value.
 * @returns Safe scale within [{@link MIN_FONT_SCALE}, {@link MAX_FONT_SCALE}].
 */
export function clampFontScale(scale: number): number {
    if (!Number.isFinite(scale)) {
        return 1;
    }

    const bounded = Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, scale));
    return Math.round(bounded * 100) / 100;
}

/**
 * Coerce an unknown parsed payload into a valid preferences object.
 *
 * @param value Parsed JSON value of unknown shape.
 * @returns Normalized preferences with defaults filled in.
 */
function normalizePreferences(value: unknown): PersistedPreferences {
    if (typeof value !== "object" || value === null) {
        return DEFAULT_PREFERENCES;
    }

    const record = value as Record<string, unknown>;
    const themeMode =
        record.theme_mode === "light" || record.theme_mode === "dark"
            ? record.theme_mode
            : "system";
    const fontScale =
        typeof record.font_scale === "number"
            ? clampFontScale(record.font_scale)
            : DEFAULT_PREFERENCES.font_scale;
    const dyslexicFont =
        typeof record.dyslexic_font === "boolean"
            ? record.dyslexic_font
            : DEFAULT_PREFERENCES.dyslexic_font;

    return { theme_mode: themeMode, font_scale: fontScale, dyslexic_font: dyslexicFont };
}

/**
 * Read persisted preferences from device storage.
 *
 * @returns Stored preferences, or defaults when none are saved.
 */
export function readPersistedPreferences(): PersistedPreferences {
    if (memoryCache !== null) {
        return memoryCache;
    }

    const instance = getStorage();
    if (instance === null) {
        return DEFAULT_PREFERENCES;
    }

    try {
        const raw = instance.getString(PREFERENCES_KEY);
        if (raw === undefined) {
            return DEFAULT_PREFERENCES;
        }

        memoryCache = normalizePreferences(JSON.parse(raw));
        return memoryCache;
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

/**
 * Persist preferences to device storage.
 *
 * @param preferences Preferences to save.
 */
export function savePersistedPreferences(preferences: PersistedPreferences): void {
    memoryCache = preferences;

    const instance = getStorage();
    if (instance === null) {
        return;
    }

    try {
        instance.set(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
        // In-memory cache already holds the latest value for this session.
    }
}
