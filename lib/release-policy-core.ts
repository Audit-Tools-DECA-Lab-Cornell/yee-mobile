export type MobilePlatform = "android" | "ios";

export interface PlatformReleasePolicy {
    readonly latest_version: string;
    readonly minimum_supported_version: string;
    readonly latest_build: number | null;
    readonly minimum_supported_build: number | null;
    readonly update_url: string;
}

export interface MobileReleasePolicyResponse {
    readonly product: "playspace" | "yee";
    readonly message: string;
    readonly android: PlatformReleasePolicy;
    readonly ios: PlatformReleasePolicy;
}

export interface InstalledRelease {
    readonly platform: MobilePlatform;
    readonly version: string | null;
    readonly buildNumber: string | null;
}

export interface ReleasePolicyDecision {
    readonly shouldBlock: boolean;
    readonly message: string;
    readonly latestVersion: string;
    readonly updateUrl: string;
    readonly reason: "build" | "version" | null;
}

export function evaluateReleasePolicy(
    policy: MobileReleasePolicyResponse,
    installed: InstalledRelease,
): ReleasePolicyDecision {
    const platformPolicy = policy[installed.platform];
    const minimumBuild = platformPolicy.minimum_supported_build;
    const installedBuild = parseBuildNumber(installed.buildNumber);

    if (minimumBuild !== null && installedBuild !== null && installedBuild < minimumBuild) {
        return {
            shouldBlock: true,
            message: policy.message,
            latestVersion: platformPolicy.latest_version,
            updateUrl: platformPolicy.update_url,
            reason: "build",
        };
    }

    if (
        installed.version !== null &&
        compareAppVersions(installed.version, platformPolicy.minimum_supported_version) < 0
    ) {
        return {
            shouldBlock: true,
            message: policy.message,
            latestVersion: platformPolicy.latest_version,
            updateUrl: platformPolicy.update_url,
            reason: "version",
        };
    }

    return {
        shouldBlock: false,
        message: policy.message,
        latestVersion: platformPolicy.latest_version,
        updateUrl: platformPolicy.update_url,
        reason: null,
    };
}

export function compareAppVersions(left: string, right: string): number {
    const leftParts = parseVersionParts(left);
    const rightParts = parseVersionParts(right);
    const partCount = Math.max(leftParts.length, rightParts.length, 3);

    for (let index = 0; index < partCount; index += 1) {
        const leftPart = leftParts[index] ?? 0;
        const rightPart = rightParts[index] ?? 0;

        if (leftPart < rightPart) return -1;
        if (leftPart > rightPart) return 1;
    }

    return 0;
}

function parseVersionParts(value: string): readonly number[] {
    return value
        .split(/[.-]/)
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part) && part >= 0);
}

function parseBuildNumber(value: string | null): number | null {
    if (value === null) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}
