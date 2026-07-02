import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { BarChart3, ClipboardCheck, LayoutDashboard, MapPinned } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import {
    getResponsiveTabBarLayout,
    useResponsiveLayout,
    type ResponsiveLayout,
} from "lib/responsive-layout";

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

function getResponsiveTabIconSize(
    layout: Pick<ResponsiveLayout, "isTablet">,
    defaultSize: number,
): number {
    return layout.isTablet ? 22 : defaultSize;
}

/**
 * Main tab layout for the YEE mobile app.
 */
export default function TabLayout() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const tabBarLayout = getResponsiveTabBarLayout(layout, insets.bottom);
    const tabBarLabelFontSize = layout.isTablet ? 12 : 10;
    const tabBarLabelLineHeight = layout.isTablet ? 16 : 14;

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
                    backgroundColor: designSystem.colors.background,
                    borderTopColor: designSystem.colors.border,
                    height: tabBarLayout.height,
                    paddingTop: tabBarLayout.paddingTop - 10,
                    paddingBottom: tabBarLayout.paddingBottom,
                },
                tabBarItemStyle: {
                    borderRadius: layout.isTablet ? designSystem.radii.md : 0,
                    marginHorizontal: layout.isTablet ? 4 : 0,
                    marginVertical: layout.isTablet ? 6 : 0,
                    paddingTop: 0,
                },
                tabBarLabelStyle: {
                    fontSize: tabBarLabelFontSize,
                    lineHeight: tabBarLabelLineHeight,
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
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <DashboardTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="places"
                options={{
                    title: "Places",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <PlacesTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="execute"
                options={{
                    title: "Execute",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <ExecuteTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: "Reports",
                    tabBarIcon: ({ size, color, focused }: TabIconProps) => (
                        <ReportsTabIcon
                            focused={focused}
                            color={color}
                            size={getResponsiveTabIconSize(layout, size)}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
