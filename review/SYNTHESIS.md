# YEE Mobile — Cross-Platform UI/UX Review Synthesis

Senior-designer synthesis of the three-platform screenshot audit (iPhone, iPad,
Android Tablet). Source data: the 40 per-screen JSON reviews in `review/out/`
(iPhone: 10 screens × light+dark; iPad: 10 screens, dark only; Android Tablet:
10 screens, light only).

> **Read the addendum at the bottom first if you are implementing.** The code
> has moved since the screenshots were captured; several findings are already
> fixed. The authoritative work list is `review/UPGRADE_PLAN.md`, and the
> design-token decisions live in `review/DESIGN_SYNC.md`.

Theme-coverage asymmetry matters throughout: **iPad was captured only in dark
theme and Android Tablet only in light**, while iPhone got both.

---

## 1. Cross-Platform Consistency Score

| Platform       | Screens reviewed               | Mean score |
| -------------- | ------------------------------ | ---------- |
| iPhone         | 10 screens × light+dark (n=20) | **6.6/10** |
| iPad           | 10 screens, dark only (n=10)   | **6.0/10** |
| Android Tablet | 10 screens, light only (n=10)  | **6.7/10** |

**Equal-weighted mean: (6.6 + 6.0 + 6.7) / 3 = 6.4/10**

No platform-level gap exceeds 2 points, so on the raw numbers the three
platforms look evenly matched. But that's misleading given the theme-coverage
asymmetry:

- On iPhone (the only platform with both themes), the 5 audit-wizard/report
  screens score **6.8 avg in light vs. 4.0 avg in dark** — a 2.8-point swing,
  all traced to one bug: the wizard read a static, light-only `designSystem`
  import instead of the theme-reactive `useDesignSystem()` hook (confirmed
  `inference: false`, `confidence: high` on every instance).
- iPad was tested **only in dark** — exactly the theme that exposes this bug —
  and the same critical finding fires on 4/5 of its wizard/report screens. Its
  6.0 average is depressed by the same defect that tanks iPhone's dark screens.
- Android Tablet was tested **only in light** — the theme that never exposes
  the bug — so the identical code path was flagged only as a lower-severity
  `improvement` there, and its 6.7 average is untouched by it.

**Implication:** the platform scores aren't fully apples-to-apples. The real
consistency picture is closer to "one shared theming defect that only _some_
captures happened to expose" than "three platforms handling theming
differently."

---

## 2. Universal Critical Issues

Issues appearing on 2+ platforms with matching category + description, ranked
by evidence strength.

### A. Static `designSystem` import breaks dark theme + accessibility scaling (theming)

**Platforms:** iPhone (critical, high confidence, non-inferred — 5/5
wizard/report screens) + iPad (critical, high confidence, non-inferred — 4/5
tested screens) + Android Tablet (improvement severity, same code path,
invisible because only light was captured).

The audit wizard (`app/audit/[placeId]/[step].tsx`), the review screen
(`app/audit/[placeId]/review.tsx`), and the report screen
(`app/reports/[submissionId].tsx`) imported the module-level `designSystem`
constant (hard-wired to `lightColors`) instead of calling `useDesignSystem()`.
Derived palette helpers (`getSurveyPalette`, `getStepTone`) compounded the bug
by reading from the same static object.

**Tamagui-level fix:** replace the static import with `const designSystem =
useDesignSystem()` in each route file and pass the resolved instance into the
palette helpers. Fixes dark theme, `fontScale`, and dyslexic-font support
everywhere at once.

### B. Tablet typography base scale (1.3) defined but never applied (typography)

**Platforms:** iPad (critical + improvement, high confidence, non-inferred —
nearly every screen) + Android Tablet (critical + improvement, high confidence,
mostly non-inferred — nearly every screen).

`TABLET_TYPOGRAPHY_BASE_SCALE = 1.3` exists in
`lib/responsive-layout-tokens.ts` specifically so tablet text reads larger by
default, but `ScaledText`/`ScaledParagraph` only multiply by the user's
`fontScale` preference — the tablet multiplier is never consumed anywhere.

**Tamagui-level fix:** fold the multiplier into `scaleSize()` inside
`ScaledText`/`ScaledParagraph` itself — read the responsive layout's `isTablet`
and multiply by `TABLET_TYPOGRAPHY_BASE_SCALE` when true, composed with the
existing `fontScale` factor. One file change; every screen that routes through
these two primitives gets tablet-correct type for free.

### C. No tablet-adaptive layout — every screen is a centered single column (responsive-layout)

**Platforms:** iPad (critical, high confidence, non-inferred — Tabs Index,
audit-step-2, audit-step-3, Reports) + Android Tablet (critical, high
confidence, non-inferred — Tabs Places; improvement elsewhere).

Layout tokens for exactly this (`twoPaneGap`, `supportRailWidth`,
`homePageSupportRailWidth`) already exist in `lib/responsive-layout-tokens.ts`
but no screen branches on `layout.isTablet` to use them — reviewers repeatedly
describe the result as "a scaled-up phone layout."

**Tamagui-level fix:** a shared `<TwoPaneLayout rail={...} detail={...}>`
wrapper that internally branches `XStack` (tablet) vs. stacked `YStack` (phone)
using the existing tokens, so each screen opts in with one wrapper instead of
hand-rolling the branch.

### D. Form content defaults to `contentMaxWidth` instead of `formMaxWidth` (responsive-layout)

**Platforms:** iPad (critical, high confidence, non-inferred — audit-step-1) +
Android Tablet (improvement, high confidence, non-inferred — audit-step-2,
Settings).

`getResponsiveContentContainerStyle` falls back to `contentMaxWidth`
(1040–1200px) when no `maxWidth` is passed, even on single-column form screens
where `formMaxWidth` (600px) is the intended token — producing short answer
options stretched almost edge-to-edge.

**Tamagui-level fix:** pass `maxWidth: layout.formMaxWidth` at the call sites
in `[step].tsx` and `settings.tsx`. The option already exists on the shared
helper; this is a prop change, not new plumbing.

### E. Fixed footer/CTA bar doesn't align with the centered content track (responsive-layout / safe-area)

**Platforms:** iPad (critical, high confidence, non-inferred —
audit-placeId-review, Tabs Execute) + Android Tablet (improvement, high
confidence, non-inferred — same screens).

Scroll content centers via `getResponsiveContentContainerStyle`'s adaptive
gutters, but footers/CTA bars position with raw
`layout.screenPaddingHorizontal`, so on wide tablets the buttons span
edge-to-edge while the cards above sit in a narrower centered track.

**Tamagui-level fix:** wrap the footer's inner row in the same
centered-max-width style the scroll content uses (shared
`getContentTrackInnerWidth` helper consumed by both call sites).

_Lower-confidence universal note:_ iPhone Settings and iPad Settings both flag
the theme toggle using the bare React Native `Switch` instead of a themed
primitive — real, but only `low` confidence on both platforms; treat as polish.

---

## 3. Top 3 Highest-Impact Fixes (as reviewed)

| #   | Fix                                                                                                         | Why it matters                                                                                                                                                                                      | Effort |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Swap static `designSystem` → `useDesignSystem()` in the audit wizard, review, and reports screens (Issue A) | Broke dark mode entirely across the core audit flow on iPhone and iPad, plus disabled `fontScale`/dyslexic-font support. Highest severity, most-repeated finding, all high-confidence/non-inferred. | **S**  |
| 2   | Fold `TABLET_TYPOGRAPHY_BASE_SCALE` into `ScaledText`/`ScaledParagraph` (Issue B)                           | Single-file change that corrects undersized type on nearly every iPad + Android Tablet screen — the single most-repeated finding in the audit.                                                      | **S**  |
| 3   | Pass `maxWidth: layout.formMaxWidth` on form-shaped screens (Issue D)                                       | Fixes the "500px-wide button on a 1000px track" readability problem on both tablet platforms' forms.                                                                                                | **S**  |

---

## 4. Platform-Specific Gaps

- **Android Tablet — broken header title (unique bug).** `audit-step-2`,
  `audit-step-3`, and `reports-submissionId` showed the _raw route pattern_
  (`"audit/[placeId]"`, `"reports/[submissionId]"`) in the native header
  (critical, high confidence, non-inferred on all 3). iPhone and iPad showed
  correct titles — a genuine Android-only navigation regression.
- **Android Tablet — bottom tab bar instead of a Material nav rail.** 5
  instances (medium confidence): Material large-screen guidance favors a side
  nav rail; iPhone/iPad correctly keep bottom tabs, so this divergence is
  Android-specific by design intent.
- **Android Tablet — iOS-style chevron back button on Settings** (low
  confidence): iOS-convention chevron instead of the Android arrow-back glyph
  already available in `components/icons.tsx`.
- **iPhone — step-pill navigator drops below the 44pt tap-target minimum**
  (critical, high confidence, non-inferred, audit-step-2): three-per-row pills
  at `py="$2"` land at ~30–34pt height on iPhone width. One component failing
  differently per platform (Android gets untargetable wrapping; iPad gets a
  "should be a rail" note) rather than one platform handling it well.
- **Caveat, not a confirmed gap:** iPhone is the only platform with 3 unique
  color-contrast criticals (amber "NOT STARTED" badge, dark-mode "Open report"
  button, light-mode success-green metric text) — very likely an artifact of
  iPhone being the only platform captured in both themes. Don't read this as
  "iPad and Android solved contrast better."

---

## 5. Tamagui Architecture Recommendations

1. **Make `useDesignSystem()` the only theme entry point.** Deprecate direct
   imports of the static `designSystem` export (or add a lint rule banning it
   outside the hook's own module).
2. **Push `TABLET_TYPOGRAPHY_BASE_SCALE` into the `ScaledText`/
   `ScaledParagraph` primitives** rather than leaving it as a constant screens
   must remember to apply.
3. **Ship shared responsive layout components**, not just tokens: a
   `<TwoPaneLayout>` (rail + detail, branches on `layout.isTablet`) and a
   centered form track at `formMaxWidth`, so screens opt into tablet adaptation
   declaratively.
4. **Give footers/CTA bars the same centering helper as scroll content**
   (`getContentTrackInnerWidth` consumed by both call sites), closing Issue E
   as a class of bug.
5. **Consolidate hand-rolled Card/Badge/ProgressBar/Button/Switch usage onto
   `components/ui/*`.** Multiple findings across all three platforms note
   `design_system_components_used: (none)` on exactly the screens carrying the
   theme and font-scale bugs.

---

| Platform       | Score      | Top Issue                                                                                                                                |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone         | 6.6/10     | Static `designSystem` import broke dark theme + fontScale across the audit-wizard/report flow.                                           |
| iPad           | 6.0/10     | Same theme-import bug, compounded by unapplied tablet typography scale and single-column-only layouts.                                   |
| Android Tablet | 6.7/10     | Tablet typography scale unused on nearly every screen; 3 screens also showed raw-route-path header titles.                               |
| **Overall**    | **6.4/10** | A handful of shared root causes (static theme import, unscaled `ScaledText`, uncentered form/footer tracks) account for most of the gap. |

---

## Code verification addendum — 2026-07-02

Every finding above was re-verified against the current working tree before the
upgrade plan was written. Status:

| Finding                         | Status in current code           | Evidence                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Static `designSystem` import | **FIXED**                        | `[step].tsx`, `review.tsx`, `submitted.tsx`, `reports/[submissionId].tsx`, `settings.tsx`, and `app/_layout.tsx` all call `useDesignSystem()`. The remaining `designSystem` identifiers in `settings.tsx` are props typed from the hook's return. Guardrail (lint rule) still missing → Stage 1.                    |
| B. Tablet type scale unapplied  | **OPEN**                         | `TABLET_TYPOGRAPHY_BASE_SCALE` is defined and re-exported but has zero consumers; `components/ui/ScaledText.tsx` multiplies only by `fontScale`. → Stage 2.                                                                                                                                                         |
| C. No two-pane tablet layouts   | **OPEN**                         | `twoPaneGap` / `supportRailWidth` / `homePageSupportRailWidth` have zero consumers; only the tab bar branches on `isTablet`. → Stages 5–6.                                                                                                                                                                          |
| D. `formMaxWidth` not passed    | **MOSTLY OPEN**                  | Only `submitted.tsx:76` passes it; `[step].tsx`, `settings.tsx`, `review.tsx` still default to `contentMaxWidth`. → Stage 4.                                                                                                                                                                                        |
| E. Footer vs content track      | **OPEN (helper landed, unused)** | `getContentTrackInnerWidth` exists in `lib/responsive-layout.ts` but has zero consumers; `review.tsx:801` and `execute.tsx:180-181` still use raw `screenPaddingHorizontal` on absolute-positioned bars. → Stage 4.                                                                                                 |
| Android raw-route header titles | **FIXED (baseline)**             | `app/audit/[placeId]/_layout.tsx` sets `title: "Audit"`; `reports/[submissionId]` sets `title: "Report"`. Contextual titles (place name, step) remain as polish. → Stage 7.                                                                                                                                         |
| iPhone step-pill tap targets    | **OPEN**                         | Step pills in `[step].tsx` (~line 704) still `py="$2"` with no `minHeight`. → Stage 4.                                                                                                                                                                                                                              |
| Bare RN `Switch` in Settings    | **CONFIRMED**                    | `app/settings.tsx:2` imports `Switch` from `react-native`, used untinted at line ~241. → Stage 3.                                                                                                                                                                                                                   |
| Contrast criticals              | **CONFIRMED & MEASURED**         | Light theme: `warning` on `warningSoft` = **2.12:1**, `success` as text on background = **3.07:1**, `info` on `infoSoft` = **2.27:1**, `danger` on `dangerSoft` = **4.43:1** — all below AA 4.5:1. Dark theme passes everywhere (5.27–8.62:1). Fix via derived `*Text` tones in `review/DESIGN_SYNC.md`. → Stage 1. |

**Revised top-3** (old #1 is done): ① tablet type scale into `ScaledText`
(Issue B, S), ② AA text tones + web token sync (contrast criticals, S), ③
`formMaxWidth` + footer track alignment (Issues D+E, S/M).
