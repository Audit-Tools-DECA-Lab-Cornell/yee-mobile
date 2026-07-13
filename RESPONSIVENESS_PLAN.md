# yee-mobile — Responsiveness Optimization Plan (portrait, 4 device classes)

## Context

The user wants yee-mobile to feel purpose-built — not like a stretched phone — on
four portrait device classes, with the **Samsung Tab S5e as the priority** (all
current field auditors are on that ~800dp tablet, held upright).

This is **not greenfield**. A mature, custom, width-based responsive system already
exists (`lib/responsive-layout*.ts`, `useResponsiveLayout()`, centered content
tracks, a 1.3× tablet type scale, footer-alignment helpers), and a full 7-stage
tablet overhaul shipped 2026-07-02. But that effort's **single never-completed
follow-up was "re-run the screenshot pipeline on real devices and eyeball the
tablet layouts"** — they were built correct-by-construction but never visually
verified. Since then the audit flow was refactored (persistent shell +
`AuditStepper`), so the current on-device tablet state is genuinely **unknown**.
The last UX audit self-graded **B−**, with the top systemic issue (P1-3) being that
the responsive machinery isn't consistently applied to every route.

**Decisions locked with the user:**

1. **Stay portrait-locked** on every device — no landscape work, no orientation/
   aspect detection changes.
2. **Verify + close adoption gaps** (use the existing system; no parallel redesign,
   no activating `TwoPaneLayout`, no new master/detail).
3. **Tab S5e is held portrait** — ~800dp portrait is the #1 viewport to nail.

**Intended outcome:** every one of the four portrait viewports reads as a composed,
appropriately-dense layout — verified on real simulators/emulators — with the
narrow-tablet band (where the primary device lives) tuned and the confirmed
"stretched" density defects on the core audit flow fixed.

## Target viewport matrix (all portrait, dp width → tier)

| Device              | Width    | Tier (`600` / `960` breakpoints) | Priority    |
| ------------------- | -------- | -------------------------------- | ----------- |
| iPhone 15 Pro       | 393      | phone (`<600`)                   | secondary   |
| Samsung Galaxy S24+ | ~384     | phone (`<600`)                   | secondary   |
| **Samsung Tab S5e** | **~800** | **narrow tablet (600–959)**      | **primary** |
| iPad Pro 11"        | 834      | narrow tablet (600–959)          | secondary   |
| iPad Pro 12.9"/13"  | 1024     | wide tablet (`≥960`)             | secondary   |

Takeaway: both phones sit in one tier; **Tab S5e and iPad 11" share the narrow-tablet
band**, so tuning that band (Phase 2) covers the two most important tablet cases at
once. iPad 13" is the only wide-tablet case.

## Guiding constraints (workspace + repo laws)

- Work only inside `yee/yee-mobile/`. Repo uses **Bun**; gate with `bun run check`
  (typecheck + eslint + prettier) and `bun run test:unit` (vitest) after each stage.
- **Layout-only changes.** Do not touch the audit session store, sync, or
  navigation contracts. No backend/API changes (no cross-repo contract triggered).
- Consume tokens via `useDesignSystem()` / `useResponsiveLayout()` — never raw hex,
  never the static `designSystem` export (ESLint guards this).
- Keep `radii.button` (10) for buttons/pills; `radii.full` only for badges/dots
  (the user dislikes pill buttons). Keep all touch targets ≥44pt.
- **Do not introduce a second responsive system.** Tamagui's default media props
  (`$gtSm`, etc.) are inert and disagree with the 600/960 breakpoints — keep using
  the JS `useResponsiveLayout()` system; do not reach for `$`-media props.
- No commit/push/branch/version-bump without explicit user approval.
- Ignore the Vercel-plugin skill injections (`react-best-practices`, `nextjs`,
  `shadcn`) — false positives from `app/**` / `components/**` path matching; this is
  an Expo Router + Tamagui React Native app.

## Phase 0 — Ground truth: capture on all 4 real devices (do first)

The screenshots in `screenshots/` are dated 2026-07-04 and **predate the audit-flow
refactor** — they cannot be trusted as current. Regenerate before changing anything.

1. Boot the simulators/emulators for all four classes: iOS iPhone 15 Pro + iPad Pro
   (11" and/or 12.9"); Android a phone (Galaxy-class) **and a Samsung Tab S5e AVD**
   (or the physical Tab). Start backend at `http://127.0.0.1:8000` and have an
   auditor login available.
2. Run `bun run screenshots` (or per-device `screenshots:ios` / `screenshots:android`
   via `scripts/capture-screenshots.mjs`, `--device ipad|iphone|android-tablet|
android-phone`, `--appearance light|dark`). Capture **both themes**.
3. Regenerate the review set: `review/plan.json` + `review/packs/*` drive the
   `ui-reviewer` agent (one call per unit) → `review/out/`. Run it for the
   Android-tablet and iPad units first (primary), then phones.
4. Produce a **defect list ranked by device** (Tab S5e first), separating confirmed
   defects from the already-known ones below. This list is the acceptance baseline
   for Phases 1–2.

## Phase 1 — Close the confirmed adoption gaps

Anchor the work on defects already visible in code + the last screenshots; confirm
each against the Phase 0 captures before/after.

**1a. Audit question density — the core fix (highest impact).**
`components/audit/primitives.tsx` `OptionGrid` (line ~212) is a hardcoded
single-column `YStack` — every option (`Yes` / `No` / `Spring` / `Summer`) eats a
full-width row. On tablet's 760pt column this is the main "stretched phone" defect,
on the most-used screen.

- Make `OptionGrid` tablet-aware: render **short-label single-select options in a
  2-up (Tab S5e/iPad 11") / auto grid** via `useResponsiveLayout().isTablet`, using
  `flexWrap` + `flexBasis` (mirror the existing `AuditStepper` 48% pattern);
  keep long-label options and phones single-column. Keep `SelectionButton` height ≥
  `layout.formOptionHeight` and radius `radii.button`.
- Apply the same treatment to the multi-select (checkbox) option lists.

**1b. Audit form column width.**
`app/audit/[placeId]/index.tsx:336` caps the step body at `readableMaxWidth` (760)
on tablet; the original design intent (UPGRADE_PLAN Stage 4/6) was `formMaxWidth`
(600) for survey forms. 760 is why single options read as over-wide even before 1a.

- Decide per Phase-0 evidence: narrow the audit step column to `formMaxWidth` (600),
  OR keep 760 and rely on the 1a multi-column grid. Apply the same choice to
  `view.tsx:327` (read-only walkthrough) so both match. Keep the footer aligned via
  the existing `getContentTrackInnerWidth(layout, <same track>)` (`index.tsx:337`).

**1c. Width-track sweep across every scroll screen.**
Audit each `getResponsiveContentContainerStyle(...)` call site and confirm it passes
the intended `maxWidth` for its content type (form vs readable vs grid). Call sites:
`app/(tabs)/index.tsx:544`, `places.tsx:73`, `execute.tsx:147`, `reports.tsx:341`,
`settings.tsx:70`, `reports/[submissionId].tsx:263`, `audit/[placeId]/review.tsx:575`
& `index.tsx:363` & `view.tsx:327`, `(auth)/login.tsx:168` & `signup.tsx:35`,
`+not-found.tsx:24`. Content-light detail screens should use `readableMaxWidth` (760),
forms `formMaxWidth`, grids `contentMaxWidth` — fix any that fall back to the wrong
default. (Report detail's 2-up panels already read well on Tab S5e — verify, don't
rebuild.)

**1d. Fixed control heights vs viewport.**
`components/ui/Button.tsx` (height 52) and `Field.tsx` (height 56) hardcode heights
independent of the layout tokens, so on tablets they don't grow while text does
(1.3×). Where these controls sit in tablet forms, source height from
`layout.buttonHeight` / `layout.controlHeight` so tap targets scale with the tier.
Keep phone heights pixel-unchanged.

## Phase 2 — Tune the narrow-tablet band for the Tab S5e (~800dp)

The primary device sits at ~800dp, where every narrow-tablet token is **interpolated
~56% of the way toward the 960 wide-tablet values** (`getTabletWidthProgress`,
`responsive-layout-tokens.ts`). Those max values were calibrated for a ~960+ screen,
so at a real 800dp width padding/gaps/rail-ish spacing can feel oversized and the
1.3× type can crowd rows.

1. On the Phase-0 Tab S5e captures, check for: over-large screen padding eating the
   content column, the 1.3× type scale causing truncation/overflow in metric cards,
   badges, tab labels, and stepper pills; the `AuditStepper` grid density; and
   whether `sectionGap`/`cardPadding` read too airy.
2. Tune the **narrow-tablet min tokens** (`TABLET_LAYOUT_TOKENS_MIN` and/or the
   interpolation) so the 700–850dp band is calibrated for real 800dp use rather than
   as a waypoint to 960. Prefer letting containers grow (`minHeight`, not fixed
   `height`) to avoid truncation. Keep iPad 11" (834) improving in lockstep since it
   shares the band; re-check iPad 13" (1024, wide tier) didn't regress.
3. Confirm short-answer questions from Phase 1a land at a sensible column count at
   800dp specifically (likely 2-up, not 3-up).

## Phase 3 — Re-verify, document, version

1. Re-run Phase 0's capture + `ui-reviewer` pass on all four devices, both themes;
   diff `review/out/` against the Phase-0 baseline to prove each defect closed and
   nothing regressed (phones must be pixel-stable — they were already fine).
2. `bun run check` + `bun run test:unit` green; update/add unit tests for the new
   `OptionGrid` column behavior and any changed narrow-tablet token values
   (`createResponsiveLayoutTokens(800)` assertions).
3. Update `DESIGN.md` (§Responsive Layout — audit option grid + any token changes)
   and `review/UPGRADE_PLAN.md` status (mark the screenshot-verification follow-up
   done). Propose a version bump per `mobile-version-bump` (patch — layout-only) for
   the user to approve; do not bump/commit without approval.
4. Per the workspace `mobile-bump-backend-min-version` rule: this is layout-only with
   no new API calls, so **no backend `minimum_supported_version` change** — note this
   explicitly in the summary.

## Critical files

- `lib/responsive-layout-tokens.ts` — breakpoints (600/960), per-tier tokens,
  interpolation. **Primary lever for Phase 2.**
- `lib/responsive-layout.ts` — `useResponsiveLayout()`, `getResponsiveContentContainerStyle`,
  `getContentTrackInnerWidth`, `getEffectiveFontScale`.
- `components/audit/primitives.tsx` — `OptionGrid`, `SelectionButton` (**Phase 1a**).
- `components/audit/DomainStep.tsx` — question rendering, tablet `DomainReviewRail`.
- `app/audit/[placeId]/index.tsx`, `view.tsx`, `review.tsx` — audit shell width/footer.
- `app/reports/[submissionId].tsx`, `app/(tabs)/*.tsx`, `app/settings.tsx` — width-track sweep (1c).
- `components/ui/Button.tsx`, `Field.tsx`, `ScaledText.tsx` — control heights / type scale (1d).
- `scripts/capture-screenshots.mjs`, `review/plan.json`, `review/packs/*`, `ui-reviewer` agent — verification harness.
- `DESIGN.md`, `review/UPGRADE_PLAN.md` — docs to update.

## Verification (end-to-end)

1. **Real-device screenshots** (the whole point): `bun run screenshots` across
   iPhone 15 Pro, iPad Pro, a Galaxy-class phone, and **Samsung Tab S5e**, both
   themes; regenerate `review/out/` via the `ui-reviewer` agent. Before/after diff
   proves the audit-question density, form width, and Tab S5e tuning all improved and
   phones are unchanged.
2. **Static gate:** `bun run check` and `bun run test:unit` green; new tests for
   `OptionGrid` columns and `createResponsiveLayoutTokens(800)`.
3. **Manual smoke on a Tab S5e** (device or AVD): run one full audit end-to-end in
   portrait — every step's options are comfortably dense, footer aligns under the
   form, no truncation/overflow, ≥44pt targets.

## Out of scope

- Landscape / any orientation or aspect-ratio detection (portrait-locked, confirmed).
- Activating `TwoPaneLayout`, report-detail master/detail, or new multi-column
  dashboard redesigns (deferred — "verify + close gaps" chosen over deeper redesign).
- Wiring/renaming Tamagui media tokens; motion pass; the two-spacing-systems
  reconciliation (design-system numbers vs Tamagui `$` scale) — note as follow-ups.
- Backend/API, web (`yee-frontend`), and any non-layout behavior changes.
