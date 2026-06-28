# YEE mobile — Maestro E2E flows

Native auditor-path E2E flows for the **YEE** Expo app (`yee-mobile`). They assume a
development build is installed on a simulator/emulator that points at the same backend
seeded by `yee/testing/scripts/seed-e2e-data.sh` (or `run-mobile-e2e.sh`, which seeds + runs).

The app is **AUDITOR-only** (manager/admin sessions are rejected with 403, see
`stores/auth-store.ts`). All flows log in as the seeded auditor
`auditor-demo-1@yee.local` / `DemoPass123!`.

## App IDs

| Platform | ID                                    |
| -------- | ------------------------------------- |
| Android  | `com.andisha2004.audittoolsyeemobile` |
| iOS      | `com.andisha2004.yee-mobile`          |

Flows default to the **Android** `appId`. For an iOS simulator run, override Maestro's
app id (e.g. `maestro test --app-id com.andisha2004.yee-mobile maestro/login.yaml`) or
copy the flows with the iOS bundle id in the `appId:` header.

## Run

```bash
# 1. Seed the test DB + start the backend (separate terminal), or use run-mobile-e2e.sh.
# 2. Start a dev build pointed at the local backend:
cd yee/yee-mobile
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 bun run dev
# 3. With a simulator/emulator running the dev build:
maestro test maestro
```

Or, from the workspace root, the orchestrated entry point:

```bash
TEST_DATABASE_URL_YEE=... yee/testing/scripts/run-mobile-e2e.sh
```

`run-mobile-e2e.sh` validates contracts, seeds the test DB, and invokes `maestro test maestro`.
It does **not** boot a simulator or install a dev build — that must already be running
(native Maestro requires a prepared device; see CI note below).

## Smoke set vs scaffolds

**Smoke (run unattended, no manual steps):**

| Flow                     | Asserts                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `login.yaml`             | Auditor logs in → lands on the dashboard tabs.                  |
| `auditor-dashboard.yaml` | Home / Places / Execute / Reports tabs all render.              |
| `assigned-places.yaml`   | Places tab shows a real per-place action (not the empty state). |
| `report-access.yaml`     | Reports tab renders (summaries or documented empty state).      |
| `resume-draft.yaml`      | An in-progress draft survives an app kill + relaunch (MMKV).    |

**Scaffolds (kept out of smoke — see the file headers):**

| Flow                         | Why it is a scaffold                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `execute-and-submit.yaml`    | Full 9-step / 71-item submit is too brittle without section testIDs.      |
| `offline-queued-submit.yaml` | Needs a **manual airplane-mode** precondition to force the offline queue. |

## testID gap (known limitation)

The YEE mobile screens carry **zero `testID` props** (confirmed in `GROUND-TRUTH.md` §6.10).
Flows therefore target elements by **visible text / placeholder / accessibilityLabel**, which
is fragile for i18n or copy changes. Hardening these flows into full step-by-step submit
coverage should first add stable `testID`s to the login, audit-step, review, and submitted
screens (decision D6). Until then, the deep flows stay scaffolds.

## Screenshots (out of scope here)

The pre-existing screenshot bootstrap (`app/__screenshot-bootstrap.tsx`) and the captured
`screenshots/` PNGs (iphone 19 / ipad 15, light theme) are **not** modified by these flows —
T4 adds Maestro alongside them. The `__screenshot-bootstrap` deep link (`yee-mobile://`,
accepts `target`/`email`/`password`) can be reused to pre-auth a future Maestro flow.

## CI

Native Maestro runs need a prepared simulator/emulator + an installed dev build, which the
default GitHub-hosted runners do not provide. `yee/testing/ci/github-actions-mobile.yml`
runs the mobile unit/quality checks and **parse-discovers** these flow files
(`find maestro -name '*.yaml'`); actual device execution belongs in an EAS workflow or a
self-hosted runner with a booted simulator.
