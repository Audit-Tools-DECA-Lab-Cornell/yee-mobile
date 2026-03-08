import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
    ArrowUpRight,
    BarChart3,
    ClipboardCheck,
    Clock3,
    LogOut,
    MapPinned,
    Users,
} from "@tamagui/lucide-icons";
import { Button, Paragraph, Separator, Text, XStack, YStack } from "tamagui";
import { RoleToggle } from "components/RoleToggle";
import {
    DASHBOARD_METRICS_BY_ROLE,
    FIELD_PRIORITY_ITEMS,
    ROLE_LABELS,
    YEE_PLACES,
    type MetricTone,
    type PlaceStatus,
} from "lib/yee-demo-data";
import { useDemoUiStore } from "stores/demo-ui-store";
import { useAuthStore } from "stores/auth-store";

type ToneTextColor = "$blue10" | "$green10" | "$purple10" | "$orange10";
type ToneBackgroundColor = "$blue3" | "$green3" | "$purple3" | "$orange3";

interface MetricToneView {
    readonly textColor: ToneTextColor;
    readonly backgroundColor: ToneBackgroundColor;
}

const METRIC_TONE_VIEW: Record<MetricTone, MetricToneView> = {
    blue: {
        textColor: "$blue10",
        backgroundColor: "$blue3",
    },
    green: {
        textColor: "$green10",
        backgroundColor: "$green3",
    },
    purple: {
        textColor: "$purple10",
        backgroundColor: "$purple3",
    },
    orange: {
        textColor: "$orange10",
        backgroundColor: "$orange3",
    },
};

const PLACE_STATUS_LABELS: Record<PlaceStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    ready_for_review: "Ready for Review",
    submitted: "Submitted",
};

/**
 * Dashboard tab for YEE field operations.
 */
export default function DashboardScreen() {
    const router = useRouter();
    const activeRole = useDemoUiStore((state) => state.activeRole);
    const setSelectedPlaceId = useDemoUiStore((state) => state.setSelectedPlaceId);
    const session = useAuthStore((state) => state.session);
    const logout = useAuthStore((state) => state.logout);

    const metrics = DASHBOARD_METRICS_BY_ROLE[activeRole];
    const highlightedPlaces = useMemo(() => {
        return YEE_PLACES.filter((place) => place.status !== "submitted").slice(0, 3);
    }, []);
    const fieldReadinessPercent = useMemo(() => {
        if (highlightedPlaces.length === 0) {
            return 0;
        }

        const totalCompletion = highlightedPlaces.reduce((sum, place) => {
            return sum + place.mandatoryCompletionPercent;
        }, 0);

        return Math.round(totalCompletion / highlightedPlaces.length);
    }, [highlightedPlaces]);

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <YStack gap="$4">
                <YStack
                    borderWidth={1}
                    borderColor="$blue6"
                    rounded={20}
                    p="$4"
                    gap="$3"
                    bg="$blue2"
                >
                    <XStack justify="space-between" items="center">
                        <Text fontSize={24} fontWeight="700">
                            YEE Field App
                        </Text>
                        <XStack gap="$2">
                            <YStack rounded={999} px="$3" py="$1" bg="$blue4">
                                <Paragraph color="$blue10" fontWeight="700">
                                    Offline Ready
                                </Paragraph>
                            </YStack>
                            <Button
                                size="$2"
                                onPress={() => {
                                    void logout();
                                }}
                            >
                                <XStack items="center" gap="$1.5">
                                    <LogOut size={12} />
                                    <Text>Sign out</Text>
                                </XStack>
                            </Button>
                        </XStack>
                    </XStack>
                    <Text fontSize={28} fontWeight="700">
                        Daily Brief
                    </Text>
                    <Paragraph color="$color10">
                        Standalone YEE mobile UI with place-level progress, weighted scoring, and
                        in-field execution.
                    </Paragraph>
                    {session !== null ? (
                        <Paragraph color="$color10">Signed in as {session.user.email}</Paragraph>
                    ) : null}

                    <XStack gap="$2">
                        {FIELD_PRIORITY_ITEMS.map((item) => {
                            return (
                                <YStack
                                    key={item.id}
                                    flex={1}
                                    borderWidth={1}
                                    borderColor="$blue6"
                                    rounded={14}
                                    p="$3"
                                    bg="$background"
                                >
                                    <Paragraph color="$color10" fontSize={12}>
                                        {item.title}
                                    </Paragraph>
                                    <Text fontSize={22} fontWeight="700" color="$blue10">
                                        {item.value}
                                    </Text>
                                </YStack>
                            );
                        })}
                    </XStack>
                </YStack>

                <RoleToggle />

                <XStack
                    items="center"
                    gap="$2"
                    borderWidth={1}
                    borderColor="$borderColor"
                    bg="$background"
                    rounded={16}
                    p="$3"
                >
                    <Users size={16} color="$blue10" />
                    <Paragraph fontWeight="600" color="$color11">
                        Showing {ROLE_LABELS[activeRole]} indicators
                    </Paragraph>
                </XStack>

                <YStack
                    borderWidth={1}
                    borderColor="$borderColor"
                    rounded={16}
                    p="$4"
                    bg="$background"
                    gap="$2.5"
                    shadowColor="$shadowColor"
                    shadowOpacity={0.08}
                    shadowRadius={8}
                    shadowOffset={{ width: 0, height: 3 }}
                    elevation={2}
                >
                    <XStack justify="space-between" items="center">
                        <Paragraph color="$color10">Field readiness</Paragraph>
                        <Paragraph color="$green10" fontWeight="700">
                            {fieldReadinessPercent}%
                        </Paragraph>
                    </XStack>
                    <YStack height={8} rounded={999} bg="$background">
                        <YStack
                            height={8}
                            rounded={999}
                            bg="$green9"
                            width={`${fieldReadinessPercent}%`}
                        />
                    </YStack>
                </YStack>

                <XStack gap="$2">
                    <Button
                        flex={1}
                        size="$3"
                        theme="blue"
                        onPress={() => {
                            router.push("/places");
                        }}
                    >
                        <XStack items="center" gap="$1.5">
                            <MapPinned size={14} />
                            <Text>Places</Text>
                        </XStack>
                    </Button>
                    <Button
                        flex={1}
                        size="$3"
                        onPress={() => {
                            router.push("/execute");
                        }}
                    >
                        <XStack items="center" gap="$1.5">
                            <ClipboardCheck size={14} />
                            <Text>Execute</Text>
                        </XStack>
                    </Button>
                    <Button
                        flex={1}
                        size="$3"
                        theme="purple"
                        onPress={() => {
                            router.push("/reports");
                        }}
                    >
                        <XStack items="center" gap="$1.5">
                            <BarChart3 size={14} />
                            <Text>Reports</Text>
                        </XStack>
                    </Button>
                </XStack>
            </YStack>

            <YStack key={activeRole} gap="$3">
                {metrics.map((metric) => {
                    const metricToneView = METRIC_TONE_VIEW[metric.tone];

                    return (
                        <YStack
                            key={metric.id}
                            borderWidth={1}
                            borderColor="$borderColor"
                            bg="$background"
                            rounded={16}
                            p="$4"
                            gap="$2"
                            shadowColor="$shadowColor"
                            shadowOpacity={0.08}
                            shadowRadius={8}
                            shadowOffset={{ width: 0, height: 3 }}
                            elevation={2}
                            pressStyle={{ scale: 0.99 }}
                        >
                            <Paragraph color="$color10">{metric.title}</Paragraph>
                            <Text fontSize={30} fontWeight="700" color={metricToneView.textColor}>
                                {metric.value}
                            </Text>
                            <XStack items="center" gap="$2">
                                <YStack
                                    rounded={999}
                                    px="$2.5"
                                    py="$1"
                                    bg={metricToneView.backgroundColor}
                                >
                                    <Paragraph color={metricToneView.textColor} fontWeight="700">
                                        {metric.helperText}
                                    </Paragraph>
                                </YStack>
                                <ArrowUpRight size={14} color={metricToneView.textColor} />
                            </XStack>
                        </YStack>
                    );
                })}
            </YStack>

            <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded={16}
                bg="$background"
                p="$4"
                gap="$3"
            >
                <XStack justify="space-between" items="center">
                    <Text fontSize={19} fontWeight="700">
                        Recent Place Activity
                    </Text>
                    <Button
                        size="$2"
                        theme="blue"
                        onPress={() => {
                            router.push("/places");
                        }}
                    >
                        See all
                    </Button>
                </XStack>

                <Separator borderColor="$borderColor" />

                {highlightedPlaces.map((place, index) => {
                    const isLastItem = index === highlightedPlaces.length - 1;

                    return (
                        <YStack key={place.id} gap="$2">
                            <XStack justify="space-between" items="center">
                                <YStack>
                                    <Text fontSize={16} fontWeight="600">
                                        {place.placeName}
                                    </Text>
                                    <Paragraph color="$color10">{place.projectName}</Paragraph>
                                </YStack>
                                <YStack items="flex-end">
                                    <Paragraph color="$blue10" fontWeight="600">
                                        Base {place.baseScore}%
                                    </Paragraph>
                                    <Paragraph color="$purple10" fontWeight="600">
                                        Weighted {place.weightedScore}%
                                    </Paragraph>
                                </YStack>
                            </XStack>

                            <XStack justify="space-between" items="center">
                                <Paragraph color="$color10">
                                    Mandatory completion {place.mandatoryCompletionPercent}%
                                </Paragraph>
                                <YStack rounded={999} px="$3" py="$1" bg="$blue3">
                                    <Paragraph color="$blue10" fontWeight="700">
                                        {PLACE_STATUS_LABELS[place.status]}
                                    </Paragraph>
                                </YStack>
                            </XStack>

                            <XStack justify="space-between" items="center">
                                <XStack items="center" gap="$1.5">
                                    <Clock3 size={12} color="$color10" />
                                    <Paragraph color="$color10">{place.updatedAtLabel}</Paragraph>
                                </XStack>
                                <Button
                                    size="$2"
                                    theme="blue"
                                    onPress={() => {
                                        setSelectedPlaceId(place.id);
                                        router.push("/(tabs)/execute");
                                    }}
                                >
                                    Open audit
                                </Button>
                            </XStack>

                            {isLastItem ? null : <Separator mt="$2" borderColor="$borderColor" />}
                        </YStack>
                    );
                })}
            </YStack>
        </ScrollView>
    );
}
