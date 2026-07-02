import { describe, expect, it, vi } from "vitest";
import {
    createResponsiveLayout,
    getResponsiveContentContainerStyle,
    getResponsiveTabBarLayout,
} from "lib/responsive-layout";

vi.mock("react-native", () => ({
    useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

describe("createResponsiveLayout", () => {
    it("uses tablet layout at the shared Android medium-width breakpoint", () => {
        // Given: Android tablets enter the medium window class at 600dp.
        const tabletWindowWidth = 600;

        // When: YEE resolves shared mobile layout tokens.
        const layout = createResponsiveLayout(tabletWindowWidth);

        // Then: YEE switches to the same tablet behavior as COPA.
        expect(layout.isTablet).toBe(true);
        expect(layout.screenPaddingHorizontal).toBeGreaterThan(15);
        expect(layout.buttonHeight).toBeGreaterThan(52);
    });

    it("keeps compact phone widths on the phone layout", () => {
        // Given: a typical phone portrait width.
        const phoneWindowWidth = 390;

        // When: YEE resolves shared mobile layout tokens.
        const layout = createResponsiveLayout(phoneWindowWidth);

        // Then: phone surfaces keep the established compact spacing.
        expect(layout.isTablet).toBe(false);
        expect(layout.contentMaxWidth).toBe(560);
        expect(layout.screenPaddingHorizontal).toBe(15);
    });

    it("adds top safe-area inset to helper-managed screen padding", () => {
        // Given: a headerless screen under the Android status bar.
        const layout = createResponsiveLayout(390);
        const topInset = 24;

        // When: the shared content container style is built.
        const style = getResponsiveContentContainerStyle(layout, {
            bottomPadding: 32,
            topInset,
        });

        // Then: content clears both the safe area and normal top padding.
        expect(style.paddingTop).toBe(layout.screenPaddingVertical + topInset);
    });

    it("keeps tablet tab content clear after bottom safe-area padding is applied", () => {
        const layout = createResponsiveLayout(600);
        const bottomInset = 24;
        const tabBarLayout = getResponsiveTabBarLayout(layout, bottomInset);

        expect(tabBarLayout.height).toBe(
            tabBarLayout.contentHeight + tabBarLayout.paddingTop + tabBarLayout.paddingBottom,
        );
        expect(tabBarLayout.height - tabBarLayout.paddingTop - tabBarLayout.paddingBottom).toBe(
            layout.buttonHeight,
        );
    });
});
