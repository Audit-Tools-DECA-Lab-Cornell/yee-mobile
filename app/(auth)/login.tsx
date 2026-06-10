import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, UserRound } from "components/icons";
import { Button, Checkbox, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login screen for YEE mobile.
 */
export default function LoginScreen() {
    const router = useRouter();
    const login = useAuthStore((state) => state.login);
    const clearError = useAuthStore((state) => state.clearError);
    const isSubmitting = useAuthStore((state) => state.isSubmitting);
    const errorMessage = useAuthStore((state) => state.errorMessage);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const hasCachedAssignedPlaces = useYeeMobileStore((state) => state.hasCachedAssignedPlaces);
    const hasCachedInstrument = useYeeMobileStore((state) => state.hasCachedInstrument);

    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [staySignedIn, setStaySignedIn] = useState<boolean>(true);

    const canSubmit = useMemo(() => {
        return !isSubmitting;
    }, [isSubmitting]);

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

    const visibleErrorMessage = validationMessage ?? errorMessage;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, backgroundColor: designSystem.colors.background }}
        >
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingVertical: 48,
                    justifyContent: "center",
                }}
            >
                <YStack gap="$5" width="100%" style={{ maxWidth: 460, alignSelf: "center" }}>
                    <YStack gap="$2" px="$1">
                        <Paragraph
                            color={designSystem.colors.secondaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={12}
                            textTransform="uppercase"
                            letterSpacing={2}
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
                            Continue your auditor fieldwork with a calmer, offline-friendly mobile
                            flow.
                        </Paragraph>
                    </YStack>

                    <YStack
                        gap="$4"
                        rounded={30}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$5"
                        style={{ boxShadow: designSystem.shadows.card }}
                    >
                        <YStack gap="$3">
                            <XStack
                                rounded={designSystem.radii.full}
                                px="$3"
                                py="$1.5"
                                bg={designSystem.colors.mintSoft}
                                style={{ alignSelf: "flex-start" }}
                            >
                                <Paragraph
                                    color={designSystem.colors.success}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={11}
                                >
                                    Step 1 of product flow
                                </Paragraph>
                            </XStack>
                            <YStack gap="$1.5">
                                <Text
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.headingBold}
                                    fontSize={34}
                                    lineHeight={38}
                                    letterSpacing={-0.8}
                                >
                                    Log in
                                </Text>
                                <Paragraph
                                    color={designSystem.colors.secondaryForeground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                    fontSize={16}
                                    lineHeight={25}
                                >
                                    Use your verified YEE account to continue into the correct
                                    onboarding step or dashboard.
                                </Paragraph>
                            </YStack>
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
                                label="Offline sign-in has been saved from a previous successful login"
                            />
                            <ChecklistRow
                                done={hasCachedAssignedPlaces}
                                label="Assigned places are cached for field access"
                            />
                            <ChecklistRow
                                done={hasCachedInstrument}
                                label="The YEE survey instrument is cached for offline scoring"
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
                                    ? "This device is already prepared for offline field work."
                                    : "Complete one successful online login and sync so this device is fully ready before going offline."}
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
                                    color={designSystem.colors.success}
                                    fontFamily={designSystem.fonts.bodySemiBold}
                                    fontSize={13}
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
                                    color={designSystem.colors.danger}
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
                                    <Check size={16} color={designSystem.colors.success} />
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
                            rounded={designSystem.radii.full}
                            borderWidth={0}
                            bg={designSystem.colors.primary}
                            disabled={!canSubmit}
                            opacity={canSubmit ? 1 : 0.65}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => {
                                void handleLogin();
                            }}
                            style={{
                                boxShadow: designSystem.shadows.accent,
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
                                    color={designSystem.colors.success}
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
        </KeyboardAvoidingView>
    );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
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
                    color={done ? designSystem.colors.success : designSystem.colors.warning}
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
