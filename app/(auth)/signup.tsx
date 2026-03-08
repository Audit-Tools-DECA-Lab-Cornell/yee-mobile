import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ShieldAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";

/**
 * Signup route shares auditor access setup guidance.
 */
export default function SignupScreen() {
    const router = useRouter();

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, justifyContent: "center" }}>
            <YStack gap="$4">
                <YStack gap="$2">
                    <Text fontSize={32} fontWeight="700">
                        Auditor Access Setup
                    </Text>
                    <Paragraph color="$color10">
                        Auditor mobile access is set up during project onboarding. Self-signup is
                        disabled on mobile.
                    </Paragraph>
                </YStack>

                <YStack
                    borderWidth={1}
                    borderColor="$orange7"
                    bg="$orange3"
                    rounded={16}
                    p="$4"
                    gap="$2"
                >
                    <XStack items="center" gap="$2">
                        <ShieldAlert size={16} color="$orange10" />
                        <Text color="$orange10" fontWeight="700">
                            Use your assigned auditor credentials.
                        </Text>
                    </XStack>
                    <Paragraph color="$orange10">
                        If you need access, ask your project lead to set up your auditor account and
                        share sign-in details.
                    </Paragraph>
                </YStack>

                <Button
                    theme="blue"
                    size="$4"
                    onPress={() => {
                        router.replace("/(auth)/login");
                    }}
                >
                    <XStack items="center" gap="$2">
                        <ArrowLeft size={16} />
                        <Text>Back to Sign In</Text>
                    </XStack>
                </Button>
            </YStack>
        </ScrollView>
    );
}
