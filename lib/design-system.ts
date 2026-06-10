import type { MetricTone, PlaceStatus, PreAuditStatus } from "./yee-demo-data";

/**
 * Shared colors and typography extracted from the generated design concepts.
 */
export const designSystem = {
    colors: {
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
        card: "0 12px 34px rgba(46, 56, 52, 0.08)",
        accent: "0 10px 24px rgba(86, 108, 98, 0.12)",
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
