---
name: YEE Mobile UIUX Overhaul
overview: A phased UI/UX architecture overhaul of the YEE mobile app that aligns it with the new YEE frontend green/cream design system, replaces its three competing color systems with a single Tamagui token source, extracts a real shared component library, hardens the offline draft architecture, and redesigns every screen to production quality — while preserving the mature offline-first behavior.
todos:
    - id: phase0-visual-baseline
      content: "Deferred: boot app in simulator and capture screen-by-screen screenshot baseline before executing Phase 4 (pre-execution validation gate)"
      status: pending
    - id: phase1-tokens
      content: "Phase 1: Port frontend DESIGN.md tokens into a single Tamagui token source; collapse lib/design-system.ts into tokens; fix Provider.tsx dark/light mismatch; author mobile DESIGN.md; reconcile stale designs/*.html"
      status: pending
    - id: phase2-components
      content: "Phase 2: Build components/ui/ library (Button, Card, Badge, Field, EmptyState, LoadingState, ErrorState, ScreenHeader, MetricCard, ListRow, SectionCard, ProgressBar, StatusBanner); extract inline screen components; standardize icons; enable toasts/haptics"
      status: pending
    - id: phase3-offline-arch
      content: "Phase 3: Harden offline draft architecture (MMKV at-rest encryption TODO, confirm no draft submission, drafts persist to final submit); remove copa/demo fork debt; apply safe-area/keyboard/touch-target rules"
      status: pending
    - id: phase4-screens
      content: "Phase 4: Token-led redesign of every screen (auth, dashboard, places, execute, wizard decomposition + domain-accent rule, review, reports list/detail with native export, not-found)"
      status: pending
    - id: phase5-a11y-motion
      content: "Phase 5: Accessibility (AA contrast, dynamic type, reduced motion, status regions, ellipsis) and consistent Reanimated motion matching the frontend"
      status: pending
    - id: phase6-verify-docs
      content: "Phase 6: Run bun check/doctor/build:web/perf budget; update README structure and finalize DESIGN.md"
      status: pending
isProject: false
---

# YEE Mobile UI/UX Architecture Overhaul

Mirrors the YEE frontend overhaul (Plan 1 architecture hardening + Plan 2 token-led design system across every screen, codified in `DESIGN.md`/`PRODUCT.md`), adapted to Expo + Tamagui and the mobile offline-first constraint. Target design language: the new YEE frontend green/cream identity adapted to mobile.

## Current state (assessment)

- **Three competing color systems**: Tamagui themes ([themes.ts](yee/audit-tools-yee-mobile/themes.ts), `defaultTheme="dark"`, largely unused) vs static cream/green [lib/design-system.ts](yee/audit-tools-yee-mobile/lib/design-system.ts) (raw hex `primary: "#10231F"`, what screens actually use) vs per-step hardcoded palettes in the wizard. Stale dark/orange mocks in `designs/*.html` match nothing shipped.
- **Theme mismatch bug**: [components/Provider.tsx](yee/audit-tools-yee-mobile/components/Provider.tsx) sets `defaultTheme="dark"` while every screen renders light from `designSystem` + `StatusBar style="dark"`.
- **No shared component layer**: only 3 files in `components/`; cards/buttons/badges/headers/empty-states are re-declared inline across 6+ screens. The wizard [app/audit/[placeId]/[step].tsx](yee/audit-tools-yee-mobile/app/audit/[placeId]/[step].tsx) is ~1976 lines with 20+ local sub-components.
- **Copa/Playspace fork debt**: `demo-ui-store`, `playspace-deca` GCP reference, unused Lucide + OpenDyslexic assets, `@tamagui/lucide-icons` installed but Feather used, dev/QA copy on the Execute tab.
- **Offline is mature (preserve)**: MMKV draft + sync queue ([lib/yee-secure-draft-storage.ts](yee/audit-tools-yee-mobile/lib/yee-secure-draft-storage.ts)), AsyncStorage caches ([lib/yee-offline-storage.ts](yee/audit-tools-yee-mobile/lib/yee-offline-storage.ts)), `expo-secure-store` tokens.

## Constraints

- Strict offline compatibility; the app keeps drafts safe/secure until final submission. **No draft submissions** — drafts stay local. Redesign must not regress this.
- User standards: full code, no `any`, no `!`, no `as unknown as T`, double quotes, template literals/`.join()`, JSDoc + intent-only comments, strict TS.
- Preserve all functionality; improve tokens, structure, correctness, and polish only.

## Phase 0 — Deferred visual baseline (run on restart)

Booting the app in a simulator for a screen-by-screen screenshot baseline is deferred per your note. Before executing Phase 4, capture login, dashboard, places, execute, the 9-step wizard, review, reports, and report detail. Treat this as the pre-execution validation gate.

## Phase 1 — Single token source + theming (foundation)

- Port the frontend's `DESIGN.md` OKLCH tokens (YEE green primary, cream surfaces, semantic + radius + shadow scales) into one mobile Tamagui token set in [tamagui.config.ts](yee/audit-tools-yee-mobile/tamagui.config.ts) + [themes.ts](yee/audit-tools-yee-mobile/themes.ts).
- Collapse [lib/design-system.ts](yee/audit-tools-yee-mobile/lib/design-system.ts) into Tamagui tokens/themes so screens consume `$` tokens, not raw hex; keep the tone helpers (`getMetricTone`, `getPlaceStatusTone`, `getPreAuditTone`) but back them with tokens.
- Fix the theme mismatch: set `Provider.tsx` to the light theme (or implement a real light/dark switch) so the configured theme matches what renders.
- Author `yee/audit-tools-yee-mobile/DESIGN.md` mirroring the frontend, mapping web tokens to mobile equivalents; reconcile or delete stale `designs/*.html`.

## Phase 2 — Shared component library

- Create `components/ui/`: `Button`, `Card`, `Badge`/`Pill`, `Field`+`Input`, `EmptyState`, `LoadingState`, `ErrorState`, `ScreenHeader`, `MetricCard`, `ListRow`, `SectionCard`, `ProgressBar`, `StatusBanner` (online/offline).
- Extract duplicated inline components (`MetricCard`, `ActionButton`, `EmptyStateCard`, `SummaryTile`, `InfoTile`, `ChecklistLine`) out of the tab screens into the library.
- Standardize the icon system (align with frontend's Lucide; either adopt `@tamagui/lucide-icons` consistently or remove it) via [components/icons.tsx](yee/audit-tools-yee-mobile/components/icons.tsx).
- Enable the wired-but-dormant toast/`burnt` haptics layer.

## Phase 3 — Architecture + offline hardening (mobile "Plan 1")

- Audit MMKV draft + sync-queue integrity and address the deferred at-rest encryption TODO in [lib/yee-secure-draft-storage.ts](yee/audit-tools-yee-mobile/lib/yee-secure-draft-storage.ts) (drafts hold field data until submit).
- Verify there is no draft-submission path and that drafts persist locally until final submission across reconnect/sync.
- Remove fork debt: rename `demo-ui-store` to a real selection store, drop unused OpenDyslexic/SpaceMono assets and stale `playspace-deca`/lucide-vs-feather mismatches.
- Apply the mobile UI/UX rules ([.cursor/rules/ui-ux-design-best-practices.mdc](yee/audit-tools-yee-mobile/.cursor/rules/ui-ux-design-best-practices.mdc)): `useSafeAreaInsets`, `KeyboardAvoidingView`, 44pt touch targets, thumb-zone primary actions.

## Phase 4 — Screen redesign (token-led, one milestone per surface)

- **Auth** ([app/(auth)/login.tsx](<yee/audit-tools-yee-mobile/app/(auth)/login.tsx>), `signup.tsx`): YEE logo/branding, fix non-functional "Forgot password?", wire or remove `staySignedIn`.
- **Dashboard/Home** ([app/(tabs)/index.tsx](<yee/audit-tools-yee-mobile/app/(tabs)/index.tsx>)): token metric grid, hero CTA, place cards; reduce status-copy duplication.
- **Places** ([app/(tabs)/places.tsx](<yee/audit-tools-yee-mobile/app/(tabs)/places.tsx>)): list density tuned for field use, real empty states.
- **Execute** ([app/(tabs)/execute.tsx](<yee/audit-tools-yee-mobile/app/(tabs)/execute.tsx>)): remove dev/QA copy, product-ready empty + selected states.
- **Audit wizard** ([app/audit/[placeId]/[step].tsx](yee/audit-tools-yee-mobile/app/audit/[placeId]/[step].tsx)): decompose the ~1976-line file into wizard components; replace 9 ad-hoc per-step palettes with the frontend's domain-color rule (color as border/accent on option cards, light tint background — not solid fill); accessible option cards, save-status indicator, sticky footer nav.
- **Review** ([app/audit/[placeId]/review.tsx](yee/audit-tools-yee-mobile/app/audit/[placeId]/review.tsx)): token answer pills/score preview; keep online/offline/duplicate submit guards.
- **Reports list + detail** ([app/(tabs)/reports.tsx](<yee/audit-tools-yee-mobile/app/(tabs)/reports.tsx>), [app/reports/[submissionId].tsx](yee/audit-tools-yee-mobile/app/reports/[submissionId].tsx)): replace web-only `window.print`/CSV-blob export with native share/export.
- **Not found** ([app/+not-found.tsx](yee/audit-tools-yee-mobile/app/+not-found.tsx)): drop the Expo-template blue link, apply the design system.

## Phase 5 — Accessibility, motion, polish

- Contrast AA across tokens, dynamic type via `$font` tokens, reduced-motion alternatives, `aria`/accessibility props on async/status regions, ellipsis `…` not `...`.
- Consistent Reanimated motion (exponential ease-out, <300ms state / 500ms entrance) matching the frontend.

## Phase 6 — Verification + docs

- `bun run check` (typecheck + lint + format), `bun run doctor`, `bun run build:web`, `bun run perf:web:budget` must stay green.
- Update [README.md](yee/audit-tools-yee-mobile/README.md) project-structure section to reflect `components/ui/`; finalize mobile `DESIGN.md`.

## Execution model

Mirror the frontend: a single coherent background worker per plan (Phase 1-3 as one architecture/foundation plan, Phase 4-6 as the design plan) to avoid token/component conflicts, with verification gates between phases. Nothing is executed until you approve and (ideally) complete the Phase 0 visual baseline.
