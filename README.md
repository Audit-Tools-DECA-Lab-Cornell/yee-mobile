# Audit Tools YEE Mobile

Mobile app for the Youth Enabling Environments (YEE) audit workflow.

The app is built with Expo + Expo Router, uses Tamagui for UI, and includes TypeScript, ESLint, and Prettier for consistent code quality.

## Product Scope

- This mobile app is built for auditors completing field audits.
- Manager planning and oversight workflows are handled in web tools.
- Auditors see assigned places and complete audits in-field (phone/tablet, often offline).
- Current front-end prioritizes clean execution flow and base scoring UX; advanced sync and async data workflows are phased next.

## Prerequisites

- Bun `1.3.x` (project uses `bun` as the package manager)
- Node.js `20+` (required by Expo/ESLint tooling)
- Expo-compatible environment:
    - iOS: Xcode
    - Android: Android Studio + SDK

## Quick Start

1. Install dependencies:

    ```bash
    bun install
    ```

2. (Optional) configure API URL in `.env`:

    ```bash
    EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:8000"
    ```

    If omitted, the app defaults to `http://127.0.0.1:8000`.

3. Start the Expo dev server:

    ```bash
    bun run start
    ```

    If web ever shows a Tamagui configuration error during development, prefer the
    Node-backed Expo launcher below instead of `bunx`-driven commands:

    ```bash
    npx expo start --web --clear
    ```

4. Run on a platform:

    ```bash
    bun run ios
    bun run android
    ```

## Scripts

- `bun run start` - start Expo dev server (clears cache)
- `bun run ios` - run iOS native app
- `bun run android` - run Android native app
- `bun run build` - export the Expo app for all supported platforms
- `bun run build:ios` - export the iOS bundle
- `bun run build:android` - export the Android bundle
- `bun run doctor` - run Expo diagnostics (`expo-doctor`)
- `bun run screenshots:ios -- --list` - list automated iOS screenshot targets (booted simulators)
- `bun run screenshots:android -- --list` - list automated Android screenshot targets (connected devices)
- `bun run screenshots` - capture iOS then Android into `screenshots/<device>/<appearance>/`
- `bun run ci:quality` - run the complete CI quality pipeline locally
- `bun run update:production` - publish a compatible JS/assets update to the production EAS Update channel

## Versioning & Releases

`runtimeVersion` is `fingerprint`, so compatible JS/assets changes can ship with `bun run update:production`. Native dependency, Expo SDK, permission, or runtime-impacting changes need a new store build with `bun run eas:android` followed by `bun run submit:android`.

The app checks `/yee/mobile-release-policy` at startup and force-updates any install below the backend's `minimum_supported_version`. That floor is **not** auto-derived from a store release — it is a hand-maintained constant in `YEE_RELEASE_POLICY` in `audit-tools-backend/app/products/mobile_release_policy.py`.

**On every version bump (or when an agent finishes a user-shipping YEE mobile session), review that floor and propose whether it must rise.** Raise it when older installs would break against the current backend — a data/terminology migration, an API-contract or sync change, a dropped/renamed field, a required native capability, or a fix older clients must not skip. Leave it (the default) for backward-compatible changes; a needless raise force-updates every tester. Propose the new floor (or an explicit "no change needed") with a one-line rationale and apply only after confirmation. Full policy: `audit-tools-backend/docs/deployment.md` → "Mobile Release Policy Sources".

## Code Quality

- `bun run typecheck` - TypeScript checks (`tsc --noEmit`)
- `bun run lint` - ESLint checks
- `bun run lint:fix` - auto-fix ESLint issues when possible
- `bun run format` - format files with Prettier
- `bun run format:check` - verify formatting without writing changes
- `bun run check` - run typecheck + lint + format check

### Pre-Commit Gate

The repository uses `husky` + `lint-staged` for staged-file quality checks:

- TypeScript/JavaScript files run ESLint fix + Prettier
- JSON/Markdown/YAML files run Prettier

If hooks are not active on your machine, run:

```bash
bun run prepare
```

### CI Quality Gate

GitHub Actions workflow: `.github/workflows/mobile-quality.yml`

The pipeline runs:

1. `bun install --frozen-lockfile`
2. `bun run check`
3. `bun run doctor`

### Dependency Governance

- Dependabot is configured in `.github/dependabot.yml` for:
    - npm dependencies
    - GitHub Actions dependencies

### PR Quality Policy

- Pull requests use `.github/pull_request_template.md`
- Every PR must include risk notes and verification checklist status

Recommended before opening a PR:

```bash
bun run ci:quality
```

## Project Structure

- `app/` - Expo Router routes/screens
- `components/` - shared UI components
    - `components/ui/` - token-backed component library (Button, Card, Badge, Field, EmptyState, LoadingState, ErrorState, ScreenHeader, MetricCard, ListRow, ProgressBar, StatusBanner)
- `lib/` - domain logic (auth/api/offline storage)
    - `lib/design-system.ts` - the single source of design tokens (colors, fonts, radii, spacing, shadows) and tone helpers
- `stores/` - Zustand state stores
- `assets/` - static app assets
- `DESIGN.md` - design system reference (tokens, component library, usage rules)

## Notes

- This repository currently runs as an Expo-managed app and does not require checked-in `ios/` or `android/` folders for local development.
- Expo Router entry point is configured via `main: "expo-router/entry"` in `package.json`.
- Android shell behavior is edge-to-edge: `lib/system-bars.ts` hides the navigation bar after startup, route, foreground, and keyboard changes; headerless screens add `useSafeAreaInsets().top` through `lib/responsive-layout.ts`; keyboard avoidance uses `react-native-keyboard-controller`; and Android 12+ splash rendering uses the `expo-splash-screen` plugin with `assets/images/splash-icon.png`.
- Deep audit/report routes use native stack headers with fetched place/report context; do not add manual top inset there or expose route IDs as titles.
- The mobile tablet breakpoint lives in `lib/responsive-layout-tokens.ts` as `TABLET_BREAKPOINT = 600`; keep tab-bar sizing and screen padding on that shared responsive path.
- Changes to keyboard-controller, splash config, Android soft-input behavior, or tablet breakpoint behavior need `expo prebuild --clean` verification and a new native build.
