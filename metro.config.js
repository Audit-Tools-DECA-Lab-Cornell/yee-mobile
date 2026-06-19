/* global */

// Learn more https://docs.expo.io/guides/customizing-metro

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

/** Hoisted `@tamagui/*` used by Metro (must match top-level installs in package.json). */
const tamaguiHoistedModules = {
    "@tamagui/core": path.resolve(projectRoot, "node_modules/@tamagui/core"),
    "@tamagui/helpers-icon": path.resolve(projectRoot, "node_modules/@tamagui/helpers-icon"),
    "@tamagui/web": path.resolve(projectRoot, "node_modules/@tamagui/web"),
};

const defaultConfig = getDefaultConfig(projectRoot);
defaultConfig.resolver.useWatchman = false;

/**
 * After deduping Tamagui, some cached graphs still pointed at
 * `node_modules/@tamagui/lucide-icons-2/node_modules/@tamagui/helpers-icon/…`, which may no longer exist.
 * Pinning hoisted resolutions avoids Metro SHA-1 failures on phantom nested paths.
 */
defaultConfig.resolver.extraNodeModules = {
    ...(defaultConfig.resolver.extraNodeModules ?? {}),
    ...tamaguiHoistedModules,
};

module.exports = defaultConfig;
