# YEE Mobile Design System

This document is the reference for the YEE mobile app's visual language. It mirrors
the YEE frontend's green/cream identity, adapted to Expo + Tamagui and the
offline-first field-work constraint.

## Single token source

`lib/design-system.ts` is the **single source of design tokens** for the app.
Every screen and component consumes its `designSystem` object rather than raw hex
values or ad-hoc palettes. The previously competing systems have been reconciled:

- **`lib/design-system.ts` (canonical)** — colors, fonts, radii, spacing, shadows,
  and the tone helpers (`getMetricTone`, `getPlaceStatusTone`, `getPreAuditTone`).
- **`themes.ts` / `tamagui.config.ts`** — provide the Tamagui runtime theme and the
  loaded font families. `components/Provider.tsx` mounts the **light** theme to match
  what the screens actually render (the prior `defaultTheme="dark"` mismatch is fixed).
- **Per-step wizard palettes** — being migrated onto the shared tone helpers so domain
  color is expressed as a border/accent on option cards, not a solid fill.

When you need a color, font, radius, or shadow, import it from `lib/design-system`.
Do not introduce new raw hex values in screens or components.

## Tokens

### Color

| Token                 | Value     | Usage                                          |
| --------------------- | --------- | ---------------------------------------------- |
| `background`          | `#FBFAF6` | App background (cream)                         |
| `backgroundAccent`    | `#F6F3EC` | Secondary background washes                    |
| `foreground`          | `#0F1720` | Primary text                                   |
| `primary`             | `#10231F` | YEE green — primary actions, brand             |
| `primaryForeground`   | `#FFFFFF` | Text/icons on `primary`                        |
| `surface`             | `#FFFFFF` | Card surfaces                                  |
| `surfaceMuted`        | `#F8F4EE` | Secondary buttons, subtle chips                |
| `mutedSurface`        | `#F0EBE2` | Progress track, inert fills                    |
| `input`               | `#FBFCFE` | Input fields, nested inset surfaces            |
| `border`              | `#DDD6CB` | Hairline borders                               |
| `mutedForeground`     | `#6B706F` | Secondary/caption text                         |
| `secondaryForeground` | `#4D5966` | Body text on muted surfaces                    |
| `success`             | `#5E9C83` | Positive status (online, submitted, completed) |
| `warning`             | `#C89A57` | Caution status (offline, pending, not started) |
| `danger`              | `#B5483D` | Errors, destructive states                     |
| `info`                | `#7B9ED9` | Informational accents                          |

Each semantic color has a `*Soft` companion (e.g. `successSoft`) for tinted badge and
banner surfaces. Decorative accents (`mint`, `sky`, `amber`, `rose`, `violet`) and their
soft variants back the domain tones used by the dashboard and wizard.

### Typography

Fonts are loaded in `app/_layout.tsx` and registered in `tamagui.config.ts`:

- **Geist** (`bodyRegular` / `bodyMedium` / `bodySemiBold` / `bodyBold`) — body and UI text.
- **Space Grotesk** (`headingMedium` / `headingBold`) — display headings.
- **JetBrains Mono** (`monoMedium` / `monoBold`) — eyebrows, labels, numeric emphasis.

Reference families through `designSystem.fonts.*`. Prefer Tamagui `$font` sizing tokens
for any text that should scale with the device's accessibility text size.

### Radii, spacing, shadows

- `radii`: `sm 8`, `md 12`, `lg 16`, `xl 20`, `full 999`.
- `spacing`: `screenPaddingHorizontal 15`, `screenPaddingVertical 16`.
- `shadows`: `card` (resting elevation) and `accent` (primary CTA elevation).

### Tones

A `DesignTone` is `{ accent, surface, text }`. Use the helpers instead of hand-picking
colors per status:

- `getMetricTone(tone)` — dashboard metric accents.
- `getPlaceStatusTone(status)` — place workflow status badges.
- `getPreAuditTone(status)` — pre-audit readiness.

## Component library (`components/ui/`)

Import shared primitives from `components/ui` instead of re-declaring inline cards,
buttons, and badges. All consume `designSystem` tokens.

| Component              | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `Card` / `SectionCard` | Bordered surface (`raised` \| `flat` \| `muted`).               |
| `AppButton`            | Action button (`primary` \| `secondary` \| `ghost`), 52pt tall. |
| `Badge`                | Pill status indicator driven by a `DesignTone`.                 |
| `Field` / `FieldInput` | Labelled form field and bordered input frame.                   |
| `EmptyState`           | Centered empty-state card with optional icon and action.        |
| `LoadingState`         | Centered spinner with an accessible status region.              |
| `ErrorState`           | Danger-tinted recoverable-error surface.                        |
| `ScreenHeader`         | Title block with eyebrow, subtitle, and trailing slot.          |
| `MetricCard`           | Compact metric tile for grids and summaries.                    |
| `ListRow`              | Tappable list row with leading/trailing slots.                  |
| `ProgressBar`          | Slim, clamped progress track with progressbar semantics.        |
| `StatusBanner`         | Online/offline connectivity banner with pending-sync summary.   |

## Usage rules

- **Tokens only.** No raw hex in screens; pull from `designSystem`. For computed/variable
  colors, apply them via the `style` prop (e.g. `style={{ color: tone.text }}`), matching
  Tamagui's typed color-token constraint.
- **Safe areas.** Wrap screen roots with `useSafeAreaInsets()` padding; form screens use
  `KeyboardAvoidingView`.
- **Touch targets.** Interactive elements are at least 44pt; `AppButton` defaults to 52pt.
  Use `hitSlop` when a control is visually smaller.
- **Thumb zones.** Primary actions (Start/Resume audit, Submit) sit in the bottom third of
  the screen.
- **Accessibility.** Provide `accessibilityRole`/labels on status and async regions; use
  `aria-live` on connectivity and error surfaces; prefer the ellipsis character `…`.
- **Offline-first.** Drafts stay local and secure until final submission. Surface
  connectivity and pending-sync state with `StatusBanner` rather than re-deriving copy.

## Motion

Match the frontend: exponential ease-out, under 300ms for state changes and 500ms for
entrance transitions, with reduced-motion alternatives where animation conveys meaning.
