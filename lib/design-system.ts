import type { MetricTone, PlaceStatus, PreAuditStatus } from "./yee-demo-data";

/**
 * Shared colors and typography extracted from the generated design concepts.
 */
export const designSystem = {
    colors: {
        background: "#1C1917",
        foreground: "#E7DED3",
        primary: "#C58A5C",
        primaryForeground: "#FFFFFF",
        surface: "#24201D",
        surfaceMuted: "#2B2622",
        mutedSurface: "#312B27",
        input: "#211D1A",
        border: "#3A3430",
        mutedForeground: "#AFA497",
        secondaryForeground: "#D2C7BB",
        success: "#6F9A7F",
        warning: "#B99A5A",
        danger: "#C98472",
        info: "#7B90B8",
        violet: "#9B86B2",
        overlay: "rgba(28, 25, 23, 0.9)",
        primarySoft: "rgba(197, 138, 92, 0.1)",
        successSoft: "rgba(111, 154, 127, 0.12)",
        warningSoft: "rgba(185, 154, 90, 0.12)",
        dangerSoft: "rgba(201, 132, 114, 0.12)",
        infoSoft: "rgba(123, 144, 184, 0.12)",
        violetSoft: "rgba(155, 134, 178, 0.12)",
    },
    fonts: {
        bodyRegular: "$body",
        bodyMedium: "$bodyMedium",
        bodySemiBold: "$bodySemiBold",
        bodyBold: "$bodyBold",
        headingMedium: "$headingMedium",
        headingBold: "$headingBold",
        monoMedium: "$monoMedium",
        monoBold: "$monoBold",
    },
    fontWeights: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
    },
    radii: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        full: 999,
    },
    spacing: {
        screenPaddingHorizontal: 15,
        screenPaddingVertical: 16,
    },
    shadows: {
        card: "0 10px 24px rgba(0, 0, 0, 0.14)",
        accent: "0 0 14px rgba(197, 138, 92, 0.12)",
    },
} as const;

type DesignColor = (typeof designSystem.colors)[keyof typeof designSystem.colors];

/**
 * Shared tone model for chips, badges, and accent surfaces.
 */
export interface DesignTone {
    readonly accent: DesignColor;
    readonly surface: DesignColor;
    readonly text: DesignColor;
}

/**
 * Resolve metric colors into the extracted design palette.
 *
 * @param tone Dashboard metric tone.
 * @returns Accent, surface, and text colors for the metric.
 */
export function getMetricTone(tone: MetricTone): DesignTone {
    if (tone === "green") {
        return {
            accent: designSystem.colors.success,
            surface: designSystem.colors.successSoft,
            text: designSystem.colors.success,
        };
    }

    if (tone === "purple") {
        return {
            accent: designSystem.colors.violet,
            surface: designSystem.colors.violetSoft,
            text: designSystem.colors.violet,
        };
    }

    if (tone === "orange") {
        return {
            accent: designSystem.colors.warning,
            surface: designSystem.colors.warningSoft,
            text: designSystem.colors.warning,
        };
    }

    return {
        accent: designSystem.colors.primary,
        surface: designSystem.colors.primarySoft,
        text: designSystem.colors.primary,
    };
}

/**
 * Resolve place status colors into a consistent badge treatment.
 *
 * @param status Place workflow status.
 * @returns Accent, surface, and text colors for the status.
 */
export function getPlaceStatusTone(status: PlaceStatus): DesignTone {
    if (status === "submitted") {
        return {
            accent: designSystem.colors.success,
            surface: designSystem.colors.successSoft,
            text: designSystem.colors.success,
        };
    }

    if (status === "ready_for_review") {
        return {
            accent: designSystem.colors.violet,
            surface: designSystem.colors.violetSoft,
            text: designSystem.colors.violet,
        };
    }

    if (status === "in_progress") {
        return {
            accent: designSystem.colors.primary,
            surface: designSystem.colors.primarySoft,
            text: designSystem.colors.primary,
        };
    }

    return {
        accent: designSystem.colors.warning,
        surface: designSystem.colors.warningSoft,
        text: designSystem.colors.warning,
    };
}

/**
 * Resolve pre-audit readiness colors into the extracted design palette.
 *
 * @param status Pre-audit setup status.
 * @returns Accent, surface, and text colors for the status.
 */
export function getPreAuditTone(status: PreAuditStatus): DesignTone {
    if (status === "completed") {
        return {
            accent: designSystem.colors.success,
            surface: designSystem.colors.successSoft,
            text: designSystem.colors.success,
        };
    }

    if (status === "in_progress") {
        return {
            accent: designSystem.colors.primary,
            surface: designSystem.colors.primarySoft,
            text: designSystem.colors.primary,
        };
    }

    return {
        accent: designSystem.colors.warning,
        surface: designSystem.colors.warningSoft,
        text: designSystem.colors.warning,
    };
}
