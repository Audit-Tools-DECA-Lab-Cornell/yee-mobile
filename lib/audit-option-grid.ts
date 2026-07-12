/**
 * Column layout policy for audit answer option grids (`OptionGrid` /
 * `MultiOptionGrid` in `components/audit/primitives.tsx`).
 *
 * Kept as a dependency-free module (no Tamagui / React Native imports) so the
 * column decision is a pure function that can be unit-tested in the Node test
 * environment without rendering a component tree.
 */

/**
 * Longest option label (trimmed character count) still allowed to render 2-up.
 *
 * Short answers (`Yes` / `No` / `Spring` / `Summer`, weather chips) sit
 * comfortably in a two-column grid on the narrow-tablet form column
 * (`formMaxWidth` = 600). Longer, sentence-length options (e.g. visit-frequency
 * descriptions) would wrap awkwardly in a half-width cell, so any option set
 * containing one keeps the single-column, full-width row where its text can
 * wrap and the row grows with it.
 */
export const OPTION_GRID_TWO_UP_LABEL_MAX = 24;

/**
 * Whether an option set should render as a 2-up grid rather than a single
 * column.
 *
 * Two-up is reserved for tablet viewports (`useResponsiveLayout().isTablet`)
 * with more than one short-labelled option; phones and long-label sets always
 * stay single-column so wrapping text keeps a full row.
 *
 * @param options Answer options for the question (only `label` is read).
 * @param isTablet Whether the active viewport uses the tablet layout tier.
 * @returns `true` when the options should be laid out two per row.
 */
export function shouldRenderOptionsTwoUp(
    options: readonly { readonly label: string }[],
    isTablet: boolean,
): boolean {
    if (!isTablet || options.length < 2) {
        return false;
    }

    return options.every((option) => option.label.trim().length <= OPTION_GRID_TWO_UP_LABEL_MAX);
}
