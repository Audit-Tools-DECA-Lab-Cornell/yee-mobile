import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
    ArrowUpRight,
    BarChart3,
    Bell,
    ClipboardCheck,
    Clock3,
    LogOut,
    MapPinned,
    Play,
    Signal,
    UserRound,
    WifiOff,
} from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import {
    AUDITOR_DASHBOARD_METRICS,
    FIELD_PRIORITY_ITEMS,
    YEE_PLACES,
    type PlaceStatus,
    type PreAuditStatus,
} from "lib/yee-demo-data";
import {
    designSystem,
    getMetricTone,
    getPlaceStatusTone,
    getPreAuditTone,
} from "lib/design-system";
import { useDemoUiStore } from "stores/demo-ui-store";
import { useAuthStore } from "stores/auth-store";

const PLACE_STATUS_LABELS: Record<PlaceStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    ready_for_review: "Ready for Review",
    submitted: "Submitted",
};

const PRE_AUDIT_STATUS_LABELS: Record<PreAuditStatus, string> = {
    pending: "Base mode",
    in_progress: "Profile setup",
    completed: "Profile ready",
};

/**
 * Dashboard tab for YEE field operations.
 */
export default function DashboardScreen() {
    const router = useRouter();
    const setSelectedPlaceId = useDemoUiStore((state) => state.setSelectedPlaceId);
    const session = useAuthStore((state) => state.session);
    const logout = useAuthStore((state) => state.logout);
    const highlightedPlaces = useMemo(() => {
        return YEE_PLACES.filter((place) => place.status !== "submitted").slice(0, 3);
    }, []);
    const priorityPlace = highlightedPlaces[0] ?? YEE_PLACES[0];
    const assignedCount = YEE_PLACES.length;
    const fieldReadinessPercent = useMemo(() => {
        if (highlightedPlaces.length === 0) {
            return 0;
        }

        const totalCompletion = highlightedPlaces.reduce((sum, place) => {
            return sum + place.mandatoryCompletionPercent;
        }, 0);

        return Math.round(totalCompletion / highlightedPlaces.length);
    }, [highlightedPlaces]);
    const activeAuditorName = session?.user.name ?? session?.user.email ?? "Active auditor";
    const dateLabel = useMemo(() => {
        return new Date().toLocaleDateString("en-NZ", {
            month: "long",
            day: "numeric",
            year: "numeric",
            weekday: "long",
        });
    }, []);

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={{
                paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                paddingTop: designSystem.spacing.screenPaddingVertical,
                paddingBottom: 132,
                gap: 28,
            }}
        >
            <YStack gap="$6">
                <XStack justify="space-between" items="center" gap="$3">
                    <XStack items="center" gap="$3" flex={1}>
                        <YStack
                            width={44}
                            height={44}
                            items="center"
                            justify="center"
                            rounded={designSystem.radii.md}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                        >
                            <UserRound size={20} color={designSystem.colors.primary} />
                        </YStack>
                        <YStack flex={1} gap="$0.5">
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.4}
                            >
                                Active auditor
                            </Paragraph>
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={15}
                            >
                                {activeAuditorName}
                            </Text>
                        </YStack>
                    </XStack>

                    <XStack gap="$2">
                        <YStack
                            width={42}
                            height={42}
                            items="center"
                            justify="center"
                            rounded={designSystem.radii.full}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                        >
                            <Bell size={18} color={designSystem.colors.foreground} />
                        </YStack>
                        <Button
                            width={42}
                            height={42}
                            p={0}
                            rounded={designSystem.radii.full}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={logout}
                        >
                            <LogOut size={16} color={designSystem.colors.foreground} />
                        </Button>
                    </XStack>
                </XStack>

                <YStack gap="$1.5">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={34}
                        lineHeight={38}
                        letterSpacing={-0.8}
                    >
                        YEE Field Dashboard
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodySemiBold}
                    >
                        {dateLabel}
                    </Paragraph>
                </YStack>

                <XStack gap="$3">
                    <YStack
                        flex={1}
                        height={128}
                        justify="space-between"
                        rounded={designSystem.radii.lg}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$4"
                        style={{
                            boxShadow: designSystem.shadows.card,
                        }}
                    >
                        <YStack gap="$1">
                            <Text
                                color={designSystem.colors.primary}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={34}
                                lineHeight={36}
                            >
                                {assignedCount.toString().padStart(2, "0")}
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={11}
                                textTransform="uppercase"
                                letterSpacing={1.5}
                            >
                                Assigned
                            </Paragraph>
                        </YStack>
                        <MapPinned size={28} color="rgba(197, 138, 92, 0.3)" />
                    </YStack>

                    <YStack
                        flex={1}
                        height={128}
                        justify="space-between"
                        rounded={designSystem.radii.lg}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$4"
                        style={{
                            boxShadow: designSystem.shadows.card,
                        }}
                    >
                        <YStack gap="$1">
                            <Text
                                color={designSystem.colors.success}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={34}
                                lineHeight={36}
                            >
                                {`${fieldReadinessPercent}%`}
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={11}
                                textTransform="uppercase"
                                letterSpacing={1.5}
                            >
                                Field ready
                            </Paragraph>
                        </YStack>
                        <Signal size={28} color="rgba(111, 154, 127, 0.28)" />
                    </YStack>
                </XStack>
            </YStack>

            <YStack gap="$3">
                <XStack justify="space-between" items="center">
                    <Text
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.6}
                    >
                        Priority task
                    </Text>
                    <Paragraph
                        color={designSystem.colors.danger}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.3}
                    >
                        Due today
                    </Paragraph>
                </XStack>

                {priorityPlace === undefined ? null : (
                    <PriorityCard
                        placeId={priorityPlace.id}
                        placeName={priorityPlace.placeName}
                        projectName={priorityPlace.projectName}
                        locality={priorityPlace.locality}
                        baseScore={priorityPlace.baseScore}
                        mandatoryCompletionPercent={priorityPlace.mandatoryCompletionPercent}
                        preAuditStatus={priorityPlace.preAuditStatus}
                        onResume={() => {
                            setSelectedPlaceId(priorityPlace.id);
                            router.push("/(tabs)/execute");
                        }}
                    />
                )}
            </YStack>

            <XStack gap="$3">
                <DashboardActionButton
                    label="Places"
                    icon={<MapPinned size={16} color={designSystem.colors.foreground} />}
                    onPress={() => {
                        router.push("/places");
                    }}
                />
                <DashboardActionButton
                    label="Execute"
                    primary
                    icon={
                        <ClipboardCheck size={16} color={designSystem.colors.primaryForeground} />
                    }
                    onPress={() => {
                        router.push("/execute");
                    }}
                />
                <DashboardActionButton
                    label="Reports"
                    icon={<BarChart3 size={16} color={designSystem.colors.foreground} />}
                    onPress={() => {
                        router.push("/reports");
                    }}
                />
            </XStack>

            <YStack gap="$3">
                <Text
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={11}
                    textTransform="uppercase"
                    letterSpacing={1.6}
                >
                    Connectivity status
                </Text>

                <YStack
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    rounded={designSystem.radii.lg}
                    p="$4"
                    gap="$3"
                    bg={designSystem.colors.surfaceMuted}
                    style={{
                        boxShadow: designSystem.shadows.card,
                    }}
                >
                    <XStack items="center" gap="$3">
                        <YStack
                            width={44}
                            height={44}
                            items="center"
                            justify="center"
                            rounded={designSystem.radii.md}
                            bg={designSystem.colors.successSoft}
                        >
                            <WifiOff size={22} color={designSystem.colors.success} />
                        </YStack>
                        <YStack flex={1} gap="$1">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={15}
                            >
                                Offline ready
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                Assigned YEE audit data and base-scoring prompts are stored locally
                                and ready for field capture.
                            </Paragraph>
                        </YStack>
                    </XStack>
                </YStack>
            </YStack>

            <YStack gap="$3">
                <XStack justify="space-between" items="center">
                    <Text
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.6}
                    >
                        Field priorities
                    </Text>
                    <Text
                        color={designSystem.colors.primary}
                        fontFamily={designSystem.fonts.monoBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {fieldReadinessPercent}% ready
                    </Text>
                </XStack>

                <XStack gap="$2.5">
                    {FIELD_PRIORITY_ITEMS.map((item) => {
                        return (
                            <YStack
                                key={item.id}
                                flex={1}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.surface}
                                p="$3"
                            >
                                <Paragraph
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={10}
                                    textTransform="uppercase"
                                    letterSpacing={1.2}
                                >
                                    {item.title}
                                </Paragraph>
                                <Text
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.headingBold}
                                    fontSize={24}
                                    mt="$2"
                                >
                                    {item.value}
                                </Text>
                            </YStack>
                        );
                    })}
                </XStack>
            </YStack>

            <YStack gap="$3">
                <Text
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={11}
                    textTransform="uppercase"
                    letterSpacing={1.6}
                >
                    Operations snapshot
                </Text>

                <YStack gap="$3">
                    {AUDITOR_DASHBOARD_METRICS.map((metric) => {
                        const metricTone = getMetricTone(metric.tone);

                        return (
                            <YStack
                                key={metric.id}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.surface}
                                p="$4"
                                gap="$3"
                                style={{
                                    boxShadow: designSystem.shadows.card,
                                }}
                            >
                                <XStack justify="space-between" items="flex-start" gap="$3">
                                    <YStack flex={1} gap="$1">
                                        <Paragraph
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                            fontSize={10}
                                            textTransform="uppercase"
                                            letterSpacing={1.2}
                                        >
                                            {metric.title}
                                        </Paragraph>
                                        <Text
                                            style={{ color: metricTone.text }}
                                            fontFamily={designSystem.fonts.headingBold}
                                            fontSize={30}
                                        >
                                            {metric.value}
                                        </Text>
                                    </YStack>
                                    <ArrowUpRight size={18} color={metricTone.text} />
                                </XStack>
                                <YStack
                                    rounded={designSystem.radii.sm}
                                    px="$3"
                                    py="$2"
                                    style={{ backgroundColor: metricTone.surface }}
                                >
                                    <Paragraph
                                        style={{ color: metricTone.text }}
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={11}
                                    >
                                        {metric.helperText}
                                    </Paragraph>
                                </YStack>
                            </YStack>
                        );
                    })}
                </YStack>
            </YStack>

            <YStack gap="$3">
                <XStack justify="space-between" items="center">
                    <Text
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.6}
                    >
                        Active work
                    </Text>
                    <Button
                        chromeless
                        onPress={() => {
                            router.push("/places");
                        }}
                    >
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={11}
                            textTransform="uppercase"
                            letterSpacing={1.3}
                        >
                            See all
                        </Text>
                    </Button>
                </XStack>

                <YStack gap="$3">
                    {highlightedPlaces.map((place) => {
                        const placeTone = getPlaceStatusTone(place.status);
                        const preAuditTone = getPreAuditTone(place.preAuditStatus);

                        return (
                            <YStack
                                key={place.id}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.surface}
                                p="$4"
                                gap="$3"
                                style={{
                                    boxShadow: designSystem.shadows.card,
                                }}
                            >
                                <YStack gap="$2.5">
                                    <YStack gap="$1" style={{ minWidth: 0 }}>
                                        <Text
                                            color={designSystem.colors.foreground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                            fontSize={16}
                                            lineHeight={22}
                                            numberOfLines={2}
                                        >
                                            {place.placeName}
                                        </Text>
                                        <Text
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyMedium}
                                            fontSize={13}
                                            lineHeight={18}
                                            numberOfLines={2}
                                        >
                                            {place.projectName}
                                        </Text>
                                    </YStack>

                                    <XStack items="center" gap="$2" flexWrap="wrap">
                                        <YStack
                                            rounded={designSystem.radii.full}
                                            px="$3"
                                            py="$1"
                                            style={{ backgroundColor: placeTone.surface }}
                                        >
                                            <Text
                                                style={{ color: placeTone.text }}
                                                fontFamily={designSystem.fonts.bodyBold}
                                                fontSize={10}
                                                textTransform="uppercase"
                                                letterSpacing={1.1}
                                            >
                                                {PLACE_STATUS_LABELS[place.status]}
                                            </Text>
                                        </YStack>
                                        <YStack
                                            rounded={designSystem.radii.full}
                                            px="$3"
                                            py="$1"
                                            style={{ backgroundColor: preAuditTone.surface }}
                                        >
                                            <Text
                                                style={{ color: preAuditTone.text }}
                                                fontFamily={designSystem.fonts.bodyBold}
                                                fontSize={10}
                                                textTransform="uppercase"
                                                letterSpacing={1.1}
                                            >
                                                {PRE_AUDIT_STATUS_LABELS[place.preAuditStatus]}
                                            </Text>
                                        </YStack>
                                    </XStack>
                                </YStack>

                                <XStack gap="$2">
                                    <YStack
                                        flex={1}
                                        rounded={designSystem.radii.md}
                                        borderWidth={1}
                                        borderColor={designSystem.colors.border}
                                        bg={designSystem.colors.surfaceMuted}
                                        px="$3"
                                        py="$2"
                                        gap="$1"
                                    >
                                        <Text
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                            fontSize={10}
                                            textTransform="uppercase"
                                            letterSpacing={1.2}
                                        >
                                            Base mode
                                        </Text>
                                        <Text
                                            color={designSystem.colors.primary}
                                            fontFamily={designSystem.fonts.headingBold}
                                            fontSize={28}
                                            lineHeight={32}
                                        >
                                            {place.baseScore}%
                                        </Text>
                                    </YStack>

                                    <YStack
                                        flex={1}
                                        rounded={designSystem.radii.md}
                                        borderWidth={1}
                                        borderColor={designSystem.colors.border}
                                        bg={designSystem.colors.surfaceMuted}
                                        px="$3"
                                        py="$2"
                                        gap="$1"
                                    >
                                        <Text
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                            fontSize={10}
                                            textTransform="uppercase"
                                            letterSpacing={1.2}
                                        >
                                            Mandatory
                                        </Text>
                                        <Text
                                            color={designSystem.colors.foreground}
                                            fontFamily={designSystem.fonts.headingBold}
                                            fontSize={28}
                                            lineHeight={32}
                                        >
                                            {place.mandatoryCompletionPercent}%
                                        </Text>
                                    </YStack>
                                </XStack>

                                <XStack items="center" gap="$2" flexWrap="wrap">
                                    <Paragraph
                                        color={preAuditTone.text}
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={12}
                                    >
                                        {place.preAuditStatus === "completed"
                                            ? "Weighted score ready"
                                            : place.preAuditStatus === "in_progress"
                                              ? "Weighting in progress"
                                              : "Weighting pending"}
                                    </Paragraph>
                                </XStack>

                                <YStack
                                    height={7}
                                    rounded={designSystem.radii.full}
                                    bg={designSystem.colors.mutedSurface}
                                    overflow="hidden"
                                >
                                    <YStack
                                        height={7}
                                        rounded={designSystem.radii.full}
                                        bg={designSystem.colors.primary}
                                        width={`${place.mandatoryCompletionPercent}%`}
                                    />
                                </YStack>

                                <XStack justify="space-between" items="center" gap="$2">
                                    <XStack
                                        items="center"
                                        gap="$1.5"
                                        flex={1}
                                        style={{ minWidth: 0 }}
                                    >
                                        <Clock3
                                            size={13}
                                            color={designSystem.colors.mutedForeground}
                                        />
                                        <Text
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyMedium}
                                            numberOfLines={1}
                                        >
                                            {place.updatedAtLabel}
                                        </Text>
                                    </XStack>
                                    <Button
                                        height={36}
                                        width={112}
                                        px="$2.5"
                                        rounded={designSystem.radii.sm}
                                        borderWidth={0}
                                        bg={designSystem.colors.primary}
                                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                        onPress={() => {
                                            setSelectedPlaceId(place.id);
                                            router.push("/(tabs)/execute");
                                        }}
                                    >
                                        <XStack items="center" gap="$1.5">
                                            <Text
                                                color={designSystem.colors.primaryForeground}
                                                fontFamily={designSystem.fonts.bodyBold}
                                                fontSize={10}
                                                textTransform="uppercase"
                                                letterSpacing={1}
                                            >
                                                Open audit
                                            </Text>
                                            <ArrowUpRight
                                                size={14}
                                                color={designSystem.colors.primaryForeground}
                                            />
                                        </XStack>
                                    </Button>
                                </XStack>
                            </YStack>
                        );
                    })}
                </YStack>
            </YStack>
        </ScrollView>
    );
}

interface DashboardActionButtonProps {
    readonly label: string;
    readonly icon: React.ReactNode;
    readonly onPress: () => void;
    readonly primary?: boolean;
}

/**
 * Quick dashboard action button used for primary tab shortcuts.
 *
 * @param props Button content and styling.
 * @returns Styled dashboard action.
 */
function DashboardActionButton({
    label,
    icon,
    onPress,
    primary = false,
}: DashboardActionButtonProps) {
    return (
        <Button
            flex={1}
            height={48}
            rounded={designSystem.radii.md}
            borderWidth={primary ? 0 : 1}
            borderColor={designSystem.colors.border}
            bg={primary ? designSystem.colors.primary : designSystem.colors.surfaceMuted}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
        >
            <XStack items="center" gap="$2">
                {icon}
                <Text
                    color={
                        primary
                            ? designSystem.colors.primaryForeground
                            : designSystem.colors.foreground
                    }
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={12}
                    textTransform="uppercase"
                    letterSpacing={1.2}
                >
                    {label}
                </Text>
            </XStack>
        </Button>
    );
}

interface PriorityCardProps {
    readonly placeId: string;
    readonly placeName: string;
    readonly projectName: string;
    readonly locality: string;
    readonly baseScore: number;
    readonly mandatoryCompletionPercent: number;
    readonly preAuditStatus: PreAuditStatus;
    readonly onResume: () => void;
}

/**
 * Highlight card for the most urgent field task on the dashboard.
 *
 * @param props Priority card data and action.
 * @returns High-emphasis dashboard card.
 */
function PriorityCard({
    placeId,
    placeName,
    projectName,
    locality,
    baseScore,
    mandatoryCompletionPercent,
    preAuditStatus,
    onResume,
}: PriorityCardProps) {
    const preAuditTone = getPreAuditTone(preAuditStatus);

    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={2}
            borderColor={designSystem.colors.primary}
            bg={designSystem.colors.surface}
            overflow="hidden"
            style={{
                boxShadow: designSystem.shadows.card,
            }}
        >
            <YStack p="$4" gap="$3" bg={designSystem.colors.surface}>
                <XStack gap="$2" items="center" flexWrap="wrap">
                    <YStack
                        rounded={designSystem.radii.sm}
                        px="$2"
                        py="$1"
                        bg={designSystem.colors.primary}
                    >
                        <Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.3}
                        >
                            Urgent audit
                        </Text>
                    </YStack>
                    <YStack
                        rounded={designSystem.radii.sm}
                        px="$2"
                        py="$1"
                        bg={designSystem.colors.surfaceMuted}
                    >
                        <Text
                            color={designSystem.colors.secondaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.3}
                        >
                            {locality}
                        </Text>
                    </YStack>
                </XStack>

                <YStack gap="$1">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={24}
                        lineHeight={28}
                    >
                        {placeName}
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {projectName}
                    </Paragraph>
                </YStack>

                <XStack items="center" gap="$2" flexWrap="wrap">
                    <YStack
                        rounded={designSystem.radii.full}
                        px="$3"
                        py="$1"
                        style={{ backgroundColor: preAuditTone.surface }}
                    >
                        <Text
                            style={{ color: preAuditTone.text }}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.1}
                        >
                            {PRE_AUDIT_STATUS_LABELS[preAuditStatus]}
                        </Text>
                    </YStack>
                    <Paragraph
                        color={designSystem.colors.primary}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Base {baseScore}%
                    </Paragraph>
                </XStack>
            </YStack>

            <XStack
                items="center"
                gap="$4"
                p="$4"
                borderTopWidth={1}
                borderTopColor={designSystem.colors.border}
            >
                <YStack flex={1} gap="$2">
                    <YStack
                        height={6}
                        rounded={designSystem.radii.full}
                        bg={designSystem.colors.mutedSurface}
                        overflow="hidden"
                    >
                        <YStack
                            height={6}
                            rounded={designSystem.radii.full}
                            bg={designSystem.colors.primary}
                            width={`${mandatoryCompletionPercent}%`}
                        />
                    </YStack>
                    <Text
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.monoBold}
                        fontSize={11}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {mandatoryCompletionPercent}% progress • {placeId.toUpperCase()}
                    </Text>
                </YStack>
                <Button
                    height={40}
                    px="$4"
                    rounded={designSystem.radii.sm}
                    borderWidth={0}
                    bg={designSystem.colors.primary}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onResume}
                >
                    <XStack items="center" gap="$2">
                        <Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={12}
                            textTransform="uppercase"
                            letterSpacing={1.2}
                        >
                            Resume
                        </Text>
                        <Play size={14} color={designSystem.colors.primaryForeground} />
                    </XStack>
                </Button>
            </XStack>
        </YStack>
    );
}
