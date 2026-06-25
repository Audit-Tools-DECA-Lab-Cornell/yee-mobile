import { Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { CloudOff, RefreshCcw } from "components/icons";

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
    const hasPending = pendingCount > 0;
    const accent = isOnline ? designSystem.colors.success : designSystem.colors.warning;
    const surface = isOnline ? designSystem.colors.successSoft : designSystem.colors.warningSoft;
    const title = isOnline ? "Online" : "Offline";
    const description = isOnline
        ? hasPending
            ? `Syncing ${pendingCount} pending ${pendingCount === 1 ? "change" : "changes"}…`
            : "All changes are synced with the YEE backend."
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
