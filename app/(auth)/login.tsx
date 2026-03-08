import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, LogIn } from "@tamagui/lucide-icons";
import { Button, Input, Paragraph, Text, XStack, YStack } from "tamagui";
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

        try {
            await login({
                email: normalizedEmail,
                password: trimmedPassword,
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
                            YEE Sign In
                        </Text>
                        <Paragraph color="$color10">
                            Sign in with your YEE account to access field audits.
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
                            <Paragraph color="$color10">Email</Paragraph>
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                placeholder="auditor@example.com"
                            />
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
                                    textContentType="password"
                                    secureTextEntry={!showPassword}
                                    placeholder="Enter password"
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
                                void handleLogin();
                            }}
                        >
                            <XStack items="center" gap="$2">
                                <LogIn size={16} />
                                <Text>{isSubmitting ? "Signing In..." : "Sign In"}</Text>
                            </XStack>
                        </Button>
                    </YStack>

                    <XStack items="center" justify="center" gap="$1.5">
                        <Paragraph color="$color10">Need an account?</Paragraph>
                        <Link href="/(auth)/signup">
                            <Text color="$blue10" fontWeight="700">
                                Create one
                            </Text>
                        </Link>
                    </XStack>
                </YStack>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
