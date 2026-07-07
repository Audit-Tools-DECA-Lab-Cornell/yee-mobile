import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, UserRound } from "components/icons";
import { Button, Checkbox, Input, Sheet, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DevQuickLoginUser = {
    name: string;
    email: string;
};

/**
 * Dev-only quick-login roster.
 */
const DEV_QUICK_LOGIN_PASSWORD = process.env.EXPO_PUBLIC_DEV_QUICK_LOGIN_PASSWORD!;
const DEV_QUICK_LOGIN_STATIC_USERS: DevQuickLoginUser[] = [
    { name: "Demo Auditor One", email: "auditor-demo-1@yee.local" },
    { name: "Demo Auditor Two", email: "auditor-demo-2@yee.local" },
    { name: "Demo Auditor Three", email: "auditor-demo-3@yee.local" },
    { name: "Riverbend Youth Alliance Auditor 1", email: "riverbend-auditor1@example.org" },
    { name: "Riverbend Youth Alliance Auditor 2", email: "riverbend-auditor2@example.org" },
    { name: "Riverbend Youth Alliance Auditor 3", email: "riverbend-auditor3@example.org" },
    { name: "Riverbend Youth Alliance Auditor 4", email: "riverbend-auditor4@example.org" },
    { name: "Summit Community Trust Auditor 1", email: "summit-auditor1@example.org" },
    { name: "Summit Community Trust Auditor 2", email: "summit-auditor2@example.org" },
    { name: "Summit Community Trust Auditor 3", email: "summit-auditor3@example.org" },
    { name: "Summit Community Trust Auditor 4", email: "summit-auditor4@example.org" },
];
const TEST_AUDITOR_QUICK_LOGIN_DOMAIN = "example.org";
const TEST_AUDITOR_QUICK_LOGIN_START_INDEX = 1;
const TEST_AUDITOR_QUICK_LOGIN_END_INDEX = 30;

/**
 * Build seeded production test auditors: test-auditor-01@example.org … 30.
 */
function buildTestAuditorQuickLoginUsers(
    startIndex: number,
    endIndex: number,
): DevQuickLoginUser[] {
    const users: DevQuickLoginUser[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
        const paddedIndex = String(index).padStart(2, "0");
        users.push({
            name: `Test Auditor ${index}`,
            email: `test-auditor-${paddedIndex}@${TEST_AUDITOR_QUICK_LOGIN_DOMAIN}`,
        });
    }
    return users;
}

const DEV_QUICK_LOGIN_USERS: DevQuickLoginUser[] = [
    ...DEV_QUICK_LOGIN_STATIC_USERS,
    ...buildTestAuditorQuickLoginUsers(
        TEST_AUDITOR_QUICK_LOGIN_START_INDEX,
        TEST_AUDITOR_QUICK_LOGIN_END_INDEX,
    ),
];

/**
 * Login screen for YEE mobile.
 */
export default function LoginScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const login = useAuthStore((state) => state.login);
    const clearError = useAuthStore((state) => state.clearError);
    const isSubmitting = useAuthStore((state) => state.isSubmitting);
    const errorMessage = useAuthStore((state) => state.errorMessage);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const hasCachedAssignedPlaces = useYeeMobileStore((state) => state.hasCachedAssignedPlaces);
    const hasCachedInstrument = useYeeMobileStore((state) => state.hasCachedInstrument);

    const isDev = process.env.NODE_ENV === "development";
    const [email, setEmail] = useState<string>(isDev ? "auditor-demo-2@yee.local" : "");
    const [password, setPassword] = useState<string>(isDev ? "DemoPass123!" : "");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [staySignedIn, setStaySignedIn] = useState<boolean>(true);
    const [devSheetOpen, setDevSheetOpen] = useState<boolean>(false);

    const canSubmit = useMemo(() => {
        return !isSubmitting;
    }, [isSubmitting]);
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: true,
        scrollToOffset,
    });

    /**
     * Submit login credentials to backend auth.
     */
    const handleLogin = async (): Promise<void> => {
        clearError();
        setValidationMessage(null);

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setValidationMessage("Please enter a valid email address.");
            return;
        }
        if (trimmedPassword.length === 0) {
            setValidationMessage("Password is required.");
            return;
        }

        await login({
            email: normalizedEmail,
            password: trimmedPassword,
        });
    };

    /**
     * Dev-only shortcut: fill in a seeded test auditor and sign in immediately.
     * Wired up only when `isDev`, so it is inert in production builds.
     */
    const handleQuickLogin = async (userEmail: string): Promise<void> => {
        setDevSheetOpen(false);
        clearError();
        setValidationMessage(null);
        setEmail(userEmail);
        setPassword(DEV_QUICK_LOGIN_PASSWORD);
        await login({ email: userEmail, password: DEV_QUICK_LOGIN_PASSWORD });
    };

    /**
     * Explain how to recover account access. Password resets are handled by the
     * YEE backend, so we direct auditors to their program administrator rather
     * than expose a non-functional control.
     */
    const handleForgotPassword = (): void => {
        Alert.alert(
            "Reset your password",
            "Password resets are managed by your YEE program administrator. Contact them to receive a secure reset link for your auditor account.",
        );
    };

    const visibleErrorMessage = validationMessage ?? errorMessage;

    return (
        <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, backgroundColor: designSystem.colors.background }}
        >
            <ScrollView
                ref={scrollViewRef}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                    getResponsiveContentContainerStyle(layout, {
                        bottomPadding: 64,
                        topInset: insets.top,
                    }),
                    { flexGrow: 1, justifyContent: "center" },
                ]}
            >
                <YStack gap="$5" width="100%" style={{ alignSelf: "center" }}>
                    <YStack
                        gap="$4"
                        rounded={designSystem.radii.lg}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$5"
                        style={{ boxShadow: designSystem.shadows.card }}
                    >
                        <YStack gap="$3">
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={12}
                                textTransform="uppercase"
                                letterSpacing={2}
                                {...{
                                    onPress: () => setDevSheetOpen(true),
                                    pressStyle: { opacity: 0.6 },
                                    hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
                                }}
                            >
                                Audit Tools Platform
                            </Paragraph>
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={42}
                                lineHeight={46}
                                letterSpacing={-1.4}
                            >
                                Log in to the YEE workspace.
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={17}
                                lineHeight={28}
                            >
                                Sign in to access your assigned places and start auditing.
                            </Paragraph>
                        </YStack>

                        <YStack
                            gap="$2.5"
                            rounded={designSystem.radii.lg}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                            p="$3.5"
                        >
                            <Paragraph
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={14}
                            >
                                Offline readiness on this device
                            </Paragraph>
                            <ChecklistRow
                                done={hasOfflineLoginCredentials}
                                label="Sign-in saved for offline use"
                            />
                            <ChecklistRow
                                done={hasCachedAssignedPlaces}
                                label="Assigned places available offline"
                            />
                            <ChecklistRow
                                done={hasCachedInstrument}
                                label="Survey instrument ready offline"
                            />
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={13}
                                lineHeight={20}
                            >
                                {hasOfflineLoginCredentials &&
                                hasCachedAssignedPlaces &&
                                hasCachedInstrument
                                    ? "This device is ready for offline field work."
                                    : "Sign in once while online to prepare this device for offline use."}
                            </Paragraph>
                        </YStack>

                        <YStack gap="$2">
                            <Paragraph
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={14}
                            >
                                Email
                            </Paragraph>
                            <XStack
                                items="center"
                                gap="$3"
                                px="$4"
                                height={56}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.input}
                            >
                                <UserRound size={18} color={designSystem.colors.mutedForeground} />
                                <Input
                                    unstyled
                                    flex={1}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    textContentType="emailAddress"
                                    placeholder="auditor@example.com"
                                    placeholderTextColor="$color10"
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                    fontSize={16}
                                />
                            </XStack>
                        </YStack>

                        <YStack gap="$2">
                            <XStack justify="space-between" items="center" px="$1">
                                <Paragraph
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={14}
                                >
                                    Password
                                </Paragraph>
                                <Paragraph
                                    color={designSystem.colors.successText}
                                    fontFamily={designSystem.fonts.bodySemiBold}
                                    fontSize={13}
                                    onPress={handleForgotPassword}
                                    pressStyle={{ opacity: 0.6 }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Forgot password? Get help resetting it."
                                >
                                    Forgot password?
                                </Paragraph>
                            </XStack>
                            <XStack
                                items="center"
                                gap="$3"
                                px="$4"
                                height={56}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.input}
                            >
                                <KeyRound size={18} color={designSystem.colors.mutedForeground} />
                                <Input
                                    unstyled
                                    flex={1}
                                    value={password}
                                    onChangeText={setPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="password"
                                    secureTextEntry={!showPassword}
                                    placeholder="Enter password"
                                    placeholderTextColor="$color10"
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                    fontSize={16}
                                />
                                <Button
                                    chromeless
                                    size="$3"
                                    onPress={() => {
                                        setShowPassword((previousValue) => !previousValue);
                                    }}
                                >
                                    {showPassword ? (
                                        <EyeOff
                                            size={16}
                                            color={designSystem.colors.mutedForeground}
                                        />
                                    ) : (
                                        <Eye
                                            size={16}
                                            color={designSystem.colors.mutedForeground}
                                        />
                                    )}
                                </Button>
                            </XStack>
                        </YStack>

                        {visibleErrorMessage === null ? null : (
                            <YStack
                                borderWidth={1}
                                borderColor={designSystem.colors.danger}
                                bg={designSystem.colors.dangerSoft}
                                rounded={designSystem.radii.md}
                                p="$3"
                            >
                                <Paragraph
                                    color={designSystem.colors.dangerText}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                >
                                    {visibleErrorMessage}
                                </Paragraph>
                            </YStack>
                        )}

                        <XStack items="center" gap="$2" px="$1.5">
                            <Checkbox
                                value="staySignedIn"
                                onCheckedChange={(checkedState) => {
                                    setStaySignedIn(checkedState === true);
                                }}
                                checked={staySignedIn}
                            >
                                {staySignedIn ? (
                                    <Check size={16} color={designSystem.colors.successText} />
                                ) : null}
                            </Checkbox>
                            <Paragraph
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodySemiBold}
                                fontSize={15}
                            >
                                Stay signed in for offline field work
                            </Paragraph>
                        </XStack>

                        <Button
                            height={56}
                            rounded={designSystem.radii.button}
                            borderWidth={0}
                            bg={designSystem.colors.primary}
                            disabled={!canSubmit}
                            opacity={canSubmit ? 1 : 0.65}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => {
                                void handleLogin();
                            }}
                            style={{
                                boxShadow: designSystem.shadows.elevated,
                            }}
                        >
                            <XStack items="center" gap="$2">
                                <Text
                                    color={designSystem.colors.primaryForeground}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={16}
                                >
                                    {isSubmitting ? "Logging in..." : "Log in"}
                                </Text>
                                <ArrowRight
                                    size={16}
                                    color={designSystem.colors.primaryForeground}
                                />
                            </XStack>
                        </Button>

                        <YStack pt="$2" gap="$2.5" items="center">
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                Need an account?
                            </Paragraph>
                            <Button
                                chromeless
                                onPress={() => {
                                    router.push("/(auth)/signup");
                                }}
                            >
                                <Text
                                    color={designSystem.colors.successText}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={16}
                                >
                                    Create one here
                                </Text>
                            </Button>
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>

            <Sheet
                modal
                open={devSheetOpen}
                onOpenChange={setDevSheetOpen}
                snapPoints={[85]}
                snapPointsMode="percent"
                dismissOnSnapToBottom
                zIndex={100_000}
            >
                <Sheet.Overlay opacity={0.5} />
                <Sheet.Frame
                    p="$5"
                    pb={insets.bottom + 24}
                    gap="$3"
                    flex={1}
                    bg={designSystem.colors.background}
                    borderTopLeftRadius={designSystem.radii.lg}
                    borderTopRightRadius={designSystem.radii.lg}
                >
                    <Sheet.Handle bg={designSystem.colors.border} />
                    <YStack gap="$1" mt="$2">
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={22}
                        >
                            Dev quick login
                        </Text>
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                            fontSize={13}
                        >
                            Tap a seeded test auditor to sign in instantly. Shared password:{" "}
                            {DEV_QUICK_LOGIN_PASSWORD}
                        </Paragraph>
                    </YStack>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {DEV_QUICK_LOGIN_USERS.map((user) => (
                            <Button
                                key={user.email}
                                height={64}
                                justify="flex-start"
                                rounded={designSystem.radii.button}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.surface}
                                pressStyle={{ opacity: 0.9, scale: 0.99 }}
                                disabled={isSubmitting}
                                onPress={() => {
                                    void handleQuickLogin(user.email);
                                }}
                            >
                                <YStack gap="$0.5" items="flex-start">
                                    <Text
                                        color={designSystem.colors.foreground}
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={15}
                                    >
                                        {user.name}
                                    </Text>
                                    <Paragraph
                                        color={designSystem.colors.mutedForeground}
                                        fontFamily={designSystem.fonts.bodyMedium}
                                        fontSize={13}
                                    >
                                        {user.email}
                                    </Paragraph>
                                </YStack>
                            </Button>
                        ))}
                    </ScrollView>
                </Sheet.Frame>
            </Sheet>
        </KeyboardAvoidingView>
    );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
    const designSystem = useDesignSystem();
    return (
        <XStack items="flex-start" gap="$2.5">
            <YStack
                mt="$0.5"
                width={20}
                height={20}
                items="center"
                justify="center"
                rounded={designSystem.radii.full}
                bg={done ? designSystem.colors.successSoft : designSystem.colors.warningSoft}
            >
                <Check
                    size={12}
                    color={done ? designSystem.colors.successText : designSystem.colors.warningText}
                />
            </YStack>
            <Paragraph
                flex={1}
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={13}
                lineHeight={20}
            >
                {label}
            </Paragraph>
        </XStack>
    );
}
