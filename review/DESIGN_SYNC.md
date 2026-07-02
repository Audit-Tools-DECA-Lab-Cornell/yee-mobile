# DESIGN_SYNC — yee-mobile ↔ yee-frontend design-system parity spec

Decision record for bringing the mobile design system in sync with the web app.
Authored 2026-07-02 against `yee-frontend/DESIGN.md` + `src/app/globals.css`
(source of truth for web tokens) and `yee-mobile/lib/design-system.ts` +
`DESIGN.md` (mobile). Implemented by Stages 1–3 of `review/UPGRADE_PLAN.md`.

Web OKLCH values were converted to sRGB hex with a colorimetric conversion
(OKLab → LMS → linear sRGB), and every text/surface pair below was validated
against WCAG AA (≥ 4.5:1 for text) by computation, not eyeball.

## Sync principles (the design judgment)

1. **Web is the brand authority for light theme.** Mobile's light palette was
   built to "mirror the frontend's green/cream identity", but the frontend is
   no longer cream — it is a cool near-white with a disciplined green ramp.
   Mobile's warm-cream drift (and its teal-leaning primary, hue 179 vs the
   brand's 161) is un-mirrored brand debt, not a field-use adaptation. Mobile
   adopts the web light surfaces and brand green exactly.
2. **Mobile owns what web doesn't have.** Dark theme, semantic status colors
   (success/warning/info), decorative accent tones, OpenDyslexic support, and
   touch metrics have no web counterpart. They stay mobile-owned but are tuned
   to pass AA and share the brand hue where applicable.
3. **Semantic roles sync exactly; physical values sync where platform-neutral.**
   Radius scale, shadow discipline, motion curves, and component conventions
   copy the web. Densities (padding, gaps) stay platform-tuned and are
   documented as deliberate.
4. **One grotesque, like the web.** Web sets Inter for everything. Geist is the
   mobile-native equivalent of Inter (near-identical metrics and voice) and
   stays as body. Headings move from Space Grotesk to Geist SemiBold/Bold so
   both products speak with one typographic voice; JetBrains Mono stays for
   eyebrows/labels/numerics on both. (Rejected alternative: adding Space
   Grotesk to web — out of scope for this effort; revisit only if the team
   misses the display personality.)

---

## 1. Color — light palette (`lightColors`)

| Mobile token                              | Current   | New                                                     | Source / rationale                                                                                                             |
| ----------------------------------------- | --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `background`                              | `#FBFAF6` | `#F5F7F9`                                               | web `--yee-surface-app` oklch(0.975 0.003 240)                                                                                 |
| `backgroundAccent`                        | `#F6F3EC` | `#F0F7F2`                                               | web `--accent` = `--yee-green-50` oklch(0.97 0.01 158)                                                                         |
| `foreground`                              | `#0F1720` | `#07090B`                                               | web `--foreground` oklch(0.14 0.006 240); 18.5:1 on background                                                                 |
| `primary`                                 | `#10231F` | `#001F10`                                               | web `--yee-green-900` oklch(0.21 0.052 161). Fixes hue drift (mobile was hue 179/teal, brand is 161/green). 17.4:1 under white |
| `primaryForeground`                       | `#FFFFFF` | `#F8F8F8`                                               | web `--primary-foreground` oklch(0.98 0 0)                                                                                     |
| `surface`                                 | `#FFFFFF` | `#FFFFFF` (keep)                                        | = web `--yee-surface-card`                                                                                                     |
| `surfaceMuted`                            | `#F8F4EE` | `#F1F4F6`                                               | web `--yee-surface-muted` oklch(0.965 0.004 240)                                                                               |
| `mutedSurface`                            | `#F0EBE2` | `#EDF1F4`                                               | web `--yee-surface-hover` oklch(0.955 0.006 240); progress tracks / inert fills                                                |
| `input`                                   | `#FBFCFE` | `#FBFCFE` (keep)                                        | already cool-tinted near-white; compatible with new surfaces                                                                   |
| `border`                                  | `#DDD6CB` | `#D4D8DB`                                               | web `--border` oklch(0.88 0.006 240)                                                                                           |
| `mutedForeground`                         | `#6B706F` | `#636A6F`                                               | web `--muted-foreground` oklch(0.52 0.012 240); 5.11:1 on background                                                           |
| `secondaryForeground`                     | `#4D5966` | keep                                                    | mobile-only role; passes AA                                                                                                    |
| `ring` _(new)_                            | —         | `#224C37`                                               | web `--ring` = `--yee-green-700` oklch(0.38 0.06 160); focus-visible outlines                                                  |
| `success` / `warning` / `danger` / `info` | keep hues | keep                                                    | mobile-owned semantic set (web defines only `--destructive`); accent/fill usage only — **never as text** (see §2)              |
| `mint/sky/amber/rose/violet` + `*Soft`    | keep      | keep                                                    | mobile-owned decorative/domain tones                                                                                           |
| `overlay`, `*Soft` alphas                 | keep      | recompute `overlay` base to `rgba(245, 247, 249, 0.92)` | follows new `background`                                                                                                       |

Full web green ramp for reference (hex-converted): 950 `#001406`, 900
`#001F10`, 800 `#0F3021` (pressed/hover on dark), 700 `#224C37` (ring), 600
`#3D7055`, 500 `#558F6E`, 200 `#B6D3C1`, 100 `#DDECE3`, 50 `#F0F7F2`. Web
`--destructive` ≈ `#E60016` (mobile keeps its calmer `#B5483D` for field use —
documented divergence).

## 2. Color — AA text tones (new tokens, both palettes)

Measured failures in the current light theme: `warning` on `warningSoft`
**2.12:1**, `success` as text **3.07:1**, `info` on `infoSoft` **2.27:1**,
`danger` on `dangerSoft` **4.43:1**. Root cause: `DesignTone.text` reuses the
accent color, which is tuned as a fill, not as type.

Add `*Text` tokens — same hue/chroma as each accent with lightness lowered
until ≥ 4.5:1 over the composited soft surface:

| New token     | Light value              | Ratio on soft surface | Dark value                      |
| ------------- | ------------------------ | --------------------- | ------------------------------- |
| `successText` | `#35735C`                | 4.66                  | `#7FBFA3` (accent already 6.42) |
| `warningText` | `#8A5F16`                | 4.64                  | `#E0B873` (7.13)                |
| `dangerText`  | `#B2453A`                | 4.62                  | `#E08379` (5.27)                |
| `infoText`    | `#4969A0`                | 4.61                  | `#9DB8E6` (passes)              |
| `violetText`  | `#726395`                | 4.66                  | `#C6B6EE` (passes)              |
| `primaryText` | = `primary` (17:1, fine) | —                     | = `primary`                     |

Rule change in `getMetricTone` / `getPlaceStatusTone` / `getPreAuditTone` /
`getStepTone`: `DesignTone.text` returns the `*Text` token; `accent` stays the
fill/border color. This fixes the amber "NOT STARTED" badge and the
success-green metric text as a class, on every screen at once.

Dark palette: `*Text` = the existing accent values (all measured ≥ 5.27:1); no
visual change in dark.

## 3. Color — dark palette

Mobile-owned (web has no dark theme). Keep as-is — every measured pair passes
AA comfortably (primary-on-background 8.62:1, primaryForeground-on-primary
8.39:1). Two adjustments only:

- add `ring: "#558F6E"` (web green-500 — the "lighter green on dark" the web
  sidebar already uses);
- add the `*Text` aliases from §2.

## 4. Radii

Adopt the web scale (web `DESIGN.md` §Radius) — mobile is currently 2px tighter
across the board and matches neither web nor its own docs:

| Token    | Mobile current | New (= web)                                       |
| -------- | -------------- | ------------------------------------------------- |
| `sm`     | 4              | **6** (inputs, badges-as-tags)                    |
| `md`     | 8              | **10** (buttons, small cards)                     |
| `lg`     | 12             | **14** (cards, panels)                            |
| `xl`     | 16             | **20** (major surfaces)                           |
| `button` | 10             | **10** (unchanged — already = web md; never pill) |
| `full`   | 999            | 999 (pill badges + status dots ONLY)              |

Web hard caps adopted verbatim: **cards max at `lg` (14)**; `full` only for
pill badges and dots. (`radii.button` stays the single knob for interactive
elements — do not migrate buttons onto `md`.)

## 5. Elevation / shadows

Replace mobile's 34px-blur shadows (which violate the web rule "never combine
a 1px border with ≥16px blur") with the web three-tier scale:

| Token              | Light value                                                        | Usage                                                                                 |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `card`             | `0 1px 3px rgba(7, 9, 11, 0.08), 0 1px 2px rgba(7, 9, 11, 0.06)`   | resting cards (= web `--shadow-card`)                                                 |
| `elevated` _(new)_ | `0 4px 12px rgba(7, 9, 11, 0.10), 0 2px 6px rgba(7, 9, 11, 0.06)`  | dropdowns, toasts, CTA emphasis (= web `--shadow-elevated`; replaces mobile `accent`) |
| `panel` _(new)_    | `0 8px 24px rgba(7, 9, 11, 0.12), 0 4px 10px rgba(7, 9, 11, 0.08)` | sheets, modals (= web `--shadow-panel`)                                               |

Dark: same offsets, black at 0.45 / 0.40 / 0.50 opacity respectively. Keep
`accent` as a deprecated alias of `elevated` during migration, then remove.

## 6. Typography

| Role                              | Web                     | Mobile (new)                                                                                                                                                                                       |
| --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body / UI                         | Inter                   | **Geist** (platform equivalent — documented, not changed)                                                                                                                                          |
| Headings                          | Inter (no display font) | **Geist SemiBold/Bold** — remap `$headingMedium` → Geist-SemiBold, `$headingBold` → Geist-Bold in `tamagui.config.ts`/`design-system.ts`; drop Space Grotesk from `useFonts` to cut startup weight |
| Mono (eyebrows, labels, numerics) | JetBrains Mono          | JetBrains Mono (already synced)                                                                                                                                                                    |
| Accessibility                     | —                       | OpenDyslexic set stays (mobile-owned)                                                                                                                                                              |

Conventions adopted from web:

- Section labels: sentence case, medium weight, `mutedForeground`, normal
  tracking. **Max one uppercase-tracked treatment per screen** — the tab bar's
  `textTransform: "uppercase"` + `letterSpacing: 1` labels drop to regular
  case/weight per platform HIG.
- `TABLET_TYPOGRAPHY_BASE_SCALE` (1.3) finally consumed inside
  `ScaledText`/`ScaledParagraph`: effective scale = `fontScale × (isTablet ?
1.3 : 1)` (see UPGRADE_PLAN Stage 2).

## 7. Spacing & density (documented divergences)

| Value          | Web                 | Mobile                  | Decision                                                     |
| -------------- | ------------------- | ----------------------- | ------------------------------------------------------------ |
| Screen padding | 16/24/32 responsive | phone 15 / tablet 28–36 | **phone 15 → 16** (4pt grid); tablet values keep             |
| Section gap    | 24                  | phone 20 / tablet 28–32 | keep — denser phone rhythm is a deliberate mobile adaptation |
| Card padding   | ~24                 | 16                      | keep — touch-first density                                   |
| Button height  | ~40                 | 52–60                   | keep — 44pt+ touch minimum rules mobile                      |

## 8. Component convention parity

| Convention      | Web                                                                                        | Mobile action                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button variants | `default/outline/quiet/danger` + `isLoading`                                               | `AppButton`: **add `danger` variant** (danger fill, `#FFFFFF` text) and **`isLoading` prop** (spinner + disabled + `accessibilityState={{ busy: true }}`); existing `primary/secondary/ghost` map to `default/outline/quiet` |
| Badges          | always pill, optional status `dot`                                                         | already pill ✓; **add optional `dot` prop**; text color moves to `tone.text` (§2)                                                                                                                                            |
| Cards           | `flat / raised / panel`                                                                    | Card has `raised/flat/muted`; **add `panel`** (uses `panel` shadow); radius capped at `lg`                                                                                                                                   |
| Field           | label + description + inline error, `role="alert"` + `aria-live="polite"`                  | verify `Field` renders an error slot with `accessibilityRole`/`aria-live` parity; add if missing                                                                                                                             |
| Switch          | themed                                                                                     | replace bare RN `Switch` in `settings.tsx` with token-tinted switch (`trackColor: {false: mutedSurface, true: primary}`, `thumbColor: surface`)                                                                              |
| Empty states    | `<EmptyState>` component, never raw text                                                   | already synced ✓                                                                                                                                                                                                             |
| Focus           | `ring-2 ring-ring`                                                                         | use new `ring` token for focus-visible outlines on custom pressables                                                                                                                                                         |
| Loading text    | `…` ellipsis character                                                                     | already a mobile rule ✓                                                                                                                                                                                                      |
| Motion          | `cubic-bezier(0.16, 1, 0.3, 1)`, <300ms state / <500ms entrance, reduced-motion alternates | already documented in mobile DESIGN.md ✓ — enforce during Stage 7 polish                                                                                                                                                     |

## 9. Ownership going forward

- Web tokens (`globals.css` + `yee-frontend/DESIGN.md`) stay the light-theme
  brand authority. When they change, re-run this mapping (§1 table) — it's
  mechanical.
- Mobile `lib/design-system.ts` stays the only mobile token source;
  `yee-mobile/DESIGN.md` must be updated in the same PR as any token change
  (its radii table was already stale against code before this spec).
- The static `designSystem` export remains only for module-level constants;
  screens must use `useDesignSystem()` (lint-guarded from Stage 1).
