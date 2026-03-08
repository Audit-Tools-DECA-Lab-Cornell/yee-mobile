import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, UserPlus } from "@tamagui/lucide-icons";
import { Button, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { useAuthStore } from "stores/auth-store";
import type { AccountType } from "lib/auth/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Signup screen for creating YEE accounts.
 */
export default function SignupScreen() {
    const router = useRouter();
    const signup = useAuthStore((state) => state.signup);
    const clearError = useAuthStore((state) => state.clearError);
    const isSubmitting = useAuthStore((state) => state.isSubmitting);
    const errorMessage = useAuthStore((state) => state.errorMessage);

    const [name, setName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [accountType, setAccountType] = useState<AccountType>("AUDITOR");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        return !isSubmitting;
    }, [isSubmitting]);

    /**
     * Submit signup payload to backend auth.
     */
    const handleSignup = async (): Promise<void> => {
        clearError();
        setValidationMessage(null);

        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();
        const trimmedConfirmPassword = confirmPassword.trim();

        if (trimmedName.length < 2) {
            setValidationMessage("Please enter your full name.");
            return;
        }
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setValidationMessage("Please enter a valid email address.");
            return;
        }
        if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
            setValidationMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (trimmedPassword !== trimmedConfirmPassword) {
            setValidationMessage("Passwords do not match.");
            return;
        }

        try {
            await signup({
                name: trimmedName,
                email: normalizedEmail,
                password: trimmedPassword,
                accountType,
            });

            router.replace("/(tabs)");
        } catch {
            // Store already exposes a user-facing error message.
        }
    };

    const visibleErrorMessage = validationMessage ?? errorMessage;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, padding: 16, justifyContent: "center" }}
            >
                <YStack gap="$4">
                    <YStack gap="$2">
                        <Text fontSize={32} fontWeight="700">
                            Create YEE Account
                        </Text>
                        <Paragraph color="$color10">
                            Set up your account to start managing or executing YEE audits.
                        </Paragraph>
                    </YStack>

                    <YStack
                        borderWidth={1}
                        borderColor="$borderColor"
                        rounded={16}
                        p="$4"
                        gap="$3"
                        bg="$background"
                    >
                        <YStack gap="$2">
                            <Paragraph color="$color10">Full Name</Paragraph>
                            <Input
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                autoCorrect={false}
                                textContentType="name"
                                placeholder="Your name"
                            />
                        </YStack>

                        <YStack gap="$2">
                            <Paragraph color="$color10">Email</Paragraph>
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                placeholder="you@example.com"
                            />
                        </YStack>

                        <YStack gap="$2">
                            <Paragraph color="$color10">Account Type</Paragraph>
                            <XStack gap="$2">
                                <Button
                                    flex={1}
                                    size="$3"
                                    theme={accountType === "AUDITOR" ? "blue" : null}
                                    onPress={() => {
                                        setAccountType("AUDITOR");
                                    }}
                                >
                                    Auditor
                                </Button>
                                <Button
                                    flex={1}
                                    size="$3"
                                    theme={accountType === "MANAGER" ? "green" : null}
                                    onPress={() => {
                                        setAccountType("MANAGER");
                                    }}
                                >
                                    Manager
                                </Button>
                            </XStack>
                        </YStack>

                        <YStack gap="$2">
                            <Paragraph color="$color10">Password</Paragraph>
                            <XStack gap="$2" items="center">
                                <Input
                                    flex={1}
                                    value={password}
                                    onChangeText={setPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="newPassword"
                                    secureTextEntry={!showPassword}
                                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                />
                                <Button
                                    size="$3"
                                    onPress={() => {
                                        setShowPassword((previousValue) => !previousValue);
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Button>
                            </XStack>
                        </YStack>

                        <YStack gap="$2">
                            <Paragraph color="$color10">Confirm Password</Paragraph>
                            <XStack gap="$2" items="center">
                                <Input
                                    flex={1}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="newPassword"
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="Re-enter password"
                                />
                                <Button
                                    size="$3"
                                    onPress={() => {
                                        setShowConfirmPassword((previousValue) => !previousValue);
                                    }}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Button>
                            </XStack>
                        </YStack>

                        {visibleErrorMessage === null ? null : (
                            <YStack
                                borderWidth={1}
                                borderColor="$red8"
                                bg="$red3"
                                rounded={12}
                                p="$3"
                            >
                                <Paragraph color="$red10">{visibleErrorMessage}</Paragraph>
                            </YStack>
                        )}

                        <Button
                            theme="blue"
                            size="$4"
                            disabled={!canSubmit}
                            onPress={() => {
                                void handleSignup();
                            }}
                        >
                            <XStack items="center" gap="$2">
                                <UserPlus size={16} />
                                <Text>
                                    {isSubmitting ? "Creating Account..." : "Create Account"}
                                </Text>
                            </XStack>
                        </Button>
                    </YStack>

                    <XStack items="center" justify="center" gap="$1.5">
                        <Paragraph color="$color10">Already have an account?</Paragraph>
                        <Link href="/(auth)/login">
                            <Text color="$blue10" fontWeight="700">
                                Sign in
                            </Text>
                        </Link>
                    </XStack>
                </YStack>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
