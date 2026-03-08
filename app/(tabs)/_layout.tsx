import { Tabs } from "expo-router";
import { BarChart3, ClipboardCheck, LayoutDashboard, MapPinned } from "@tamagui/lucide-icons";
import { useTheme } from "tamagui";

interface TabIconProps {
    readonly focused: boolean;
    readonly size: number;
}

/**
 * Dashboard tab icon renderer.
 */
function DashboardTabIcon({ focused, size }: TabIconProps) {
    return <LayoutDashboard color={focused ? "$blue10" : "$color10"} size={size} />;
}

/**
 * Places tab icon renderer.
 */
function PlacesTabIcon({ focused, size }: TabIconProps) {
    return <MapPinned color={focused ? "$blue10" : "$color10"} size={size} />;
}

/**
 * Execute tab icon renderer.
 */
function ExecuteTabIcon({ focused, size }: TabIconProps) {
    return <ClipboardCheck color={focused ? "$blue10" : "$color10"} size={size} />;
}

/**
 * Reports tab icon renderer.
 */
function ReportsTabIcon({ focused, size }: TabIconProps) {
    return <BarChart3 color={focused ? "$blue10" : "$color10"} size={size} />;
}

/**
 * Main tab layout for the YEE mobile demo.
 */
export default function TabLayout() {
    const theme = useTheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.blue10.val,
                tabBarInactiveTintColor: theme.color10.val,
                tabBarStyle: {
                    backgroundColor: theme.background.val,
                    borderTopColor: theme.borderColor.val,
                    height: 64,
                    paddingTop: 6,
                    paddingBottom: 8,
                },
                headerStyle: {
                    backgroundColor: theme.background.val,
                    borderBottomColor: theme.borderColor.val,
                },
                headerTintColor: theme.color.val,
                headerShadowVisible: false,
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "600",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    headerTitle: "YEE Field Overview",
                    tabBarIcon: DashboardTabIcon,
                }}
            />
            <Tabs.Screen
                name="places"
                options={{
                    title: "Places",
                    headerTitle: "Assigned YEE Places",
                    tabBarIcon: PlacesTabIcon,
                }}
            />
            <Tabs.Screen
                name="execute"
                options={{
                    title: "Execute",
                    headerTitle: "YEE Audit Execution",
                    tabBarIcon: ExecuteTabIcon,
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: "Reports",
                    headerTitle: "Base vs Weighted Reports",
                    tabBarIcon: ReportsTabIcon,
                }}
            />
        </Tabs>
    );
}
