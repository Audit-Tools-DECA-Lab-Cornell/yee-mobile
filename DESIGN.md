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

## Data-Viz And Domain Tokens

Mirrors the web's tokenized data-viz system (`yee-frontend/globals.css`), read
through `useDesignSystem()`:

- **Domain palettes** (`designSystem.domains`) — six hues, one per YEE domain
  (access green, activity indigo, amenities ochre, experience teal, aesthetics
  rose, use violet), each with `text` / `strong` / `fill` / `light` roles, in
  both themes.

    The **single source of truth is `lib/domain-palette.json`**, committed with
    identical contents in **yee-frontend** (`src/styles/domain-palette.json`),
    where the same file generates the web's `--domain-*` CSS tokens and feeds its
    PDF/Excel exports. Never hardcode a domain colour anywhere in this app —
    `tests/unit/domain-palette.test.ts` fails if a domain hex appears outside the
    spec, if a contrast floor slips, or if the two repos' copies drift.

    Each role is tuned to its job, which is why one hue per domain is not enough:

    | Role     | Used for                             | Floor (enforced)                               |
    | -------- | ------------------------------------ | ---------------------------------------------- |
    | `text`   | labels, headings, small text         | ≥ 7:1 on the card, the app bg and its own tint |
    | `strong` | borders, dots, solid button surfaces | ≥ 4.5:1 on the same three                      |
    | `fill`   | chart bars, progress fills, meters   | ≥ 3:1 on the card (WCAG 1.4.11)                |
    | `light`  | tint backgrounds                     | the surface the two above are measured against |

    The six `fill` steps also clear categorical separation (OKLab ΔE ≥ 15 in full
    colour, ≥ 8 under protanopia/deuteranopia). Domain colour is never the only
    signal — a domain mark always sits with its name (WCAG 1.4.1).

    **Where they are consumed:** the audit wizard's domain steps (3–8) and the
    review screen's section cards get them through `useSurveyPalette()` +
    `SurveyDomainContext`; the weighting step and its review summary wrap each
    _row_ in the provider, since the step is not a domain but each row is; the
    report screen uses `designSystem.domains` directly via `components/DomainLabel`
    (all six show at once, so there is no single active domain to provide).
    Non-domain steps stay brand-green.

    In `SurveyPalette`, `accent` is the domain's `strong` step — it backs solid
    surfaces that carry light text, where `fill`'s 3:1 would be below the 4.5:1 a
    label needs. `accentFill` is the vivid `fill`, for bars nothing is written on.

- **Score bands** (`designSystem.scoreBands` + `scoreBandKey()` /
  `getScoreBandTone()`) — deep brand green high, muted gold mid, restrained clay
  low. Thresholds shared with the web: `<34` low, `<67` mid, otherwise high. Use
  for score text and progress fills anywhere a score is judged.
- **Chart series** (`designSystem.charts`) — five categorical series colors led
  by brand green, plus `grid`/`axis` scaffold colors, for report charts.

## Shape, Space, And Elevation

- `radii`: `sm 6`, `md 10`, `lg 14`, `xl 20`, `button 8`, `full 999`.
- `radii.button` is the web's `--radius-control` (8px) and covers action
  buttons, inputs, nav pills, and segmented controls. Survey option rows and
  review answer pills follow `md` (10), matching the web's option cards.
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
| `BrandLogo`                      | Theme-aware YEE logo mark (white variant on dark surfaces).                                                |
| `BrandSpinner`                   | Brand two-arc spinner (faint track + brand sweep); reduced-motion aware.                                   |
| `LoadingScreen` / `InlineLoader` | Full-screen branded loader (mark in pulsing brand ring) and small inline spinner-with-caption.             |
| `Skeleton`                       | Pulsing content-shaped loading placeholder; prefer over spinners for known-shape content.                  |
| `LoadingState`                   | Compatibility wrapper delegating to `LoadingScreen` / `InlineLoader`.                                      |
| `ErrorState`                     | Humane branded error surface with retry, escape-hatch action, and dev-only technical detail.               |
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
- Use `radii.button` for buttons, inputs, and step pills; `radii.md` for survey
  option rows; reserve `radii.full` for badges and circular indicators.
- Loading is skeleton-first: use a content-shaped `Skeleton` when the loaded
  layout is known, the branded `LoadingScreen` on route gates and heavy first
  loads, and `BrandSpinner`/`InlineLoader` only for small inline async. Never a
  bare platform spinner.
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
