# UPGRADE_PLAN — yee-mobile UI/UX overhaul

Staged implementation plan for the cross-platform review
(`review/SYNTHESIS.md`) and the web↔mobile design-system sync
(`review/DESIGN_SYNC.md`). Written 2026-07-02, verified against the working
tree that day — every stage below targets a finding confirmed still open in
current code.

**Goal:** one visual language across yee-frontend and yee-mobile, AA contrast
everywhere, and tablet layouts that use the width they're given.

**Acceptance (overall):**

- Mobile light theme uses the web-derived tokens from DESIGN_SYNC §1–§5; all
  tone text pairs ≥ 4.5:1 (verified values in DESIGN_SYNC §2).
- Tablet text renders at the 1.3 base scale; form screens cap at
  `formMaxWidth`; fixed footers align with the content track.
- Tabs Home/Reports and the audit wizard use tablet two-pane layouts.
- `bun run check` and `bun run test:unit` pass after every stage.

## How to run a stage (session protocol)

1. Read this file top to bottom, then `review/DESIGN_SYNC.md`. Skim
   `review/SYNTHESIS.md`'s addendum for context. Pick the **first stage whose
   status is `pending`** unless told otherwise — stages are ordered by
   dependency and one stage is one session.
2. Work only inside `yee/yee-mobile/` (plus this file). Repo uses **Bun 1.3.9**:
   `bun install`, then verify with `bun run check` (typecheck + eslint +
   prettier) and `bun run test:unit`. Update unit tests you break; do not skip
   them.
3. Screens must consume tokens via `useDesignSystem()` — never raw hex, never
   the static `designSystem` export (module-level constants excepted).
4. When the stage is done: update the status table below (status + date +
   one-line note), bump the app version per the stage's note using
   `bun run version:patch` / `version:minor` (pre-1.0 scheme), and update
   `DESIGN.md` if the stage changed anything it documents.
5. Git: follow workspace law — no commit/push/branch without explicit user
   approval in your session.

## Status

| Stage | Title                                         | Effort | Status                                                                                                                                             |
| ----- | --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Token sync + AA text tones                    | S/M    | done 2026-07-02 — web-derived light palette, `*Text` tones, radii/shadows, ESLint static-import guardrail                                          |
| 2     | Typography roles + tablet type scale          | S      | done 2026-07-02 — `getEffectiveFontScale` in `Scaled*`, Geist headings, Space Grotesk removed, tab labels de-uppercased                            |
| 3     | Component API parity                          | M      | done 2026-07-02 — `danger`/`isLoading` button, badge `dot`, `panel` card, accessible field error, tinted settings switches                         |
| 4     | Width discipline: forms, footers, tap targets | M      | done 2026-07-02 — form tracks capped, fixed footers aligned to content track (wizard/review/execute/report), 44pt step pills                       |
| 5     | TwoPaneLayout + dashboard/reports rails       | L      | done 2026-07-02 — `TwoPaneLayout` shipped; Home support rail + Reports summary rail adopt it on tablets                                            |
| 6     | Audit wizard tablet rail                      | L      | done 2026-07-02 — tablet step rail with completion state + `ring` indicator (`getCompletedSteps`), form capped in main, review grid 2-up           |
| 7     | Polish, headers, motion, docs sync            | M      | done 2026-07-02 — contextual in-screen headers verified, dark straggler sweep, DESIGN/README synced; motion + screenshot re-review noted follow-up |

## Post-review tablet + polish fix pass (2026-07-02, v0.2.1)

Screenshot review of the shipped overhaul found the tablet layouts read like
enlarged phones (sparse rails leaving empty voids; wizard step rail scrolled
away and stranded the footer on one side; Settings capped too narrow) plus
several component nits. Fixed:

- **New `readableMaxWidth` token (760)** — content-light detail screens center at
  a comfortable width instead of stretching or being cramped.
- **Home** — dropped the rail; status cards two-up, metrics four-up (wide
  tablet), assigned places two-up. Fills the width with real content.
- **Reports** — dropped the split; single centered `readableMaxWidth` column.
- **Execute / Settings** — centered at `readableMaxWidth`; Settings no longer a
  tiny island; footer aligned to the same track.
- **Audit wizard** — replaced the scroll-away rail with a **persistent left step
  sidebar**; form centered at `formMaxWidth`; footer aligned under the form.
- **Secondary button** — was invisible on the near-white bg; now a white surface
  with a resting card shadow.
- Fixed the wrong crossed-cloud icon on "Report available"; report-detail comment
  cards to equal fixed-width columns with a min height; review answer-pill radius
  to `radii.button` (matches question options); consistent `sectionGap` spacing;
  screen titles normalized to 30.

**Remaining follow-ups (need a local session with simulators):**

- Re-run the screenshot pipeline (`bun run screenshots`) covering **both themes on
  all three platforms**, regenerate `review/out/`, and eyeball the tablet
  layouts above — they were built correct-by-construction (verified geometry +
  typecheck/lint/tests) but not yet re-screenshotted.
- Consider collapsible report-detail comment cards (only the equal-width fix
  landed; the user floated collapsibles as a nicer treatment for empty ones).
- Motion pass: the app currently ships no entrance/state animations. If motion
  is added, follow the web curve (`Easing.out(Easing.exp)`, ≤300ms state /
  ≤500ms entrance) and honor `useReducedMotion` — see DESIGN.md §Motion.

---

## Stage 1 — Token sync + AA text tones (version: **minor** bump)

The single-file, highest-leverage stage. Everything else inherits from it.

**Files:** `lib/design-system.ts`, `DESIGN.md`, `eslint.config.js`, and any
unit tests referencing token values.

1. Apply DESIGN_SYNC §1 to `lightColors` (new background/foreground/primary/
   border/etc. values; add `ring`), §3 to `darkColors` (add `ring` only), §2 to
   both (add `successText`, `warningText`, `dangerText`, `infoText`,
   `violetText`, `primaryText`). Keep `ColorTokens` shape parity via the
   existing `satisfies`.
2. Update the tone helpers (`getMetricTone`, `getPlaceStatusTone`,
   `getPreAuditTone`) so `text` returns the matching `*Text` token while
   `accent`/`surface` are unchanged. Find and update any local tone helpers in
   screens (`getStepTone`, `getSurveyPalette` in the wizard) the same way.
   Then grep for places that use `tone.accent` _as a text color_ and switch
   them to `tone.text`.
3. Apply DESIGN_SYNC §4 radii (`sm 6, md 10, lg 14, xl 20`; `button`/`full`
   unchanged) and §5 shadows (`card`/`elevated`/`panel`; migrate `accent`
   shadow consumers to `elevated`, keep a deprecated alias if consumers are
   many). `spacing.screenPaddingHorizontal` 15 → 16 (phone token in
   `lib/responsive-layout-tokens.ts` too — keep the two files agreeing).
4. Guardrail: add an ESLint `no-restricted-imports` (or
   `no-restricted-syntax`) rule forbidding `import { designSystem }` from
   `lib/design-system` outside `lib/` — the review's root-cause bug must not
   come back.
5. Update `DESIGN.md`: token tables (its radii row was already stale), the
   `*Text` tone rule ("accents are fills; `tone.text` is for type"), the new
   shadow tiers, and the note that light theme derives from
   `yee-frontend/globals.css`.

**Accept when:** `bun run check` + `bun run test:unit` pass; grepping
`app components` for `#FBFAF6|#F6F3EC|#DDD6CB|#F8F4EE|#F0EBE2` returns nothing;
no screen imports the static `designSystem`.

## Stage 2 — Typography roles + tablet type scale (version: patch)

**Files:** `components/ui/ScaledText.tsx`, `tamagui.config.ts`,
`lib/design-system.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `DESIGN.md`.

1. `ScaledText`/`ScaledParagraph`: compose the tablet base scale —
   `useWindowDimensions()` → `createResponsiveLayout(width).isTablet`;
   effective scale = `fontScale * (isTablet ? TABLET_TYPOGRAPHY_BASE_SCALE : 1)`.
   Scale both `fontSize` and `lineHeight` (numeric values only, as today).
   This closes the most-repeated finding in the whole audit (SYNTHESIS Issue B)
   on every screen at once. Watch for screens that hand-compute sizes without
   `Scaled*` — grep `fontSize={` in `app/` for raw `Text` usages and migrate
   stragglers.
2. Heading unification (DESIGN_SYNC §6): map `$headingMedium` →
   Geist-SemiBold and `$headingBold` → Geist-Bold; remove the SpaceGrotesk
   entries from `useFonts` in `app/_layout.tsx` and the font declarations in
   `tamagui.config.ts`. Keep OpenDyslexic mappings intact.
3. Tab bar labels (`app/(tabs)/_layout.tsx`): drop `textTransform:
"uppercase"` and `letterSpacing: 1`; use `bodyMedium`/`bodySemiBold` at the
   existing sizes.

**Accept when:** checks pass; on a 1024pt-wide viewport
(`createResponsiveLayout(1024)`) a `ScaledText fontSize={16}` renders 21px
(unit-test this in `tests/`); no `SpaceGrotesk` reference remains.

## Stage 3 — Component API parity (version: patch)

**Files:** `components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Field.tsx`,
`app/settings.tsx`, `DESIGN.md`.

1. `AppButton`: add `danger` variant (fill `colors.danger`, text `#FFFFFF`,
   border `colors.danger`) and `isLoading` prop — spinner replaces the leading
   icon, button disabled, `accessibilityState={{ busy: true, disabled: true }}`,
   label keeps layout width (no jump). Mirror the web's usage rule: `danger`
   only behind a confirm step.
2. `Badge`: optional `dot` prop (small `tone.accent` circle before the label);
   confirm label color is `tone.text`.
3. `Card`: add `panel` variant using the `panel` shadow; enforce radius cap
   `lg` (14).
4. `Field`: verify inline-error slot exists with
   `accessibilityRole="alert"`/`aria-live="polite"`; add if missing.
5. `app/settings.tsx`: tint the RN `Switch`es with tokens (DESIGN_SYNC §8), or
   wrap as `components/ui/AppSwitch.tsx` if used in >1 place.

**Accept when:** checks pass; a grep for `<Switch` outside `components/ui/`
returns only tinted/wrapped usages.

## Stage 4 — Width discipline: forms, footers, tap targets (version: patch)

Closes SYNTHESIS Issues D + E and the iPhone tap-target critical. **Files:**
`app/audit/[placeId]/[step].tsx`, `app/audit/[placeId]/review.tsx`,
`app/settings.tsx`, `app/(tabs)/execute.tsx`.

1. **Form track:** pass `maxWidth: layout.formMaxWidth` to
   `getResponsiveContentContainerStyle` in `[step].tsx` and `settings.tsx`
   (pattern already proven in `submitted.tsx:76`). Audit every other
   `getResponsiveContentContainerStyle` call site (grep) and decide
   content-vs-form track per screen; note decisions in the PR/summary.
2. **Footer alignment:** the absolute-positioned CTA bars in `review.tsx`
   (~line 792–801) and `execute.tsx` (~line 180) currently use raw
   `screenPaddingHorizontal`. Keep the bar full-bleed (background + border),
   but constrain its inner row to `getContentTrackInnerWidth(layout, <same
maxWidth as the screen's scroll content>)`, centered. Buttons then sit
   directly under the content column on tablets.
3. **Step pills** (`[step].tsx` ~line 704): give each pill `minHeight: 44`
   (use `layout.compactControlHeight` where it's ≥44 on tablets) and adjust
   `py`; verify with the 3-per-row iPhone wrap. Keep `radii.button` — not
   pills (`full` is reserved for badges).

**Accept when:** checks pass; on `createResponsiveLayout(1194)` the review
screen's footer inner width equals its content track width (unit-testable via
the two helpers); no interactive element in the wizard below 44pt.

## Stage 5 — TwoPaneLayout + dashboard/reports rails (version: minor)

Closes SYNTHESIS Issue C for the tab screens. **Files:** new
`components/ui/TwoPaneLayout.tsx`, `app/(tabs)/index.tsx`,
`app/(tabs)/reports.tsx`, `components/ui/index.ts`, `DESIGN.md`.

1. Build `<TwoPaneLayout main={...} rail={...} railWidth={...}>`: on
   `layout.isTablet`, an `XStack` with `gap={layout.twoPaneGap}`, `main`
   flexed, `rail` fixed at `railWidth` (default `layout.supportRailWidth`);
   on phone, a plain `YStack` rendering `main` then `rail` (or rail hidden via
   a `railVisibility="tablet-only"` prop). Rail must remain inside the
   screen's content track, not outside it.
2. Adopt on **Home** (`index.tsx`): metrics/queue stay in `main`; support
   content (connectivity, sync status, tips/secondary cards — whatever
   currently stacks at the bottom) moves to the rail at
   `homePageSupportRailWidth`.
3. Adopt on **Reports** (`reports.tsx`): submissions list in `main`, summary/
   filters in the rail.
4. Use judgment on what belongs in a rail — the reviewers' complaint is
   "scaled-up phone layout", not "not enough panes". If a screen has no
   genuine secondary content, widen its grid (e.g. 2-up metric cards) instead
   of inventing a rail.

**Accept when:** checks pass; on tablet widths Home and Reports render two
panes (snapshot/unit test `TwoPaneLayout` breakpoint behavior); phone layouts
are pixel-unchanged.

## Stage 6 — Audit wizard tablet rail (version: minor)

The deepest UX change; do after Stage 5's component exists. **Files:**
`app/audit/[placeId]/[step].tsx`, `review.tsx`.

1. On tablets, replace the wrapping step-pill row with a **vertical step rail**
   (fixed `supportRailWidth`, `TwoPaneLayout`): step list with number, title,
   completion state (tones from Stage 1), current step highlighted with a
   `ring`-colored indicator. Phone keeps the (Stage-4-fixed) pill row.
2. Question/form content stays capped at `formMaxWidth` inside `main` — the
   rail must not push forms back to full-bleed.
3. `review.tsx` on wide tablets: section summary cards may go 2-up
   (`isWideTablet`), footer stays aligned per Stage 4.
4. Keep step state/navigation logic untouched — this is layout only; the
   draft-store contract must not change.

**Accept when:** checks pass; wizard on `createResponsiveLayout(1194)` shows
rail + centered form; phone wizard unchanged; Maestro flows in `maestro/`
(if they cover the wizard) still pass locally.

## Stage 7 — Polish, headers, motion, docs sync (version: patch)

**Files:** `app/audit/[placeId]/_layout.tsx`, `app/_layout.tsx`, misc screens,
`DESIGN.md`, `README.md`.

1. **Contextual headers:** audit stack title from static `"Audit"` to the
   place name (subtitle/step handled in-screen); report screen title to the
   submission/place name via `navigation.setOptions`. Android back glyph
   should be the platform arrow (verify default `expo-router` header does
   this once titles are set; the Settings chevron finding was low-confidence).
2. **Dark-mode sweep:** with Stage 1 tones live, re-check the two remaining
   iPhone dark findings — "Open report" button and any `mutedForeground`-on-
   `surfaceMuted` pairs; fix stragglers with tokens, no one-off hexes.
3. **Motion:** entrance/state transitions ≤300ms with the web curve
   (`cubic-bezier(0.16, 1, 0.3, 1)` / Reanimated `Easing.out(Easing.exp)`),
   honoring `useReducedMotion`. Only where motion conveys state (screen
   entrance, badge/status changes) — no decorative animation.
4. **Docs:** update `DESIGN.md` (component table additions, TwoPaneLayout,
   AppSwitch), fix `README.md` script drift if touched, and update this file's
   status table to complete.
5. **Re-review:** run the screenshot pipeline (`bun run screenshots`, local
   simulators required) and regenerate `review/out/` **covering both themes on
   all three platforms this time** — the original capture asymmetry hid bugs.

**Accept when:** checks pass; screenshot pipeline re-run produces a new
`review/out/` set (local session only — remote sessions note it as follow-up).

---

## Risks

- **Stage 1 changes every screen's appearance at once.** Values are computed,
  contrast-verified, and single-file — but eyeball the app after (light+dark)
  before shipping. Screens using the _decorative_ accents as large fills may
  read slightly differently against the cooler background.
- **Tablet type scale (Stage 2) can overflow tight rows** (badges, tab labels,
  metric cards). Sweep tablet screenshots for truncation; prefer letting
  containers grow (`minHeight`, not `height`).
- **Radius/shadow changes may break visual snapshot tests** if any exist under
  `tests/` — update snapshots deliberately, not blindly.
- Stages 5–6 are layout refactors of live screens; keep diffs layout-only and
  leave stores/navigation contracts untouched.

## Out of scope (this effort)

- Backend/API changes (pure client work; no contract or e2e obligations
  triggered — `testing/` contracts unaffected).
- Android Material nav rail for the bottom tabs (medium-confidence Material
  guidance; revisit after Stages 5–6 land).
- Adding Space Grotesk to the web app (rejected alternative in DESIGN_SYNC §6).
- Web-side (`yee-frontend`) changes of any kind.
