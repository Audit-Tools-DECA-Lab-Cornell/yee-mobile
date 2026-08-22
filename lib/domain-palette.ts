/**
 * The domain colour palette, read from the canonical spec.
 *
 * `lib/domain-palette.json` is THE source of truth for every YEE domain colour
 * in this app. The same contents are committed in yee-frontend
 * (`src/styles/domain-palette.json`), where they also generate the `--domain-*`
 * CSS custom properties and feed the PDF/Excel export layer.
 * `DOMAIN_PALETTE_CHECKSUM` below is the same literal in both repos: editing the
 * spec without refreshing it fails the guard test, which is the prompt to make
 * the matching edit on the other side. The test cannot read yee-frontend, so the
 * two staying in step relies on the paired edit actually being made.
 *
 * Never hardcode a domain colour anywhere else. To change one: edit the JSON in
 * BOTH repos, refresh the checksum in both, regenerate the web's CSS tokens,
 * then run the palette guard tests on both sides.
 */
import spec from "./domain-palette.json";

/**
 * The four roles each domain carries. The split exists because one hue cannot
 * be readable text AND a legible chart fill: `text`/`strong` are dark enough to
 * carry type, `fill` is vivid enough to read as a chart mark.
 */
export type DomainRole = "text" | "strong" | "fill" | "light";

export type DomainMode = "light" | "dark";

/** Derived from the spec's own colour map, so a new domain is a compile error everywhere. */
export type DomainPaletteKey = keyof typeof spec.light;

export type DomainRoleColors = Readonly<Record<DomainRole, string>>;

/** Canonical domain order — audit step order, and the order charts assign in. */
export const domainPaletteOrder = spec.order as readonly DomainPaletteKey[];

/** Human-readable domain names, used by the guard tests. */
export const domainPaletteLabels = Object.fromEntries(
    domainPaletteOrder.map((key) => [key, spec.domains[key].label]),
) as Record<DomainPaletteKey, string>;

/** Every resolved colour, by mode then domain then role. */
export const domainPalette: Readonly<
    Record<DomainMode, Record<DomainPaletteKey, DomainRoleColors>>
> = {
    light: spec.light,
    dark: spec.dark,
};

/**
 * SHA-256 of the spec's CONTENT — keys sorted, whitespace stripped — asserted in
 * both repos. Content rather than raw bytes because the two repos format JSON
 * differently (tabs here, four spaces there), so a byte hash would break on a
 * formatter run while the colours were still identical. What must never drift
 * is the values; this catches exactly that.
 */
export const DOMAIN_PALETTE_CHECKSUM =
    "4c3bcff2f2127c6ec65f3a2ee2991b27df3cbf6ed872da4f8799592d6f59088f";

/**
 * The contrast floors every colour is held to. `text`/`strong` must clear their
 * floor against the card, the app background AND their own `light` tint, so
 * either is safe wherever it lands; `fill` only ever paints a mark, so it takes
 * WCAG 1.4.11's 3:1.
 */
export const DOMAIN_CONTRAST_FLOORS: Readonly<Record<Exclude<DomainRole, "light">, number>> = {
    text: 7,
    strong: 4.5,
    fill: 3,
};

/** Surfaces the floors above are measured against, per mode. */
export const DOMAIN_SURFACES: Readonly<Record<DomainMode, { card: string; app: string }>> = {
    light: { card: "#ffffff", app: "#f7f8f9" },
    dark: { card: "#1E201C", app: "#141513" },
};
