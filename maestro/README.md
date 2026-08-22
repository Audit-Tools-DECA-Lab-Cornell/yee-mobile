# YEE mobile — Maestro E2E flows

Native auditor-path E2E flows for the **YEE** Expo app (`yee-mobile`). They assume a
development build is installed on a simulator/emulator that points at the same backend
seeded by `yee/testing/scripts/seed-e2e-data.sh` (or `run-mobile-e2e.sh`, which seeds + runs).

The app is **AUDITOR-only** (manager/admin sessions are rejected with 403, see
`stores/auth-store.ts`). All flows log in as the seeded auditor
`auditor-demo-1@yee.local` / `DemoPass123!`.

## App IDs

| Platform | ID                                       |
| -------- | ---------------------------------------- |
| Android  | `com.andisha2004.audittoolsyeemobile`    |
| iOS      | `com.andisha2004.audit-tools-yee-mobile` |

Flows default to the **iOS** app ID. Override `APP_ID` with Maestro's `-e` flag when running
Android; Maestro 2.2 does not provide a `--app-id` test option.

```bash
# iOS default
maestro test maestro/question-follow-up.yaml

# Android override
maestro test -e APP_ID=com.andisha2004.audittoolsyeemobile maestro/question-follow-up.yaml
```

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

## Fast local iteration (and why the app used to restart every step)

Two things made early runs slow/flaky on a **dev build**:

1. `login.yaml` used `launchApp: { clearState: true }`, which wiped the session (and MMKV
   drafts) on every launch — forcing a full re-login each time.
2. Every flow runs `runFlow: login.yaml`, and `maestro test maestro` runs each file as an
   independent flow (`launchApp` stops + restarts the app). On a dev build, each restart
   reconnects to the Metro dev server and re-downloads the JS bundle (the "waiting to
   connect to the development server" pause), which often outran the 30s waits → failures.

Fixes applied:

- **`login.yaml` is now idempotent and does NOT `clearState`.** It restores the persisted
  SecureStore session and only logs in when the login screen is actually shown — so
  repeated flows no longer re-login (and `resume-draft.yaml` now keeps its draft).
- **`smoke.yaml` runs the whole smoke set in ONE session** — launch + login once, then tab
  through dashboard/places/reports without relaunching. Use it for local iteration:

    ```bash
    maestro test maestro/smoke.yaml
    ```

- **To remove the Metro reconnect entirely, run against a preview/release build** (JS bundled
  into the binary), e.g. `eas build -p ios --profile preview` (or a local release build),
  instead of `expo start` dev mode. Launches become instant and offline-capable.

To force a clean slate (fresh login / cleared drafts) when you actually want it, uninstall the
app or temporarily add `clearState: true` back to a one-off `launchApp`.

## Smoke set vs scaffolds

**Smoke (run unattended, no manual steps):**

| Flow                     | Asserts                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `login.yaml`             | Auditor logs in → lands on the dashboard tabs.                  |
| `auditor-dashboard.yaml` | Home / Places / Execute / Reports tabs all render.              |
| `assigned-places.yaml`   | Places tab shows a real per-place action (not the empty state). |
| `report-access.yaml`     | Reports tab renders (summaries or documented empty state).      |
| `resume-draft.yaml`      | An in-progress draft survives an app kill + relaunch (MMKV).    |

**Standalone focused regression:**

`question-follow-up.yaml` is intentionally not invoked by `smoke.yaml` because it changes one
answer in the seeded Eastside Community Green draft. Run it directly when validating the domain
question UI. It normalizes the initial state to No, verifies Yes reveals the follow-up, returns
the answer to No, and never enters review or submits data.

**Scaffolds (kept out of smoke — see the file headers):**

| Flow                         | Why it is a scaffold                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `execute-and-submit.yaml`    | Full 9-step / 71-item submit is too brittle without section testIDs.      |
| `offline-queued-submit.yaml` | Needs a **manual airplane-mode** precondition to force the offline queue. |

## Stable selectors

Domain question cards, primary options, and conditional follow-ups now expose stable IDs derived
from instrument item and choice IDs. `question-follow-up.yaml` uses those IDs for the behavior
under test. Login and high-level navigation still use visible labels, so the full-submit scaffold
remains intentionally excluded from smoke coverage.

## Screenshots

Screenshot capture and visual re-baselining are handled separately from Maestro. The focused
question flow only edits the seeded test draft and stops after the non-affirmative answer; it
never enters review or submits data.

## CI

Native Maestro runs need a prepared simulator/emulator + an installed dev build, which the
default GitHub-hosted runners do not provide. `yee/testing/ci/github-actions-mobile.yml`
runs the mobile unit/quality checks and **parse-discovers** these flow files
(`find maestro -name '*.yaml'`); actual device execution belongs in an EAS workflow or a
self-hosted runner with a booted simulator.
