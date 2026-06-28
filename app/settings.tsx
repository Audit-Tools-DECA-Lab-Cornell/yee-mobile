import type { ComponentType } from "react";
import { ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, XStack, YStack } from "tamagui";
import { ChevronLeft, LogOut, Monitor, Moon, ShieldCheck, Sun } from "components/icons";
import { ScaledParagraph, ScaledText } from "components/ui";
import { useDesignSystem } from "lib/design-system";
import { useAuthStore } from "stores/auth-store";
import { usePreferencesStore, type ThemeMode } from "stores/preferences-store";

interface ThemeOption {
    readonly mode: ThemeMode;
    readonly label: string;
    readonly Icon: ComponentType<{ size?: number; color?: string }>;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
    { mode: "system", label: "System", Icon: Monitor },
    { mode: "light", label: "Light", Icon: Sun },
    { mode: "dark", label: "Dark", Icon: Moon },
];

interface TextSizeOption {
    readonly label: string;
    readonly scale: number;
    readonly sample: number;
}

const TEXT_SIZE_OPTIONS: readonly TextSizeOption[] = [
    { label: "Small", scale: 0.9, sample: 13 },
    { label: "Default", scale: 1, sample: 15 },
    { label: "Large", scale: 1.15, sample: 18 },
    { label: "Larger", scale: 1.3, sample: 21 },
];

const DEFAULT_TEXT_SIZE: TextSizeOption = { label: "Default", scale: 1, sample: 15 };

/**
 * Auditor settings: appearance, readability, and account.
 */
export default function SettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const designSystem = useDesignSystem();
    const { colors, fonts, radii, spacing } = designSystem;

    const session = useAuthStore((state) => state.session);
    const logout = useAuthStore((state) => state.logout);

    const themeMode = usePreferencesStore((state) => state.themeMode);
    const fontScale = usePreferencesStore((state) => state.fontScale);
    const dyslexicFont = usePreferencesStore((state) => state.dyslexicFont);
    const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
    const setFontScale = usePreferencesStore((state) => state.setFontScale);
    const setDyslexicFont = usePreferencesStore((state) => state.setDyslexicFont);

    const auditorName = session?.user.name ?? "Auditor";
    const auditorEmail = session?.user.email ?? "—";
    const activeTextSize =
        TEXT_SIZE_OPTIONS.find((option) => Math.abs(option.scale - fontScale) < 0.03) ??
        DEFAULT_TEXT_SIZE;

    return (
        <YStack flex={1} style={{ backgroundColor: colors.background }}>
            <XStack
                items="center"
                gap="$3"
                px={spacing.screenPaddingHorizontal}
                style={{
                    paddingTop: insets.top,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.surface,
                }}
            >
                <Button
                    width={40}
                    height={40}
                    p={0}
                    rounded={radii.button}
                    borderWidth={1}
                    borderColor={colors.border}
                    bg={colors.surfaceMuted}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => router.back()}
                    accessibilityLabel="Go back"
                >
                    <ChevronLeft size={18} color={colors.foreground} />
                </Button>
                <ScaledText
                    style={{ color: colors.foreground }}
                    fontFamily={fonts.headingBold}
                    fontSize={22}
                >
                    Settings
                </ScaledText>
            </XStack>

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: spacing.screenPaddingHorizontal,
                    paddingTop: 20,
                    paddingBottom: insets.bottom + 32,
                    gap: 28,
                }}
            >
                <Section title="Appearance" designSystem={designSystem}>
                    <SettingsRow
                        label="Theme"
                        description="Choose how the app looks, or follow your device."
                        designSystem={designSystem}
                    >
                        <XStack gap="$2" mt="$1">
                            {THEME_OPTIONS.map((option) => {
                                const selected = themeMode === option.mode;
                                return (
                                    <Button
                                        key={option.mode}
                                        flex={1}
                                        height={72}
                                        rounded={radii.lg}
                                        borderWidth={1}
                                        bg={selected ? colors.primarySoft : colors.surface}
                                        borderColor={selected ? colors.primary : colors.border}
                                        pressStyle={{ opacity: 0.9 }}
                                        onPress={() => setThemeMode(option.mode)}
                                        accessibilityLabel={`${option.label} theme`}
                                        accessibilityState={{ selected }}
                                    >
                                        <YStack items="center" gap="$1.5">
                                            <option.Icon
                                                size={20}
                                                color={
                                                    selected
                                                        ? colors.primary
                                                        : colors.mutedForeground
                                                }
                                            />
                                            <ScaledText
                                                style={{
                                                    color: selected
                                                        ? colors.primary
                                                        : colors.secondaryForeground,
                                                }}
                                                fontFamily={fonts.bodyBold}
                                                fontSize={12}
                                            >
                                                {option.label}
                                            </ScaledText>
                                        </YStack>
                                    </Button>
                                );
                            })}
                        </XStack>
                    </SettingsRow>
                </Section>

                <Section title="Text & reading" designSystem={designSystem}>
                    <SettingsRow
                        label="Text size"
                        description="Make labels and answers easier to read in the field."
                        designSystem={designSystem}
                    >
                        <XStack gap="$2" mt="$1">
                            {TEXT_SIZE_OPTIONS.map((option) => {
                                const selected = activeTextSize.label === option.label;
                                return (
                                    <Button
                                        key={option.label}
                                        flex={1}
                                        height={64}
                                        rounded={radii.lg}
                                        borderWidth={1}
                                        bg={selected ? colors.primarySoft : colors.surface}
                                        borderColor={selected ? colors.primary : colors.border}
                                        pressStyle={{ opacity: 0.9 }}
                                        onPress={() => setFontScale(option.scale)}
                                        accessibilityLabel={`${option.label} text size`}
                                        accessibilityState={{ selected }}
                                    >
                                        <YStack items="center" gap="$1">
                                            <ScaledText
                                                style={{
                                                    color: selected
                                                        ? colors.primary
                                                        : colors.foreground,
                                                }}
                                                fontFamily={fonts.headingBold}
                                                fontSize={option.sample}
                                            >
                                                A
                                            </ScaledText>
                                            <ScaledText
                                                style={{
                                                    color: selected
                                                        ? colors.primary
                                                        : colors.secondaryForeground,
                                                }}
                                                fontFamily={fonts.bodyMedium}
                                                fontSize={11}
                                            >
                                                {option.label}
                                            </ScaledText>
                                        </YStack>
                                    </Button>
                                );
                            })}
                        </XStack>
                    </SettingsRow>

                    <Divider color={colors.border} />

                    <SettingsRow
                        label="Dyslexia-friendly font"
                        description="Switch to a typeface designed for easier reading."
                        designSystem={designSystem}
                        trailing={
                            <Switch
                                value={dyslexicFont}
                                onValueChange={setDyslexicFont}
                                trackColor={{ false: colors.mutedSurface, true: colors.primary }}
                                thumbColor={colors.surface}
                            />
                        }
                    />
                </Section>

                <Section title="Account" designSystem={designSystem}>
                    <ReadOnlyRow label="Name" value={auditorName} designSystem={designSystem} />
                    <Divider color={colors.border} />
                    <ReadOnlyRow label="Email" value={auditorEmail} designSystem={designSystem} />
                    <Divider color={colors.border} />
                    <XStack items="center" gap="$2.5" py="$2">
                        <ShieldCheck size={15} color={colors.mutedForeground} />
                        <ScaledParagraph
                            flex={1}
                            style={{ color: colors.mutedForeground }}
                            fontFamily={fonts.bodyMedium}
                            fontSize={13}
                        >
                            Your password is managed by your program administrator. Contact them to
                            change it.
                        </ScaledParagraph>
                    </XStack>
                </Section>

                <Button
                    height={52}
                    rounded={radii.button}
                    borderWidth={1}
                    borderColor={colors.danger}
                    bg={colors.dangerSoft}
                    pressStyle={{ opacity: 0.9, scale: 0.99 }}
                    onPress={() => {
                        void logout();
                    }}
                    accessibilityLabel="Sign out"
                >
                    <XStack items="center" gap="$2">
                        <LogOut size={16} color={colors.danger} />
                        <ScaledText
                            style={{ color: colors.danger }}
                            fontFamily={fonts.bodyBold}
                            fontSize={15}
                        >
                            Sign out
                        </ScaledText>
                    </XStack>
                </Button>
            </ScrollView>
        </YStack>
    );
}

type DesignSystem = ReturnType<typeof useDesignSystem>;

/**
 * Titled group of related settings rows.
 */
function Section({
    title,
    designSystem,
    children,
}: {
    title: string;
    designSystem: DesignSystem;
    children: React.ReactNode;
}) {
    const { colors, fonts, radii } = designSystem;
    return (
        <YStack gap="$2.5">
            <ScaledText
                style={{ color: colors.mutedForeground }}
                fontFamily={fonts.bodyBold}
                fontSize={12}
                letterSpacing={1.2}
                textTransform="uppercase"
            >
                {title}
            </ScaledText>
            <YStack
                gap="$3"
                p="$4"
                rounded={radii.lg}
                borderWidth={1}
                borderColor={colors.border}
                bg={colors.surface}
            >
                {children}
            </YStack>
        </YStack>
    );
}

/**
 * Label, optional description, and optional trailing control for one setting.
 */
function SettingsRow({
    label,
    description,
    designSystem,
    trailing,
    children,
}: {
    label: string;
    description?: string;
    designSystem: DesignSystem;
    trailing?: React.ReactNode;
    children?: React.ReactNode;
}) {
    const { colors, fonts } = designSystem;
    return (
        <YStack gap="$2">
            <XStack items="center" justify="space-between" gap="$3">
                <YStack flex={1} gap="$0.5">
                    <ScaledText
                        style={{ color: colors.foreground }}
                        fontFamily={fonts.bodyBold}
                        fontSize={15}
                    >
                        {label}
                    </ScaledText>
                    {description === undefined ? null : (
                        <ScaledParagraph
                            style={{ color: colors.mutedForeground }}
                            fontFamily={fonts.bodyMedium}
                            fontSize={13}
                        >
                            {description}
                        </ScaledParagraph>
                    )}
                </YStack>
                {trailing}
            </XStack>
            {children}
        </YStack>
    );
}

/**
 * Read-only label/value pair for account details.
 */
function ReadOnlyRow({
    label,
    value,
    designSystem,
}: {
    label: string;
    value: string;
    designSystem: DesignSystem;
}) {
    const { colors, fonts } = designSystem;
    return (
        <XStack items="center" justify="space-between" gap="$3" py="$1">
            <ScaledText
                style={{ color: colors.mutedForeground }}
                fontFamily={fonts.bodyMedium}
                fontSize={14}
            >
                {label}
            </ScaledText>
            <ScaledText
                flex={1}
                style={{ color: colors.foreground, textAlign: "right" }}
                fontFamily={fonts.bodySemiBold}
                fontSize={14}
            >
                {value}
            </ScaledText>
        </XStack>
    );
}

/**
 * Hairline divider between rows.
 */
function Divider({ color }: { color: string }) {
    return <YStack height={1} style={{ backgroundColor: color }} />;
}
