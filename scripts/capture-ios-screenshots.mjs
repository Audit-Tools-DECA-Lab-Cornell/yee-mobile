#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_SCHEME = "audit-tools-yee-mobile";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_WAIT_MS = 20000;
const DEFAULT_LOGIN_WAIT_MS = 20000;
const DEFAULT_SCROLL_DELAY_MS = 450;
const DEFAULT_SIMULATOR = "booted";

const TARGET_DEVICE_TYPES = ["iphone", "ipad"];

const REPORT_DETAIL_SCROLLS = {
    iphone: { early: 950, end: 3600 },
    ipad: { early: 800, end: 2800 },
};

/**
 * Parse screenshot runner arguments.
 *
 * @param {readonly string[]} argv Raw CLI args.
 * @returns Parsed options.
 */
function parseArgs(argv) {
    const options = {
        apiBaseUrl: DEFAULT_API_BASE_URL,
        appearance: null,
        device: null,
        email: null,
        password: null,
        reset: true,
        scheme: DEFAULT_SCHEME,
        simulator: DEFAULT_SIMULATOR,
        waitMs: DEFAULT_WAIT_MS,
        loginWaitMs: DEFAULT_LOGIN_WAIT_MS,
        list: false,
        outputDir: null,
        target: "all",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        }
        if (arg === "--list") {
            options.list = true;
            continue;
        }
        if (arg === "--no-reset") {
            options.reset = false;
            continue;
        }

        const next = argv[index + 1];
        if (next === undefined || next.startsWith("--")) {
            throw new Error(`Missing value for ${arg}`);
        }

        if (arg === "--api-base-url") options.apiBaseUrl = stripTrailingSlash(next);
        else if (arg === "--appearance") options.appearance = next;
        else if (arg === "--device") options.device = next;
        else if (arg === "--email") options.email = normalizeEmail(next);
        else if (arg === "--password") options.password = next;
        else if (arg === "--scheme") options.scheme = next;
        else if (arg === "--simulator") options.simulator = next;
        else if (arg === "--wait-ms") options.waitMs = parsePositiveInteger(next, "--wait-ms");
        else if (arg === "--login-wait-ms")
            options.loginWaitMs = parsePositiveInteger(next, "--login-wait-ms");
        else if (arg === "--output-dir") options.outputDir = next;
        else if (arg === "--target") options.target = next;
        else throw new Error(`Unknown argument: ${arg}`);
        index += 1;
    }

    if (options.email === null || options.password === null) {
        loadEnvFiles();
    }
    if (options.email === null && typeof process.env.SCREENSHOT_EMAIL === "string") {
        options.email = normalizeEmail(process.env.SCREENSHOT_EMAIL);
    }
    if (options.password === null && typeof process.env.SCREENSHOT_PASSWORD === "string") {
        options.password = process.env.SCREENSHOT_PASSWORD || null;
    }

    if (options.device !== null && !TARGET_DEVICE_TYPES.includes(options.device)) {
        throw new Error('--device must be "iphone" or "ipad".');
    }
    if (options.appearance !== null && !["light", "dark"].includes(options.appearance)) {
        throw new Error('--appearance must be "light" or "dark".');
    }

    return options;
}

function printHelp() {
    console.log(`Capture YEE mobile screenshots from a booted iOS simulator.

Usage:
  bun run screenshots:ios -- --email USER --password PASS
  bun run screenshots:ios -- --device iphone --appearance light --email USER --password PASS
  bun run screenshots:ios -- --device ipad --appearance dark --email USER --password PASS
  bun run screenshots:ios -- --list

Options:
  --api-base-url URL   Backend used only to resolve place/report IDs. Default: ${DEFAULT_API_BASE_URL}
  --appearance VALUE   light or dark. Omit to capture both appearances in sequence. Default: both
  --device VALUE       iphone or ipad. Omit to capture every booted simulator. Default: all booted
  --email VALUE        Screenshot auditor email (or set SCREENSHOT_EMAIL in .env.local / .env)
  --password VALUE     Screenshot auditor password (or set SCREENSHOT_PASSWORD in .env.local / .env)
  --login-wait-ms N    Extra wait after the first login target. Default: ${DEFAULT_LOGIN_WAIT_MS}
  --output-dir PATH    Output directory. Default: screenshots/<device>/<appearance>
  --scheme VALUE       App URL scheme. Default: ${DEFAULT_SCHEME}
  --simulator VALUE    simctl device target. Default: booted
  --target VALUE       all, public, protected, or a comma-separated list of PNG names
  --wait-ms VALUE      Delay after each deep link before capture. Default: ${DEFAULT_WAIT_MS}
  --no-reset           Keep the existing app auth session between targets
`);
}

/**
 * Load screenshot credentials from local env files when CLI flags are omitted.
 *
 * Existing values win so explicit shell variables and `.env.local` stay higher
 * priority than `.env`.
 */
function loadEnvFiles() {
    if (typeof process.loadEnvFile !== "function") {
        return;
    }

    for (const file of [".env.local", ".env"]) {
        const existingEmail = process.env.SCREENSHOT_EMAIL;
        const existingPassword = process.env.SCREENSHOT_PASSWORD;
        try {
            process.loadEnvFile(path.resolve(file));
        } catch {
            continue;
        }
        if (typeof existingEmail === "string") {
            process.env.SCREENSHOT_EMAIL = existingEmail;
        }
        if (typeof existingPassword === "string") {
            process.env.SCREENSHOT_PASSWORD = existingPassword;
        }
    }
}

function normalizeEmail(value) {
    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue.length > 0 ? normalizedValue : null;
}

function parsePositiveInteger(value, label) {
    if (!/^\d+$/.test(value)) throw new Error(`${label} must be a positive integer.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a positive integer.`);
    }
    return parsed;
}

function stripTrailingSlash(value) {
    return value.replace(/\/$/, "");
}

/**
 * Classify a simulator name as "iphone" or "ipad", or null when it is neither.
 *
 * @param {string} name Simulator display name.
 * @returns {"iphone" | "ipad" | null} Device type.
 */
function classifyDeviceType(name) {
    const normalized = name.toLowerCase();
    if (normalized.includes("ipad")) return "ipad";
    if (normalized.includes("iphone")) return "iphone";
    return null;
}

/**
 * List all iPhone / iPad simulators known to simctl.
 *
 * @returns {Array<{ udid: string, name: string, state: string, isBooted: boolean, deviceType: "iphone" | "ipad" }>}
 */
function listSimulators() {
    const result = spawnSync("xcrun", ["simctl", "list", "devices", "-j"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
        return [];
    }

    try {
        const data = JSON.parse(result.stdout);
        const simulators = [];
        for (const runtimeDevices of Object.values(data.devices ?? {})) {
            for (const device of runtimeDevices) {
                const deviceType = classifyDeviceType(device.name ?? "");
                if (deviceType === null) {
                    continue;
                }
                simulators.push({
                    udid: device.udid,
                    name: device.name,
                    state: device.state,
                    isBooted: device.state === "Booted",
                    deviceType,
                });
            }
        }
        return simulators;
    } catch {
        return [];
    }
}

/**
 * Resolve the concrete simulators to capture.
 *
 * @param {ReturnType<typeof parseArgs>} options Parsed options.
 * @returns {ReturnType<typeof listSimulators>} Target simulators.
 */
function resolveTargetSimulators(options) {
    const simulators = listSimulators();

    if (options.simulator !== "booted") {
        const match = simulators.find(
            (simulator) =>
                simulator.udid === options.simulator || simulator.name === options.simulator,
        );
        if (match === undefined) {
            throw new Error(`No simulator matches --simulator "${options.simulator}".`);
        }
        if (!match.isBooted) {
            throw new Error(`Simulator "${match.name}" is not booted. Boot it first.`);
        }
        return [match];
    }

    const booted = simulators.filter((simulator) => simulator.isBooted);
    if (booted.length === 0) {
        throw new Error("No booted iOS simulator found. Boot an iPhone or iPad simulator first.");
    }

    if (options.device !== null) {
        const match = booted.find((simulator) => simulator.deviceType === options.device);
        if (match === undefined) {
            throw new Error(
                `No booted ${options.device} simulator found. Boot one or pass --simulator <udid>.`,
            );
        }
        return [match];
    }

    const byType = new Map();
    for (const simulator of booted) {
        if (!byType.has(simulator.deviceType)) {
            byType.set(simulator.deviceType, simulator);
        }
    }
    return [...byType.values()];
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const discovery = await discoverBackendData(options);

    if (options.list) {
        const deviceTypes = options.device !== null ? [options.device] : TARGET_DEVICE_TYPES;
        for (const deviceType of deviceTypes) {
            const targets = selectTargets(buildTargets(discovery, deviceType), options.target);
            printTargetList(deviceType, targets);
        }
        return;
    }

    ensureXcrunAvailable();

    const appearances = options.appearance !== null ? [options.appearance] : ["light", "dark"];
    const simulators = resolveTargetSimulators(options);

    if (options.outputDir !== null && simulators.length * appearances.length > 1) {
        throw new Error(
            "--output-dir cannot be combined with multiple devices or appearances. Narrow with --device and --appearance.",
        );
    }

    console.log(
        `Capturing on: ${simulators.map((simulator) => `${simulator.deviceType} (${simulator.name})`).join(", ")}`,
    );

    let anyFailures = false;

    for (const simulator of simulators) {
        for (const appearance of appearances) {
            const targets = selectTargets(
                buildTargets(discovery, simulator.deviceType),
                options.target,
            );
            if (targets.length === 0) {
                console.warn(
                    `No targets matched --target "${options.target}" for ${simulator.deviceType}; skipping.`,
                );
                continue;
            }
            const failed = await captureSimulatorRun({ options, simulator, appearance, targets });
            if (failed) {
                anyFailures = true;
            }
        }
    }

    if (anyFailures) {
        process.exitCode = 1;
    }
}

function printTargetList(deviceType, targets) {
    console.log(`\n# ${deviceType}`);
    if (targets.length === 0) {
        console.log("No targets matched.");
        return;
    }
    for (const target of targets) {
        const access = target.skipLogin ? "public" : "protected";
        const route = target.route.length > 0 ? target.route : "(unresolved dynamic route)";
        console.log(`${target.file}\t${route}\t${access}`);
    }
}

/**
 * Capture every target for one concrete simulator and appearance.
 *
 * @param {object} input Capture input.
 * @param {ReturnType<typeof parseArgs>} input.options Parsed options.
 * @param {ReturnType<typeof listSimulators>[number]} input.simulator Target simulator.
 * @param {"light" | "dark"} input.appearance Simulator appearance.
 * @param {readonly ScreenshotTarget[]} input.targets Screenshot targets.
 * @returns {Promise<boolean>} True when any target failed.
 */
async function captureSimulatorRun({ options, simulator, appearance, targets }) {
    const outputDir = path.resolve(
        options.outputDir ?? path.join("screenshots", simulator.deviceType, appearance),
    );
    await mkdir(outputDir, { recursive: true });

    console.log(`\n=== ${simulator.deviceType} / ${appearance} (${simulator.name}) ===`);
    run("xcrun", ["simctl", "ui", simulator.udid, "appearance", appearance]);

    const manifest = {
        generated_at: new Date().toISOString(),
        device: simulator.deviceType,
        simulator_name: simulator.name,
        simulator_udid: simulator.udid,
        appearance,
        api_base_url: options.apiBaseUrl,
        output_directory: outputDir,
        total_targets: targets.length,
        success_count: 0,
        failure_count: 0,
        successes: [],
        failures: [],
    };

    let hasResetThisRun = false;

    for (const target of targets) {
        try {
            if (target.requiresAuth && (options.email === null || options.password === null)) {
                throw new Error("Protected target requires --email and --password.");
            }
            if (target.skipReason) {
                throw new Error(target.skipReason);
            }

            const shouldReset = options.reset && !hasResetThisRun && !target.skipLogin;
            if (shouldReset) {
                hasResetThisRun = true;
            }

            const outputPath = path.join(outputDir, target.file);
            const url = buildBootstrapUrl(target, options, shouldReset);
            const waitMs = shouldReset ? options.loginWaitMs : options.waitMs;

            console.log(`Opening ${target.route}${shouldReset ? " (reset + login)" : ""}`);
            run("xcrun", ["simctl", "openurl", simulator.udid, url]);
            await sleep(waitMs);
            run("xcrun", ["simctl", "io", simulator.udid, "screenshot", outputPath]);

            manifest.successes.push({
                file: target.file,
                route: target.route,
                output_file: path.relative(process.cwd(), outputPath),
            });
            manifest.success_count += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed ${target.file}: ${message}`);
            manifest.failures.push({ file: target.file, route: target.route, message });
            manifest.failure_count += 1;
        }
    }

    await writeFile(
        path.join(outputDir, "manifest.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );

    return manifest.failure_count > 0;
}

async function discoverBackendData(options) {
    if (options.email === null || options.password === null) {
        return { firstPlace: null, firstSubmission: null };
    }

    try {
        const loginResponse = await fetch(`${options.apiBaseUrl}/yee/auth/login`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ email: options.email, password: options.password }),
        });
        if (!loginResponse.ok) throw new Error(`login failed (${loginResponse.status})`);
        const loginPayload = await loginResponse.json();
        const token = loginPayload.access_token;
        if (typeof token !== "string" || token.length === 0) {
            throw new Error("login response did not include access_token");
        }

        const [places, submissions] = await Promise.all([
            fetchAuthedJson(`${options.apiBaseUrl}/yee/dashboard/my-places`, token),
            fetchAuthedJson(`${options.apiBaseUrl}/yee/my-audits`, token),
        ]);

        return {
            firstPlace: Array.isArray(places) ? (places[0] ?? null) : null,
            firstSubmission: Array.isArray(submissions) ? (submissions[0] ?? null) : null,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Backend data discovery unavailable: ${message}`);
        return { firstPlace: null, firstSubmission: null };
    }
}

async function fetchAuthedJson(url, token) {
    const response = await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error(`${url} failed (${response.status})`);
    }
    return response.json();
}

function buildTargets(discovery, deviceType) {
    if (deviceType === "iphone") {
        return buildIphoneTargets(discovery);
    }
    if (deviceType === "ipad") {
        return buildIpadTargets(discovery);
    }
    throw new Error(`Unknown device type: ${deviceType}`);
}

function buildIphoneTargets(discovery) {
    const routes = buildDynamicRoutes(discovery);
    const targets = [
        publicTarget("01-login.png", "/(auth)/login", "Login screen"),
        publicTarget("02-signup.png", "/(auth)/signup", "Access setup screen"),
        protectedTarget("03-home.png", "/(tabs)", "Dashboard top"),
        protectedTarget(
            "04-home-assigned-places.png",
            withScreenshotScroll("/(tabs)", 950),
            "Dashboard assigned places",
        ),
        protectedTarget("05-places.png", "/(tabs)/places", "Places list top"),
        protectedTarget(
            "06-places-list.png",
            withScreenshotScroll("/(tabs)/places", 850),
            "Places list scrolled",
        ),
        protectedTarget("07-execute.png", "/(tabs)/execute", "Execute workspace top"),
        protectedTarget(
            "08-execute-detail.png",
            withScreenshotScroll("/(tabs)/execute", 780),
            "Execute workspace detail",
        ),
        dynamicPlaceTarget("09-audit-context.png", routes.auditContext, "Audit context step"),
        dynamicPlaceTarget("10-audit-weighting.png", routes.auditWeighting, "Audit weighting step"),
        dynamicPlaceTarget("11-audit-domain.png", routes.auditDomain, "Audit domain section top"),
        dynamicPlaceTarget(
            "12-audit-domain-questions.png",
            withScreenshotScroll(routes.auditDomain, 1050),
            "Audit domain questions",
        ),
        dynamicPlaceTarget("13-audit-review.png", routes.auditReview, "Audit review top"),
        dynamicPlaceTarget(
            "14-audit-review-sections.png",
            withScreenshotScroll(routes.auditReview, 1700),
            "Audit review sections",
        ),
        protectedTarget("15-reports.png", "/(tabs)/reports", "Reports top"),
        protectedTarget(
            "16-reports-list.png",
            withScreenshotScroll("/(tabs)/reports", 900),
            "Reports list",
        ),
        ...buildReportDetailTargets("iphone", "17", routes.reportDetail),
    ];
    return assertUniqueTargetFiles("iphone", targets);
}

function buildIpadTargets(discovery) {
    const routes = buildDynamicRoutes(discovery);
    const targets = [
        publicTarget("01-login.png", "/(auth)/login", "Login screen"),
        publicTarget("02-signup.png", "/(auth)/signup", "Access setup screen"),
        protectedTarget("03-home.png", "/(tabs)", "Dashboard top"),
        protectedTarget("04-places.png", "/(tabs)/places", "Places list top"),
        protectedTarget("05-execute.png", "/(tabs)/execute", "Execute workspace top"),
        dynamicPlaceTarget("06-audit-context.png", routes.auditContext, "Audit context step"),
        dynamicPlaceTarget("07-audit-weighting.png", routes.auditWeighting, "Audit weighting step"),
        dynamicPlaceTarget("08-audit-domain.png", routes.auditDomain, "Audit domain section top"),
        dynamicPlaceTarget(
            "09-audit-domain-questions.png",
            withScreenshotScroll(routes.auditDomain, 900),
            "Audit domain questions",
        ),
        dynamicPlaceTarget("10-audit-review.png", routes.auditReview, "Audit review top"),
        dynamicPlaceTarget(
            "11-audit-review-sections.png",
            withScreenshotScroll(routes.auditReview, 1500),
            "Audit review sections",
        ),
        protectedTarget("12-reports.png", "/(tabs)/reports", "Reports top"),
        ...buildReportDetailTargets("ipad", "13", routes.reportDetail),
    ];
    return assertUniqueTargetFiles("ipad", targets);
}

function buildDynamicRoutes(discovery) {
    const routes = {
        auditContext: null,
        auditWeighting: null,
        auditDomain: null,
        auditReview: null,
        reportDetail: null,
    };

    if (isResolvedPlace(discovery.firstPlace)) {
        const placeId = encodeURIComponent(discovery.firstPlace.id);
        routes.auditContext = `/audit/${placeId}/1`;
        routes.auditWeighting = `/audit/${placeId}/2`;
        routes.auditDomain = `/audit/${placeId}/3`;
        routes.auditReview = `/audit/${placeId}/review`;
    }

    if (isResolvedSubmission(discovery.firstSubmission)) {
        routes.reportDetail = `/reports/${encodeURIComponent(discovery.firstSubmission.id)}`;
    }

    return routes;
}

function buildReportDetailTargets(deviceType, startNumber, reportRoute) {
    const base = Number(startNumber);
    const scrolls = REPORT_DETAIL_SCROLLS[deviceType];
    return [
        dynamicReportTarget(
            `${pad2(base)}-report-detail-top.png`,
            reportRoute,
            "Report detail top",
        ),
        dynamicReportTarget(
            `${pad2(base + 1)}-report-detail-early.png`,
            withScreenshotScroll(reportRoute, scrolls.early),
            "Report detail early scroll",
        ),
        dynamicReportTarget(
            `${pad2(base + 2)}-report-detail-end.png`,
            withScreenshotScroll(reportRoute, scrolls.end),
            "Report detail end",
        ),
    ];
}

function publicTarget(file, route, note) {
    return { file, route, skipLogin: true, note };
}

function protectedTarget(file, route, note) {
    return { file, route, requiresAuth: true, note };
}

function dynamicPlaceTarget(file, route, note) {
    return route === null
        ? unresolved(file, "No assigned place was returned by the assigned places API.", note)
        : protectedTarget(file, route, note);
}

function dynamicReportTarget(file, route, note) {
    return route === null
        ? unresolved(file, "No submitted audit was returned by the my-audits API.", note)
        : protectedTarget(file, route, note);
}

function unresolved(file, reason, note) {
    return { file, route: "", requiresAuth: true, skipReason: reason, note };
}

function withScreenshotScroll(route, scrollY, scrollDelayMs = null) {
    if (route === null) {
        return null;
    }
    const delimiter = route.includes("?") ? "&" : "?";
    let nextRoute = `${route}${delimiter}__screenshotScrollY=${encodeURIComponent(String(scrollY))}`;
    if (scrollDelayMs !== null) {
        nextRoute += `&__screenshotScrollDelayMs=${encodeURIComponent(String(scrollDelayMs))}`;
    }
    return nextRoute;
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function assertUniqueTargetFiles(deviceType, targets) {
    const seen = new Set();
    for (const target of targets) {
        if (seen.has(target.file)) {
            throw new Error(
                `Duplicate screenshot target filename for ${deviceType}: ${target.file}`,
            );
        }
        seen.add(target.file);
    }
    return targets;
}

function isResolvedPlace(value) {
    return value !== null && typeof value.id === "string" && value.id.length > 0;
}

function isResolvedSubmission(value) {
    return value !== null && typeof value.id === "string" && value.id.length > 0;
}

function selectTargets(targets, targetFilter) {
    if (targetFilter === "all") return targets;
    if (targetFilter === "public") return targets.filter((target) => target.skipLogin);
    if (targetFilter === "protected") return targets.filter((target) => !target.skipLogin);

    const requested = new Set(
        targetFilter
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    );
    return targets.filter((target) => requested.has(target.file));
}

function buildBootstrapUrl(target, options, shouldReset) {
    const url = new URL(`${options.scheme}://__screenshot-bootstrap`);
    const normalizedTarget = extractScreenshotAutomationParams(target.route);

    url.searchParams.set("target", normalizedTarget.route);
    url.searchParams.set("reset", shouldReset ? "1" : "0");
    if (normalizedTarget.scrollY !== null) {
        url.searchParams.set("__screenshotScrollY", normalizedTarget.scrollY);
    }
    url.searchParams.set(
        "__screenshotScrollDelayMs",
        normalizedTarget.scrollDelayMs ?? String(DEFAULT_SCROLL_DELAY_MS),
    );
    if (target.skipLogin) {
        url.searchParams.set("skipLogin", "1");
    } else {
        url.searchParams.set("email", options.email ?? "");
        url.searchParams.set("password", options.password ?? "");
    }
    return url.toString();
}

function extractScreenshotAutomationParams(route) {
    const queryStartIndex = route.indexOf("?");
    if (queryStartIndex === -1) {
        return { route, scrollY: null, scrollDelayMs: null };
    }

    const pathname = route.slice(0, queryStartIndex);
    const queryString = route.slice(queryStartIndex + 1);
    const params = new URLSearchParams(queryString);
    const scrollY = params.get("__screenshotScrollY");
    const scrollDelayMs = params.get("__screenshotScrollDelayMs");

    params.delete("__screenshotScrollY");
    params.delete("__screenshotScrollDelayMs");

    const remainingQuery = params.toString();
    return {
        route: remainingQuery.length > 0 ? `${pathname}?${remainingQuery}` : pathname,
        scrollY,
        scrollDelayMs,
    };
}

function ensureXcrunAvailable() {
    const result = spawnSync("xcrun", ["simctl", "help"], { stdio: "ignore" });
    if (result.error || result.status !== 0) {
        throw new Error(
            "xcrun simctl is unavailable. Install Xcode command-line tools and boot an iOS simulator.",
        );
    }
}

function run(command, args) {
    execFileSync(command, args, { stdio: "inherit" });
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
