#!/usr/bin/env node
/**
 * Beta version bumper for the COPA mobile app.
 *
 * Bumps ONLY the human-readable `version` string in `app.config.js`
 * (Android versionName / iOS CFBundleShortVersionString). It never touches the
 * Android `versionCode` - that is owned by EAS (`appVersionSource: "remote"` +
 * `autoIncrement: true` in eas.json) and increments automatically on each build.
 *
 * Versioning policy (full rationale: .claude/memory/mobile-versioning.md):
 *   format            0.MINOR.PATCH, capped under 1.0 until public GA
 *   --minor           "major" change: variety rename, offline-sync/compat, big
 *                     fixes, anything touching native/schema → 0.3.4 -> 0.4.0
 *   --patch           "small" change: colors, copy/i18n, minor UI/fixes → 0.3.4 -> 0.3.5
 *   --set X.Y.Z       set an explicit version
 *   --show            print the current version and exit
 *   --dry-run         compute and print the next version without writing
 *   --go-live         allow crossing into >= 1.0 (the actual public launch)
 *
 * Usage:
 *   node scripts/bump-version.mjs --patch
 *   bun run version:minor
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = resolve(ROOT, "app.config.js");
// Matches the single top-level `version: "X.Y.Z"` in app.config.js (the expo
// app version). Does not match eas.json or the npm package version.
const VERSION_RE = /(version:\s*")(\d+\.\d+\.\d+)(")/;

function fail(message) {
	console.error(`✖ ${message}`);
	process.exit(1);
}

function parseArgs(argv) {
	const flags = new Set();
	let setTo = null;
	for (const arg of argv) {
		if (arg.startsWith("--set=")) {
			setTo = arg.slice("--set=".length);
		} else if (arg === "--set") {
			fail("Use --set=X.Y.Z (with an equals sign).");
		} else {
			flags.add(arg);
		}
	}
	return { flags, setTo };
}

function readCurrent() {
	const source = readFileSync(CONFIG, "utf8");
	const match = source.match(VERSION_RE);
	if (!match) {
		fail(`Could not find a \`version: "X.Y.Z"\` field in ${CONFIG}.`);
	}
	return { source, current: match[2] };
}

function bump(current, { minor, patch, setTo, goLive }) {
	const [major, min, pat] = current.split(".").map((n) => Number.parseInt(n, 10));

	let next;
	if (setTo) {
		if (!/^\d+\.\d+\.\d+$/.test(setTo)) {
			fail(`--set value "${setTo}" must be X.Y.Z.`);
		}
		next = setTo;
	} else if (minor) {
		next = `${major}.${min + 1}.0`;
	} else if (patch) {
		next = `${major}.${min}.${pat + 1}`;
	} else {
		fail("Pick one of: --patch, --minor, --set=X.Y.Z, --show.");
	}

	const nextMajor = Number.parseInt(next.split(".")[0], 10);
	if (nextMajor >= 1 && !goLive) {
		fail(
			`Refusing to set ${next}: the app stays under 1.0 during beta. ` +
				"Pass --go-live only for the real public launch.",
		);
	}
	return next;
}

function releaseHint(current, next) {
	const bumpedMinor = current.split(".")[1] !== next.split(".")[1] || current.split(".")[0] !== next.split(".")[0];
	if (bumpedMinor) {
		return [
			"Minor bump = a “major” change. Most likely needs a NEW BINARY:",
			"  bun run eas:android   # then  bun run submit:android",
			"(If the change is genuinely JS-only and the native fingerprint is unchanged,",
			" EAS will reuse the runtime version and an `eas update` would still apply.)",
		].join("\n");
	}
	return [
		"Patch bump = a small change. If it is JS-only (colors, copy, i18n, minor UI),",
		"ship it over-the-air - no Play review:",
		"  eas update --branch production --message \"v" + next + "\"",
		"If it touched native code/deps, build instead: bun run eas:android",
	].join("\n");
}

function main() {
	const { flags, setTo } = parseArgs(process.argv.slice(2));
	const { source, current } = readCurrent();

	if (flags.has("--show") || flags.has("--help") || flags.has("-h")) {
		console.log(`Current app version: ${current}`);
		if (flags.has("--help") || flags.has("-h")) {
			console.log("\nFlags: --patch | --minor | --set=X.Y.Z | --show | --dry-run | --go-live");
		}
		return;
	}

	const next = bump(current, {
		minor: flags.has("--minor"),
		patch: flags.has("--patch"),
		setTo,
		goLive: flags.has("--go-live"),
	});

	if (next === current) {
		fail(`Version is already ${current}.`);
	}

	if (flags.has("--dry-run")) {
		console.log(`${current} -> ${next}  (dry run, nothing written)`);
		console.log(`\n${releaseHint(current, next)}`);
		return;
	}

	writeFileSync(CONFIG, source.replace(VERSION_RE, `$1${next}$3`), "utf8");
	console.log(`✓ app.config.js version: ${current} -> ${next}`);
	console.log("  (versionCode is managed by EAS - not changed here.)");
	console.log(`\n${releaseHint(current, next)}`);
	console.log(
		"\nGit is left untouched. When ready, commit + tag yourself, e.g.:\n" +
			`  git commit -am "chore(release): v${next}" && git tag v${next}`,
	);
}

main();
