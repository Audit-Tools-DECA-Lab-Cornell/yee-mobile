# YEE Mobile Design System

This is the reference for the YEE mobile app's visual language. The app follows
the YEE web app's cool near-white/green system, adapted for Expo, Tamagui,
offline field work, and phone/tablet layouts.

## Single Token Source

`lib/design-system.ts` is the canonical source for colors, fonts, radii,
spacing, shadows, and tone helpers. Screens and shared components should read it
through `useDesignSystem()` so theme changes, dyslexia-friendly fonts, and
contrast tokens stay aligned.

Use `tamagui.config.ts` only for runtime font/theme registration, and use
`lib/responsive-layout.ts` for responsive content widths, tablet breakpoints,
footer track widths, and tablet typography scaling.

## Color Tokens

| Token                 | Light value | Usage                                     |
| --------------------- | ----------- | ----------------------------------------- |
| `background`          | `#F5F7F9`   | App background                            |
| `backgroundAccent`    | `#F0F7F2`   | Secondary background washes               |
| `foreground`          | `#07090B`   | Primary text                              |
| `primary`             | `#001F10`   | Brand fills, primary actions              |
| `primaryForeground`   | `#F8F8F8`   | Text/icons on `primary`                   |
| `surface`             | `#FFFFFF`   | Cards and raised surfaces                 |
| `surfaceMuted`        | `#F1F4F6`   | Secondary buttons and muted cards         |
| `mutedSurface`        | `#EDF1F4`   | Progress tracks and inert fills           |
| `input`               | `#FBFCFE`   | Input and nested inset surfaces           |
| `border`              | `#D4D8DB`   | Hairline borders                          |
| `mutedForeground`     | `#636A6F`   | Captions and secondary labels             |
| `secondaryForeground` | `#4D5966`   | Body text on muted surfaces               |
| `ring`                | `#224C37`   | Focus/current-step indicators             |
| `success`             | `#5E9C83`   | Positive fills and borders                |
| `warning`             | `#C89A57`   | Caution fills and borders                 |
| `danger`              | `#B5483D`   | Error/destructive fills and borders       |
| `info`                | `#7B9ED9`   | Informational fills and borders           |
| `successText`         | `#35735C`   | Positive text on light/soft surfaces      |
| `warningText`         | `#8A5F16`   | Warning text on light/soft surfaces       |
| `dangerText`          | `#B2453A`   | Error text on light/soft surfaces         |
| `infoText`            | `#4969A0`   | Informational text on light/soft surfaces |
| `violetText`          | `#726395`   | Violet accent text                        |
| `primaryText`         | `#001F10`   | Brand text on light/soft surfaces         |

Each semantic fill has a `*Soft` companion for tinted surfaces. Do not use fill
tokens as text on soft backgrounds; use `tone.text` or the matching `*Text`
token.

## Typography

Fonts are loaded in `app/_layout.tsx` and registered in `tamagui.config.ts`.

- **Geist** (`bodyRegular`, `bodyMedium`, `bodySemiBold`, `bodyBold`,
  `headingMedium`, `headingBold`) is used for body, UI, and headings.
- **JetBrains Mono** (`monoMedium`, `monoBold`) is used for code-like numeric
  emphasis only.
- **OpenDyslexic** replaces the body and heading families when the readability
  setting is enabled.

Use `ScaledText` and `ScaledParagraph` from `components/ui` for text that should
respect the saved text-size preference. Tablets apply a `1.3` base multiplier on
top of the user's setting.

## Shape, Space, And Elevation

- `radii`: `sm 6`, `md 10`, `lg 14`, `xl 20`, `button 10`, `full 999`.
- Phone screen padding starts at `16`; tablet padding and content tracks come
  from `lib/responsive-layout-tokens.ts`.
- Form-like screens use `layout.formMaxWidth`; dashboard/report layouts use
  `layout.contentMaxWidth`.
- Fixed footer button rows use `getContentTrackInnerWidth()` so tablet footers
  align with the same track as the scroll content.
- `shadows`: `card` for resting cards, `elevated` for selected/primary
  emphasis, and `panel` for stronger framed panels.

## Responsive Layout

Tablets use the width intentionally instead of stretching a phone column:

- **Widths.** `formMaxWidth` (600) caps survey forms; `readableMaxWidth` (760)
  centers content-light detail screens (Execute, Reports, Settings) so they read
  as composed documents, not edge-to-edge stretches; `contentMaxWidth`
  (1040–1200) is for grid screens. Fixed footers align to their screen's track
  via `getContentTrackInnerWidth()`.
- **Home** fills `contentMaxWidth` with real grids: status cards two-up, metric
  cards four-up on wide tablets, assigned places two-up.
- **Reports** is a single centered `readableMaxWidth` column (metrics two-up,
  then the current report and list) — no sparse side rail.
- **Audit wizard** centers the survey form at `formMaxWidth` on tablet with the
  footer aligned under it via `getContentTrackInnerWidth()` on the same track.
  Phones keep the single scrolling column with horizontal step pills.
- **Audit answer options** render 2-up on tablet when every label is short
  (`shouldRenderOptionsTwoUp`, mirroring the step-pill 48% grid) so short answers
  stop eating a full-width row on the ~800dp Tab S5e; phones and long-label
  question sets stay a single full-width column, and every option row keeps a
  `formOptionHeight` floor.

`TwoPaneLayout` remains available for genuine master/detail cases, but tab
screens fill the width with grids rather than a rail that leaves voids when the
secondary content is thin.

## Component Library

Import shared primitives from `components/ui`.

| Component                        | Purpose                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AppButton`                      | Token-backed action button with `primary`, `secondary`, `ghost`, and `danger` variants plus loading state. |
| `Badge`                          | Pill status indicator driven by a `DesignTone`; optional dot indicator.                                    |
| `Card` / `SectionCard`           | Bordered surfaces with `raised`, `flat`, `muted`, and `panel` variants.                                    |
| `Field` / `FieldInput`           | Labelled form field with token-backed input frame and accessible inline error.                             |
| `EmptyState`                     | Centered empty-state surface with optional icon/action.                                                    |
| `LoadingState`                   | Centered spinner with accessible status copy.                                                              |
| `ErrorState`                     | Danger-tinted recoverable-error surface.                                                                   |
| `ScreenHeader`                   | Eyebrow/title/subtitle block with trailing slot.                                                           |
| `MetricCard`                     | Compact metric tile for grids and summaries.                                                               |
| `ListRow`                        | Tappable list row with leading/trailing slots.                                                             |
| `ProgressBar`                    | Slim clamped progress track with progressbar semantics.                                                    |
| `StatusBanner`                   | Online/offline connectivity banner with pending-sync summary.                                              |
| `ScaledText` / `ScaledParagraph` | Text primitives that compose user text size with tablet scale.                                             |
| `TwoPaneLayout`                  | Tablet support-rail shell with phone fallback.                                                             |

## Usage Rules

- Pull colors, fonts, radii, and shadows from `useDesignSystem()`.
- Do not import the static `designSystem` object from screens or components
  outside `lib/`.
- Keep interactive controls at least 44pt tall; `AppButton` defaults to the
  layout button height.
- Use `radii.button` for buttons and step pills; reserve `radii.full` for badges
  and circular indicators.
- Primary field-work actions belong near the bottom of the screen and aligned to
  the active content track.
- Use `StatusBanner` or submit-status copy for offline/sync state instead of
  re-deriving status language on each screen.
- Keep raw color literals out of screens unless a platform API requires a
  computed value that cannot be represented as a token.

## Motion

Use short state transitions under 300ms and entrance transitions under 500ms.
When motion conveys state, honor reduced-motion settings and use an exponential
ease-out curve consistent with the web app.
