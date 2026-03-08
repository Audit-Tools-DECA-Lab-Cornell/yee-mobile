import { Tabs } from "expo-router";
import { BarChart3, ClipboardCheck, LayoutDashboard, MapPinned } from "@tamagui/lucide-icons";
import { designSystem } from "lib/design-system";

interface TabIconProps {
    readonly focused: boolean;
    readonly size: number;
}

/**
 * Dashboard tab icon renderer.
 */
function DashboardTabIcon({ focused, size }: TabIconProps) {
    return (
        <LayoutDashboard
            color={focused ? designSystem.colors.primary : designSystem.colors.mutedForeground}
            size={size}
        />
    );
}

/**
 * Places tab icon renderer.
 */
function PlacesTabIcon({ focused, size }: TabIconProps) {
    return (
        <MapPinned
            color={focused ? designSystem.colors.primary : designSystem.colors.mutedForeground}
            size={size}
        />
    );
}

/**
 * Execute tab icon renderer.
 */
function ExecuteTabIcon({ focused, size }: TabIconProps) {
    return (
        <ClipboardCheck
            color={focused ? designSystem.colors.primary : designSystem.colors.mutedForeground}
            size={size}
        />
    );
}

/**
 * Reports tab icon renderer.
 */
function ReportsTabIcon({ focused, size }: TabIconProps) {
    return (
        <BarChart3
            color={focused ? designSystem.colors.primary : designSystem.colors.mutedForeground}
            size={size}
        />
    );
}

/**
 * Main tab layout for the playspace mobile demo.
 */
export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: {
                    backgroundColor: designSystem.colors.background,
                },
                tabBarActiveTintColor: designSystem.colors.primary,
                tabBarInactiveTintColor: designSystem.colors.mutedForeground,
                tabBarStyle: {
                    backgroundColor: designSystem.colors.overlay,
                    borderTopColor: designSystem.colors.border,
                    height: 78,
                    paddingTop: 8,
                    paddingBottom: 12,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontFamily: designSystem.fonts.bodyBold,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: DashboardTabIcon,
                }}
            />
            <Tabs.Screen
                name="places"
                options={{
                    title: "Places",
                    tabBarIcon: PlacesTabIcon,
                }}
            />
            <Tabs.Screen
                name="execute"
                options={{
                    title: "Execute",
                    tabBarIcon: ExecuteTabIcon,
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: "Reports",
                    tabBarIcon: ReportsTabIcon,
                }}
            />
        </Tabs>
    );
}
