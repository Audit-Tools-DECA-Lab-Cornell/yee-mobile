import { memo } from "react";
import { Spinner, Text, XStack } from "tamagui";
import { Check, CloudOff, TriangleAlert } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { useAuditSessionStore, type AuditSaveStatus } from "stores/yee-audit-session-store";

type PillStyle = {
    readonly label: string;
    readonly surface: string;
    readonly border: string;
    readonly text: string;
    readonly icon: "spinner" | "check" | "cloud" | "alert" | null;
};

function resolvePill(
    status: AuditSaveStatus,
    colors: ReturnType<typeof useDesignSystem>["colors"],
): PillStyle | null {
    switch (status) {
        case "saving":
            return {
                label: "Saving…",
                surface: colors.surfaceMuted,
                border: colors.border,
                text: colors.mutedForeground,
                icon: "spinner",
            };
        case "saved":
            return {
                label: "Saved",
                surface: colors.successSoft,
                border: colors.border,
                text: colors.successText,
                icon: "check",
            };
        case "queued":
            return {
                label: "Queued offline",
                surface: colors.warningSoft,
                border: colors.warning,
                text: colors.warningText,
                icon: "cloud",
            };
        case "error":
            return {
                label: "Save error",
                surface: colors.dangerSoft,
                border: colors.danger,
                text: colors.dangerText,
                icon: "alert",
            };
        default:
            return null;
    }
}

/**
 * Live autosave feedback so the auditor trusts that work is being kept (Norman:
 * feedback; Nielsen: visibility of system status). Subscribes to only the save
 * status, so it updates independently of the survey content.
 */
export const SaveStatusPill = memo(function SaveStatusPill() {
    const designSystem = useDesignSystem();
    const status = useAuditSessionStore((state) => state.saveStatus);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const pill = resolvePill(status, designSystem.colors);

    // Nothing is being saved in a view-only session.
    if (readOnly || pill === null) {
        return null;
    }

    return (
        <XStack
            items="center"
            gap="$1.5"
            rounded={designSystem.radii.full}
            px="$2.5"
            py="$1"
            borderWidth={1}
            style={{ backgroundColor: pill.surface, borderColor: pill.border }}
        >
            {pill.icon === "spinner" ? (
                <Spinner size="small" color={pill.text} />
            ) : pill.icon === "check" ? (
                <Check size={13} color={pill.text} />
            ) : pill.icon === "cloud" ? (
                <CloudOff size={13} color={pill.text} />
            ) : pill.icon === "alert" ? (
                <TriangleAlert size={13} color={pill.text} />
            ) : null}
            <Text
                style={{ color: pill.text }}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
            >
                {pill.label}
            </Text>
        </XStack>
    );
});
