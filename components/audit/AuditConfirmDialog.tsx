import { useCallback, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";

export interface ConfirmOptions {
    readonly title: string;
    readonly message: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
}

/**
 * In-app confirm dialog rendered as an absolute overlay INSIDE the current
 * screen's window — deliberately not a React Native `Alert`/`Modal`. On Android
 * those spawn a separate native dialog window that does not inherit the
 * activity's sticky-immersive flag, so opening one reveals the system
 * navigation bar and pushes the footer (Back / Save & exit / Next) upward. An
 * in-window overlay keeps the hidden nav bar hidden, so nothing shifts.
 */
export function AuditConfirmDialog({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
}: ConfirmOptions & {
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const designSystem = useDesignSystem();
    const insets = useSafeAreaInsets();
    return (
        <YStack
            items="center"
            justify="center"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100_000,
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
                paddingLeft: 24,
                paddingRight: 24,
                backgroundColor: "rgba(7, 9, 11, 0.55)",
            }}
        >
            <YStack
                width="100%"
                gap="$4"
                p="$5"
                rounded={designSystem.radii.lg}
                bg={designSystem.colors.background}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                style={{ maxWidth: 420, boxShadow: designSystem.shadows.elevated }}
            >
                <YStack gap="$2">
                    <Text
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={18}
                        style={{ color: designSystem.colors.foreground }}
                    >
                        {title}
                    </Text>
                    <Paragraph
                        fontFamily={designSystem.fonts.bodyMedium}
                        style={{ color: designSystem.colors.mutedForeground }}
                    >
                        {message}
                    </Paragraph>
                </YStack>
                <XStack gap="$2.5" justify="flex-end" flexWrap="wrap">
                    <Button
                        rounded={designSystem.radii.button}
                        bg={designSystem.colors.surfaceMuted}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                        pressStyle={{ opacity: 0.9 }}
                        onPress={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        rounded={designSystem.radii.button}
                        bg={designSystem.colors.primary}
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        pressStyle={{ opacity: 0.9 }}
                        onPress={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </XStack>
            </YStack>
        </YStack>
    );
}

/**
 * Imperative confirm as an in-window overlay. `requestConfirm` returns a promise
 * that resolves when the user picks an option; render `confirmDialog` somewhere
 * in the screen tree (it is `null` when nothing is pending). Web falls back to
 * the native `window.confirm`.
 */
export function useAuditConfirm(): {
    requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
    confirmDialog: ReactNode;
} {
    const [pending, setPending] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const requestConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
            return Promise.resolve(globalThis.confirm(`${options.title}\n\n${options.message}`));
        }
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setPending(options);
        });
    }, []);

    const settle = useCallback((value: boolean) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setPending(null);
        resolve?.(value);
    }, []);

    const confirmDialog =
        pending === null ? null : (
            <AuditConfirmDialog
                {...pending}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        );

    return { requestConfirm, confirmDialog };
}
