import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { useResponsiveLayout } from "lib/responsive-layout";

/**
 * Controls whether the rail renders on phone-width viewports.
 *
 * - `always`: the rail stacks below `main` on phones.
 * - `tablet-only`: the rail is omitted on phones; the screen renders the same
 *   content inline inside `main` when it must keep its phone position.
 */
export type TwoPaneRailVisibility = "always" | "tablet-only";

export interface TwoPaneLayoutProps {
    /** Primary work content. Fills the remaining pane width on tablets. */
    readonly main: ReactNode;
    /** Secondary/support content shown in a fixed-width rail on tablets. */
    readonly rail: ReactNode;
    /**
     * Fixed rail width on tablets. Defaults to `layout.supportRailWidth`
     * (screens with a bespoke rail pass e.g. `layout.homePageSupportRailWidth`).
     */
    readonly railWidth?: number;
    /** Phone behavior for the rail. Defaults to `always` (stacks below `main`). */
    readonly railVisibility?: TwoPaneRailVisibility;
    /** Gap between the panes on tablets. Defaults to `layout.twoPaneGap`. */
    readonly gap?: number;
}

/**
 * Responsive two-pane shell for tab-level screens (SYNTHESIS Issue C).
 *
 * On tablets (`layout.isTablet`) it renders `main` and `rail` side by side:
 * `main` flexes to the remaining width while `rail` keeps a fixed width. On
 * phones it renders a plain vertical stack (`main` then `rail`), or `main`
 * alone when `railVisibility` is `tablet-only`.
 *
 * The component adds no horizontal padding or width constraints of its own —
 * it must sit inside the screen's existing centered content track (the
 * container produced by `getResponsiveContentContainerStyle`).
 *
 * @param props Pane content plus optional rail width, visibility, and gap.
 * @returns The breakpoint-aware pane arrangement.
 */
export function TwoPaneLayout({
    main,
    rail,
    railWidth,
    railVisibility = "always",
    gap,
}: TwoPaneLayoutProps) {
    const layout = useResponsiveLayout();

    if (layout.isTablet) {
        return (
            <XStack gap={gap ?? layout.twoPaneGap} items="flex-start">
                <YStack flex={1} style={{ minWidth: 0 }}>
                    {main}
                </YStack>
                <YStack width={railWidth ?? layout.supportRailWidth} style={{ flexShrink: 0 }}>
                    {rail}
                </YStack>
            </XStack>
        );
    }

    return (
        <YStack gap={layout.sectionGap}>
            {main}
            {railVisibility === "tablet-only" ? null : rail}
        </YStack>
    );
}
