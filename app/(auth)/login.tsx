import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
    ArrowRight,
    Check,
    Eye,
    EyeOff,
    KeyRound,
    ShieldCheck,
    UserRound,
} from "@tamagui/lucide-icons";
import { Button, Checkbox, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { useAuthStore } from "stores/auth-store";

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

        router.replace("/(tabs)");
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
                <YStack gap="$6" width="100%" style={{ maxWidth: 440, alignSelf: "center" }}>
                    <YStack items="center" gap="$4">
                        <YStack
                            width={88}
                            height={88}
                            items="center"
                            justify="center"
                            rounded={designSystem.radii.xl}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                            style={{
                                boxShadow: designSystem.shadows.card,
                            }}
                        >
                            <ShieldCheck size={34} color={designSystem.colors.primary} />
                        </YStack>

                        <YStack items="center" gap="$2">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize="$5"
                                lineHeight={36}
                                textTransform="uppercase"
                                fontStyle="italic"
                                letterSpacing={-0.5}
                            >
                                Youth Enabling Environments
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodySemiBold}
                                fontSize={12}
                                textTransform="uppercase"
                                letterSpacing={1.6}
                            >
                                Field audit professional
                            </Paragraph>
                        </YStack>
                    </YStack>

                    <YStack gap="$4">
                        <YStack gap="$2">
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={12}
                                textTransform="uppercase"
                                letterSpacing={1.5}
                                px="$1"
                            >
                                Auditor identity
                            </Paragraph>
                            <XStack
                                items="center"
                                gap="$3"
                                px="$4"
                                height={56}
                                rounded={designSystem.radii.md}
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
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={12}
                                    textTransform="uppercase"
                                    letterSpacing={1.5}
                                >
                                    Access key
                                </Paragraph>
                                <Paragraph
                                    color={designSystem.colors.primary}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={11}
                                    textTransform="uppercase"
                                    letterSpacing={1.1}
                                >
                                    Offline sign-in
                                </Paragraph>
                            </XStack>
                            <XStack
                                items="center"
                                gap="$3"
                                px="$4"
                                height={56}
                                rounded={designSystem.radii.md}
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
                            rounded={designSystem.radii.md}
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
                                    fontSize={13}
                                    textTransform="uppercase"
                                    letterSpacing={1.4}
                                >
                                    {isSubmitting ? "Initializing access..." : "Initialize access"}
                                </Text>
                                <ArrowRight
                                    size={16}
                                    color={designSystem.colors.primaryForeground}
                                />
                            </XStack>
                        </Button>

                        <YStack
                            pt="$5"
                            gap="$3"
                            items="center"
                            borderTopWidth={1}
                            borderTopColor={designSystem.colors.border}
                        >
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                New auditor or need access?
                            </Paragraph>
                            <Button
                                height={44}
                                px="$4"
                                rounded={designSystem.radii.md}
                                borderWidth={1}
                                borderColor="rgba(255, 107, 0, 0.24)"
                                bg="transparent"
                                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                onPress={() => {
                                    router.push("/(auth)/signup");
                                }}
                            >
                                <Text
                                    color={designSystem.colors.primary}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={12}
                                    textTransform="uppercase"
                                    letterSpacing={1.3}
                                >
                                    Access setup guide
                                </Text>
                            </Button>
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
