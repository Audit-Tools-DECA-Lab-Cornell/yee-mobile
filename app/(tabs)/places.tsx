import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Clock3, Link2, LocateFixed, MapPin, Users } from "@tamagui/lucide-icons";
import { Button, Paragraph, Separator, Text, XStack, YStack } from "tamagui";
import { YEE_PLACES, type PlaceStatus, type PreAuditStatus } from "lib/yee-demo-data";
import { RoleToggle } from "components/RoleToggle";
import { useDemoUiStore } from "stores/demo-ui-store";

type StatusTextColor = "$orange10" | "$blue10" | "$purple10" | "$green10";
type StatusBackgroundColor = "$orange4" | "$blue4" | "$purple4" | "$green4";

const PLACE_STATUS_VIEW: Record<
    PlaceStatus,
    {
        readonly label: string;
        readonly textColor: StatusTextColor;
        readonly backgroundColor: StatusBackgroundColor;
    }
> = {
    not_started: {
        label: "Not Started",
        textColor: "$orange10",
        backgroundColor: "$orange4",
    },
    in_progress: {
        label: "In Progress",
        textColor: "$blue10",
        backgroundColor: "$blue4",
    },
    ready_for_review: {
        label: "Ready for Review",
        textColor: "$purple10",
        backgroundColor: "$purple4",
    },
    submitted: {
        label: "Submitted",
        textColor: "$green10",
        backgroundColor: "$green4",
    },
};

const PRE_AUDIT_STATUS_VIEW: Record<
    PreAuditStatus,
    {
        readonly label: string;
        readonly textColor: StatusTextColor;
        readonly backgroundColor: StatusBackgroundColor;
    }
> = {
    pending: {
        label: "Weights Pending",
        textColor: "$orange10",
        backgroundColor: "$orange4",
    },
    in_progress: {
        label: "Weights In Progress",
        textColor: "$blue10",
        backgroundColor: "$blue4",
    },
    completed: {
        label: "Weights Completed",
        textColor: "$green10",
        backgroundColor: "$green4",
    },
};

/**
 * Places tab with polished cards for YEE status and weighting visibility.
 */
export default function PlacesScreen() {
    const router = useRouter();
    const activeRole = useDemoUiStore((state) => state.activeRole);
    const setSelectedPlaceId = useDemoUiStore((state) => state.setSelectedPlaceId);
    const placeStatusCounts = useMemo(() => {
        return YEE_PLACES.reduce(
            (accumulator, place) => {
                accumulator[place.status] += 1;
                return accumulator;
            },
            {
                not_started: 0,
                in_progress: 0,
                ready_for_review: 0,
                submitted: 0,
            } satisfies Record<PlaceStatus, number>,
        );
    }, []);

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <YStack gap="$4">
                <Text fontSize={28} fontWeight="700">
                    YEE Places
                </Text>
                <Paragraph color="$color10">
                    Browse assigned places with base vs weighted score tracking and mandatory
                    completion.
                </Paragraph>
                <RoleToggle />
                <XStack gap="$2">
                    <YStack
                        flex={1}
                        borderWidth={1}
                        borderColor="$blue6"
                        rounded={12}
                        p="$3"
                        bg="$blue2"
                    >
                        <Paragraph color="$color10" fontSize={12}>
                            In Progress
                        </Paragraph>
                        <Text fontSize={20} fontWeight="700" color="$blue10">
                            {placeStatusCounts.in_progress}
                        </Text>
                    </YStack>
                    <YStack
                        flex={1}
                        borderWidth={1}
                        borderColor="$purple6"
                        rounded={12}
                        p="$3"
                        bg="$purple2"
                    >
                        <Paragraph color="$color10" fontSize={12}>
                            Ready Review
                        </Paragraph>
                        <Text fontSize={20} fontWeight="700" color="$purple10">
                            {placeStatusCounts.ready_for_review}
                        </Text>
                    </YStack>
                    <YStack
                        flex={1}
                        borderWidth={1}
                        borderColor="$green6"
                        rounded={12}
                        p="$3"
                        bg="$green2"
                    >
                        <Paragraph color="$color10" fontSize={12}>
                            Submitted
                        </Paragraph>
                        <Text fontSize={20} fontWeight="700" color="$green10">
                            {placeStatusCounts.submitted}
                        </Text>
                    </YStack>
                </XStack>
            </YStack>

            <YStack gap="$3">
                {YEE_PLACES.map((place) => {
                    const placeStatus = PLACE_STATUS_VIEW[place.status];
                    const preAuditStatus = PRE_AUDIT_STATUS_VIEW[place.preAuditStatus];

                    return (
                        <YStack
                            key={place.id}
                            borderWidth={1}
                            borderColor="$borderColor"
                            rounded={16}
                            bg="$background"
                            p="$4"
                            gap="$3"
                            shadowColor="$shadowColor"
                            shadowOpacity={0.07}
                            shadowRadius={8}
                            shadowOffset={{ width: 0, height: 3 }}
                            elevation={2}
                            pressStyle={{ scale: 0.995 }}
                        >
                            <XStack justify="space-between" items="center" gap="$3">
                                <YStack flex={1} gap="$1">
                                    <Text fontSize={17} fontWeight="700">
                                        {place.placeName}
                                    </Text>
                                    <Paragraph color="$color10">{place.projectName}</Paragraph>
                                </YStack>
                                <YStack
                                    rounded={999}
                                    px="$3"
                                    py="$1.5"
                                    bg={placeStatus.backgroundColor}
                                >
                                    <Paragraph color={placeStatus.textColor} fontWeight="700">
                                        {placeStatus.label}
                                    </Paragraph>
                                </YStack>
                            </XStack>

                            <XStack items="center" gap="$2">
                                <MapPin size={14} color="$color10" />
                                <Paragraph color="$color10">{place.locality}</Paragraph>
                            </XStack>

                            <XStack gap="$3">
                                <YStack
                                    flex={1}
                                    borderWidth={1}
                                    borderColor="$borderColor"
                                    rounded={12}
                                    p="$3"
                                >
                                    <Paragraph color="$color10">Base Score</Paragraph>
                                    <Text fontSize={23} fontWeight="700" color="$blue10">
                                        {place.baseScore}%
                                    </Text>
                                </YStack>
                                <YStack
                                    flex={1}
                                    borderWidth={1}
                                    borderColor="$borderColor"
                                    rounded={12}
                                    p="$3"
                                >
                                    <Paragraph color="$color10">Weighted Score</Paragraph>
                                    <Text fontSize={23} fontWeight="700" color="$purple10">
                                        {place.weightedScore}%
                                    </Text>
                                </YStack>
                            </XStack>

                            <YStack gap="$1.5">
                                <XStack justify="space-between" items="center">
                                    <Paragraph color="$color10">Mandatory completion</Paragraph>
                                    <Paragraph color="$blue10" fontWeight="700">
                                        {place.mandatoryCompletionPercent}%
                                    </Paragraph>
                                </XStack>
                                <YStack height={8} rounded={999} bg="$background">
                                    <YStack
                                        height={8}
                                        rounded={999}
                                        bg="$blue9"
                                        width={`${place.mandatoryCompletionPercent}%`}
                                    />
                                </YStack>
                            </YStack>

                            <XStack
                                justify="space-between"
                                items="center"
                                bg="$background"
                                rounded={12}
                                p="$3"
                            >
                                <YStack gap="$1.5">
                                    <XStack items="center" gap="$2">
                                        <Users size={14} color="$color10" />
                                        <Paragraph color="$color10">
                                            {place.assignedAuditorCount} auditors assigned
                                        </Paragraph>
                                    </XStack>
                                    <XStack items="center" gap="$2">
                                        <Clock3 size={14} color="$color10" />
                                        <Paragraph color="$color10">
                                            {place.updatedAtLabel}
                                        </Paragraph>
                                    </XStack>
                                </YStack>
                                <XStack
                                    rounded={999}
                                    px="$3"
                                    py="$1.5"
                                    bg={preAuditStatus.backgroundColor}
                                >
                                    <Paragraph color={preAuditStatus.textColor} fontWeight="700">
                                        {preAuditStatus.label}
                                    </Paragraph>
                                </XStack>
                            </XStack>

                            <Separator borderColor="$borderColor" />

                            <XStack justify="space-between" items="center">
                                <Paragraph color="$color10">{place.projectName}</Paragraph>
                                <XStack gap="$2">
                                    {activeRole === "manager" ? (
                                        <Button size="$2" theme="purple">
                                            <XStack items="center" gap="$1">
                                                <Link2 size={14} />
                                                <Text>Review weights</Text>
                                            </XStack>
                                        </Button>
                                    ) : null}
                                    <Button
                                        size="$2"
                                        theme="blue"
                                        onPress={() => {
                                            setSelectedPlaceId(place.id);
                                            router.push("/(tabs)/execute");
                                        }}
                                    >
                                        <XStack items="center" gap="$1">
                                            <LocateFixed size={14} />
                                            <Text>Open YEE audit</Text>
                                        </XStack>
                                    </Button>
                                </XStack>
                            </XStack>
                        </YStack>
                    );
                })}
            </YStack>
        </ScrollView>
    );
}
