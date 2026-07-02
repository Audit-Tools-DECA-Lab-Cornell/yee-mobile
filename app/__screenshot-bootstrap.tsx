import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Paragraph, Text, YStack } from "tamagui";

import { useDesignSystem } from "lib/design-system";
import { useAuthStore } from "stores/auth-store";

interface ScreenshotBootstrapParams {
    readonly target?: string | string[];
    readonly email?: string | string[];
    readonly password?: string | string[];
    readonly reset?: string | string[];
    readonly skipLogin?: string | string[];
    readonly __screenshotScrollDelayMs?: string | string[];
    readonly __screenshotScrollY?: string | string[];
}

const SCREENSHOT_AUTOMATION_ENABLED = __DEV__;

/**
 * Deep-linkable helper route that prepares auth state before opening a target
 * screen for simulator screenshot automation.
 */
export default function ScreenshotBootstrapScreen() {
    if (!SCREENSHOT_AUTOMATION_ENABLED) {
        return <ScreenshotBootstrapUnavailableScreen />;
    }

    return <EnabledScreenshotBootstrapScreen />;
}

/**
 * Screenshot bootstrap implementation used only in development builds.
 */
function EnabledScreenshotBootstrapScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const params = useLocalSearchParams() as ScreenshotBootstrapParams;

    const authStatus = useAuthStore((state) => state.status);
    const session = useAuthStore((state) => state.session);
    const login = useAuthStore((state) => state.login);
    const logout = useAuthStore((state) => state.logout);
    const clearError = useAuthStore((state) => state.clearError);
    const errorMessage = useAuthStore((state) => state.errorMessage);

    const hasRequestedLogoutRef = useRef<boolean>(false);
    const hasNavigatedRef = useRef<boolean>(false);
    const loginAttemptKeyRef = useRef<string | null>(null);
    const [phaseMessage, setPhaseMessage] = useState<string>("Preparing screenshot route.");

    const targetRoute = useMemo(() => {
        const rawTarget = readSingleParam(params.target);
        if (rawTarget?.startsWith("/") !== true) {
            return "/";
        }
        return rawTarget;
    }, [params.target]);
    const email = useMemo(() => {
        const rawEmail = readSingleParam(params.email);
        if (rawEmail === null) {
            return null;
        }

        const normalizedEmail = rawEmail.trim().toLowerCase();
        return normalizedEmail.length > 0 ? normalizedEmail : null;
    }, [params.email]);
    const password = useMemo(() => {
        const rawPassword = readSingleParam(params.password);
        if (rawPassword === null) {
            return null;
        }

        return rawPassword.length > 0 ? rawPassword : null;
    }, [params.password]);
    const shouldResetSession = useMemo(() => readBooleanParam(params.reset), [params.reset]);
    const shouldSkipLogin = useMemo(() => readBooleanParam(params.skipLogin), [params.skipLogin]);
    const navigationHref = useMemo(() => {
        return appendScreenshotAutomationParams(targetRoute, {
            scrollDelayMs: readSingleParam(params.__screenshotScrollDelayMs),
            scrollY: readSingleParam(params.__screenshotScrollY),
        });
    }, [params.__screenshotScrollDelayMs, params.__screenshotScrollY, targetRoute]);

    /**
     * Navigate to the target screen with a clean stack.
     */
    const navigateToScreenshotTarget = useCallback(() => {
        try {
            router.dismissAll();
        } catch {
            // No dismissable screens in the stack; replacing is enough.
        }
        router.replace(navigationHref as Href);
    }, [navigationHref, router]);

    /**
     * Clear stale auth store errors whenever a new automation request starts.
     */
    useEffect(() => {
        clearError();
        hasRequestedLogoutRef.current = false;
        hasNavigatedRef.current = false;
        loginAttemptKeyRef.current = null;
        setPhaseMessage("Preparing screenshot route.");
    }, [clearError, email, password, shouldResetSession, shouldSkipLogin, targetRoute]);

    /**
     * Reset persisted auth state when the deep link requests a clean session.
     */
    useEffect(() => {
        if (!shouldResetSession || authStatus === "loading") {
            return;
        }

        if (authStatus === "authenticated" && !hasRequestedLogoutRef.current) {
            hasRequestedLogoutRef.current = true;
            setPhaseMessage("Clearing persisted session.");
            logout().catch(() => undefined);
            return;
        }

        if (authStatus === "unauthenticated") {
            setPhaseMessage("Using a clean signed-out session.");
        }
    }, [authStatus, logout, shouldResetSession]);

    /**
     * Sign in the screenshot account when required, then route to the target.
     */
    useEffect(() => {
        if (hasNavigatedRef.current) {
            return;
        }

        if (authStatus === "loading") {
            setPhaseMessage("Waiting for auth state.");
            return;
        }

        if (shouldResetSession && authStatus === "authenticated") {
            return;
        }

        if (shouldSkipLogin) {
            hasNavigatedRef.current = true;
            setPhaseMessage(`Opening ${targetRoute}.`);
            navigateToScreenshotTarget();
            return;
        }

        if (email === null || password === null) {
            setPhaseMessage("Screenshot credentials are missing.");
            return;
        }

        const currentSessionEmail =
            session === null ? null : session.user.email.trim().toLowerCase();
        if (authStatus === "authenticated" && currentSessionEmail === email) {
            hasNavigatedRef.current = true;
            setPhaseMessage(`Opening ${targetRoute}.`);
            navigateToScreenshotTarget();
            return;
        }

        if (authStatus === "authenticated" && currentSessionEmail !== email) {
            setPhaseMessage("A different user is signed in. Retry with reset=1.");
            return;
        }

        const loginAttemptKey = `${email}:${targetRoute}`;
        if (loginAttemptKeyRef.current === loginAttemptKey) {
            return;
        }

        loginAttemptKeyRef.current = loginAttemptKey;
        setPhaseMessage("Signing in screenshot account.");
        clearError();
        login({ email, password }).catch(() => undefined);
    }, [
        authStatus,
        clearError,
        email,
        login,
        navigateToScreenshotTarget,
        password,
        session,
        shouldResetSession,
        shouldSkipLogin,
        targetRoute,
    ]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <YStack
                flex={1}
                items="center"
                justify="center"
                gap="$4"
                px="$5"
                bg={designSystem.colors.background}
            >
                <ActivityIndicator color={designSystem.colors.primary} size="large" />
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={24}
                    style={{ textAlign: "center" }}
                >
                    Screenshot Automation
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    style={{ textAlign: "center" }}
                >
                    {phaseMessage}
                </Paragraph>
                {errorMessage === null ? null : (
                    <Paragraph
                        color={designSystem.colors.danger}
                        fontFamily={designSystem.fonts.bodyMedium}
                        style={{ textAlign: "center" }}
                    >
                        {errorMessage}
                    </Paragraph>
                )}
            </YStack>
        </>
    );
}

/**
 * Production-safe fallback that prevents screenshot automation from running in
 * non-development builds.
 */
function ScreenshotBootstrapUnavailableScreen() {
    const designSystem = useDesignSystem();
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <YStack
                flex={1}
                items="center"
                justify="center"
                gap="$4"
                px="$5"
                bg={designSystem.colors.background}
            >
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={24}
                    style={{ textAlign: "center" }}
                >
                    Route Unavailable
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    style={{ textAlign: "center" }}
                >
                    Screenshot automation is disabled in this build.
                </Paragraph>
            </YStack>
        </>
    );
}

/**
 * Forward screenshot automation params into the target route.
 *
 * @param route Target route path, possibly already carrying a query string.
 * @param values Raw screenshot automation params from the bootstrap route.
 * @returns Route with missing screenshot automation query parameters appended.
 */
function appendScreenshotAutomationParams(
    route: string,
    values: Readonly<{
        scrollDelayMs: string | null;
        scrollY: string | null;
    }>,
): string {
    let nextRoute = route;

    nextRoute = appendQueryParamIfMissing(nextRoute, "__screenshotScrollY", values.scrollY);
    nextRoute = appendQueryParamIfMissing(
        nextRoute,
        "__screenshotScrollDelayMs",
        values.scrollDelayMs,
    );

    return nextRoute;
}

/**
 * Append a query parameter without duplicating an existing value.
 *
 * @param route Target route path, possibly already carrying a query string.
 * @param name Query parameter name.
 * @param value Query parameter value.
 * @returns Route with the query parameter appended when needed.
 */
function appendQueryParamIfMissing(route: string, name: string, value: string | null): string {
    if (value === null || value.length === 0) {
        return route;
    }
    if (route.includes(`${name}=`)) {
        return route;
    }

    const separator = route.includes("?") ? "&" : "?";
    return `${route}${separator}${name}=${encodeURIComponent(value)}`;
}

/**
 * Read a single string query parameter.
 *
 * @param value Raw route parameter value.
 * @returns Single string value or null.
 */
function readSingleParam(value: string | string[] | undefined): string | null {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }
    return null;
}

/**
 * Parse a boolean-like route parameter used by screenshot automation.
 *
 * @param value Raw route parameter value.
 * @returns True for common truthy markers, otherwise false.
 */
function readBooleanParam(value: string | string[] | undefined): boolean {
    const normalizedValue = readSingleParam(value)?.trim().toLowerCase();
    return normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "yes";
}
