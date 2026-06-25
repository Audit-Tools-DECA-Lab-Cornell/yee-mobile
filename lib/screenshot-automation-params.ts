export const DEFAULT_SCREENSHOT_SCROLL_DELAY_MS = 350;

export type ScreenshotAutomationParamValue = string | readonly string[] | undefined;

interface ResolveScreenshotScrollAutomationParamsInput {
    readonly rawScrollDelayMs: ScreenshotAutomationParamValue;
    readonly rawScrollY: ScreenshotAutomationParamValue;
}

interface ResolvedScreenshotScrollAutomationParams {
    readonly scrollDelayMs: number;
    readonly scrollOffset: number | null;
}

/**
 * Resolve scroll automation query params into numbers the hook can consume.
 *
 * @param input Raw Expo Router query params from a screen route.
 * @returns Parsed scroll offset and delay.
 */
export function resolveScreenshotScrollAutomationParams(
    input: Readonly<ResolveScreenshotScrollAutomationParamsInput>,
): ResolvedScreenshotScrollAutomationParams {
    const scrollOffset = parseNonNegativeInteger(input.rawScrollY);
    const parsedDelay = parseNonNegativeInteger(input.rawScrollDelayMs);

    return {
        scrollDelayMs: parsedDelay ?? DEFAULT_SCREENSHOT_SCROLL_DELAY_MS,
        scrollOffset,
    };
}

/**
 * Reads a single route parameter value when the router provides either a
 * string or string array.
 *
 * @param value Raw route parameter value.
 * @returns First string value or null when not present.
 */
function readSingleParam(value: ScreenshotAutomationParamValue): string | null {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }
    return null;
}

/**
 * Parses a non-negative integer route parameter.
 *
 * @param value Raw route parameter value.
 * @returns Parsed integer or null when the value is missing or invalid.
 */
function parseNonNegativeInteger(value: ScreenshotAutomationParamValue): number | null {
    const rawValue = readSingleParam(value)?.trim();
    if (rawValue === undefined || rawValue.length === 0) {
        return null;
    }
    if (!/^\d+$/.test(rawValue)) {
        return null;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
        return null;
    }

    return parsedValue;
}
