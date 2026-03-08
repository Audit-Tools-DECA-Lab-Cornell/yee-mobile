import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_WEB_BUILD_DIRECTORY = "dist";
const DEFAULT_BUNDLE_BUDGET_MB = 16;

/**
 * Parse bundle budget from CLI environment with safe fallback.
 *
 * @returns Budget in bytes.
 */
function resolveBundleBudgetInBytes() {
    const configuredBudget = process.env.WEB_BUNDLE_BUDGET_MB;
    if (typeof configuredBudget === "string" && configuredBudget.trim().length > 0) {
        const parsedBudget = Number.parseFloat(configuredBudget);
        if (Number.isFinite(parsedBudget) && parsedBudget > 0) {
            return Math.round(parsedBudget * 1024 * 1024);
        }
    }

    return DEFAULT_BUNDLE_BUDGET_MB * 1024 * 1024;
}

/**
 * Recursively calculate directory size in bytes.
 *
 * @param directoryPath Directory path to measure.
 * @returns Total size in bytes.
 */
async function getDirectorySizeInBytes(directoryPath) {
    const directoryEntries = await readdir(directoryPath, { withFileTypes: true });

    let totalSize = 0;
    for (const entry of directoryEntries) {
        const fullPath = join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            totalSize += await getDirectorySizeInBytes(fullPath);
            continue;
        }

        if (entry.isFile()) {
            const fileStats = await stat(fullPath);
            totalSize += fileStats.size;
        }
    }

    return totalSize;
}

/**
 * Convert bytes to readable MB text.
 *
 * @param bytes Bytes to format.
 * @returns Rounded MB string.
 */
function formatBytesAsMegabytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
    const bundleBudgetInBytes = resolveBundleBudgetInBytes();
    const bundleSizeInBytes = await getDirectorySizeInBytes(DEFAULT_WEB_BUILD_DIRECTORY);

    if (bundleSizeInBytes > bundleBudgetInBytes) {
        throw new Error(
            [
                "Web bundle budget exceeded.",
                `Build size: ${formatBytesAsMegabytes(bundleSizeInBytes)}.`,
                `Budget: ${formatBytesAsMegabytes(bundleBudgetInBytes)}.`,
            ].join(" "),
        );
    }

    console.log(
        [
            "Web bundle budget check passed.",
            `Build size: ${formatBytesAsMegabytes(bundleSizeInBytes)}.`,
            `Budget: ${formatBytesAsMegabytes(bundleBudgetInBytes)}.`,
        ].join(" "),
    );
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown web bundle budget error.";
    console.error(message);
    process.exit(1);
});
