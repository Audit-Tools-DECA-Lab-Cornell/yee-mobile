import { memo } from "react";
import { Button, Spinner, XStack, YStack } from "tamagui";
import { ArrowLeft, ArrowRight, Save } from "components/icons";
import { useDesignSystem } from "lib/design-system";

/**
 * Sticky footer navigation. Back / Save & exit / Next (or Review on the final
 * step), with an optional Submit shortcut when the audit is complete. Purely
 * presentational — the shell owns all navigation and persistence.
 */
export const AuditFooterNav = memo(function AuditFooterNav({
    busy,
    bottomInset,
    contentWidth,
    onMeasure,
    onBack,
    onSaveExit,
    onNext,
    nextLabel,
    extraActionLabel,
    onExtraAction,
}: {
    busy: boolean;
    bottomInset: number;
    contentWidth: number;
    onMeasure: (height: number) => void;
    onBack: () => void;
    onSaveExit: () => void;
    onNext: () => void;
    nextLabel: string;
    extraActionLabel?: string;
    onExtraAction?: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            position="absolute"
            onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
            style={{
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: designSystem.colors.background,
                borderTopWidth: 1,
                borderTopColor: designSystem.colors.border,
                paddingTop: 12,
                paddingBottom: bottomInset + 12,
                paddingHorizontal: 16,
            }}
        >
            <XStack
                gap="$2.5"
                flexWrap="wrap"
                style={{ alignSelf: "center", width: "100%", maxWidth: contentWidth }}
            >
                <Button
                    flex={1}
                    rounded={designSystem.radii.button}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onBack}
                    icon={<ArrowLeft size={16} color={designSystem.colors.foreground} />}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.button}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onSaveExit}
                    icon={<Save size={16} color={designSystem.colors.foreground} />}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Save & exit
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.button}
                    borderWidth={1}
                    hoverStyle={{ opacity: 0.96 }}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onNext}
                    disabled={busy}
                    style={{
                        backgroundColor: designSystem.colors.primary,
                        borderColor: designSystem.colors.primary,
                    }}
                >
                    <XStack items="center" gap="$2">
                        {busy ? (
                            <Spinner color={designSystem.colors.primaryForeground} size="small" />
                        ) : (
                            <ArrowRight size={16} color={designSystem.colors.primaryForeground} />
                        )}
                        <Button.Text
                            style={{ color: designSystem.colors.primaryForeground }}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            {nextLabel}
                        </Button.Text>
                    </XStack>
                </Button>
                {extraActionLabel && onExtraAction ? (
                    <Button
                        flexBasis="100%"
                        rounded={designSystem.radii.button}
                        borderWidth={1}
                        hoverStyle={{ opacity: 0.96 }}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                        onPress={onExtraAction}
                        style={{
                            backgroundColor: designSystem.colors.primarySoft,
                            borderColor: designSystem.colors.border,
                        }}
                    >
                        <Button.Text
                            style={{ color: designSystem.colors.primaryText }}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            {extraActionLabel}
                        </Button.Text>
                    </Button>
                ) : null}
            </XStack>
        </YStack>
    );
});
