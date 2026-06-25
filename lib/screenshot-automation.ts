import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";

import { resolveScreenshotScrollAutomationParams } from "lib/screenshot-automation-params";

interface UseScreenshotScrollAutomationConfig {
    readonly contentReady: boolean;
    readonly rerunKey?: number | string;
    readonly scrollToOffset: (offset: number) => void;
}

/**
 * Applies screenshot-only scroll automation from route params injected by the
 * simulator capture script.
 *
 * @param config Readiness and scroll callback for the active screen.
 */
export function useScreenshotScrollAutomation({
    contentReady,
    rerunKey,
    scrollToOffset,
}: Readonly<UseScreenshotScrollAutomationConfig>): void {
    const params = useLocalSearchParams();
    const rawScrollDelayMs = params["__screenshotScrollDelayMs"];
    const rawScrollY = params["__screenshotScrollY"];

    const { scrollDelayMs, scrollOffset } = useMemo(() => {
        return resolveScreenshotScrollAutomationParams({
            rawScrollDelayMs,
            rawScrollY,
        });
    }, [rawScrollDelayMs, rawScrollY]);

    useEffect(() => {
        if (!contentReady || scrollOffset === null) {
            return;
        }

        const retryDelaysMs = [0, 100, 300, 700, 1200, 1900, 2800, 4200];
        const animationFrameIds: number[] = [];
        const timeoutIds = retryDelaysMs.map((extraDelayMs) =>
            setTimeout(() => {
                const animationFrameId = requestAnimationFrame(() => {
                    scrollToOffset(scrollOffset);
                });
                animationFrameIds.push(animationFrameId);
            }, scrollDelayMs + extraDelayMs),
        );

        return () => {
            for (const timeoutId of timeoutIds) {
                clearTimeout(timeoutId);
            }
            for (const animationFrameId of animationFrameIds) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [contentReady, rerunKey, scrollDelayMs, scrollOffset, scrollToOffset]);
}
