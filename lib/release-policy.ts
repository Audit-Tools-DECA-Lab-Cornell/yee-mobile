import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { z } from "zod";

import { getApiBaseUrl } from "lib/yee-api";
import {
    evaluateReleasePolicy,
    type InstalledRelease,
    type MobilePlatform,
    type MobileReleasePolicyResponse,
    type ReleasePolicyDecision,
} from "lib/release-policy-core";

const platformReleasePolicySchema = z.object({
    latest_version: z.string().min(1),
    minimum_supported_version: z.string().min(1),
    latest_build: z.number().int().positive().nullable(),
    minimum_supported_build: z.number().int().positive().nullable(),
    update_url: z.string().url(),
});

const mobileReleasePolicySchema = z.object({
    product: z.literal("yee"),
    message: z.string().min(1),
    android: platformReleasePolicySchema,
    ios: platformReleasePolicySchema,
});

export type ReleasePolicyGateState =
    | { readonly status: "loading"; readonly retry: () => void }
    | { readonly status: "allowed"; readonly retry: () => void }
    | {
          readonly status: "blocked";
          readonly decision: ReleasePolicyDecision;
          readonly retry: () => void;
      };

export function useReleasePolicyGate(): ReleasePolicyGateState {
    const [state, setState] = useState<ReleasePolicyGateState["status"]>("loading");
    const [blockedDecision, setBlockedDecision] = useState<ReleasePolicyDecision | null>(null);
    const [checkNonce, setCheckNonce] = useState(0);

    const retry = useCallback(() => {
        setState("loading");
        setCheckNonce((current) => current + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;

        fetchMobileReleasePolicy()
            .then((policy) => {
                if (!isMounted) {
                    return;
                }

                const decision = evaluateReleasePolicy(policy, getInstalledRelease());
                setBlockedDecision(decision.shouldBlock ? decision : null);
                setState(decision.shouldBlock ? "blocked" : "allowed");
            })
            .catch(() => {
                if (isMounted) {
                    setBlockedDecision(null);
                    setState("allowed");
                }
            });

        return () => {
            isMounted = false;
        };
    }, [checkNonce]);

    if (state === "blocked" && blockedDecision !== null) {
        return { status: "blocked", decision: blockedDecision, retry };
    }

    if (state === "loading") {
        return { status: "loading", retry };
    }

    return { status: "allowed", retry };
}

async function fetchMobileReleasePolicy(): Promise<MobileReleasePolicyResponse> {
    const response = await fetch(`${getApiBaseUrl()}/yee/mobile-release-policy`, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error("Mobile release policy request failed.");
    }

    const payload = (await response.json()) as unknown;
    return mobileReleasePolicySchema.parse(payload);
}

function getInstalledRelease(): InstalledRelease {
    const platform: MobilePlatform = Platform.OS === "ios" ? "ios" : "android";
    const platformConstants = Constants.platform;
    const buildNumber =
        platform === "ios"
            ? (platformConstants?.ios?.buildNumber ?? null)
            : (platformConstants?.android?.versionCode?.toString() ?? null);

    return {
        platform,
        version: Constants.expoConfig?.version ?? null,
        buildNumber,
    };
}
