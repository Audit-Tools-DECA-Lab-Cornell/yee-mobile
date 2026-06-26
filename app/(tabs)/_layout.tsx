import { Tabs } from "expo-router";
import { BarChart3, ClipboardCheck, LayoutDashboard, MapPinned } from "components/icons";
import { useDesignSystem } from "lib/design-system";

interface TabIconProps {
    readonly focused: boolean;
    readonly size: number;
    readonly color: string;
}

/**
 * Dashboard tab icon renderer.
 */
function DashboardTabIcon({ size, color }: TabIconProps) {
    return <LayoutDashboard color={color} size={size} />;
}

/**
 * Places tab icon renderer.
 */
function PlacesTabIcon({ size, color }: TabIconProps) {
    return <MapPinned color={color} size={size} />;
}

/**
 * Execute tab icon renderer.
 */
function ExecuteTabIcon({ size, color }: TabIconProps) {
    return <ClipboardCheck color={color} size={size} />;
}

/**
 * Reports tab icon renderer.
 */
function ReportsTabIcon({ size, color }: TabIconProps) {
    return <BarChart3 color={color} size={size} />;
}

/**
 * Main tab layout for the YEE mobile app.
 */
export default function TabLayout() {
    const designSystem = useDesignSystem();
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
