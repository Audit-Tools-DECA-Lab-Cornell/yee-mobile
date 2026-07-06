import NetInfo from "@react-native-community/netinfo";
import { useToastController } from "@tamagui/toast";
import { useEffect, useRef } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";

import type { AuthSession } from "lib/auth/types";
import { isDeviceOnline } from "lib/bug-report/context";
import { isBugReportingEnabled } from "lib/bug-report/feature";
import { flushPendingBugReports } from "lib/bug-report/flush";
import { countPendingBugReports } from "lib/bug-report/queue";

/**
 * Ask the auditor whether to submit queued bug reports when the app returns
 * online in the foreground. This replaces background sync: reports stay on the
 * device until the auditor confirms.
 *
 * Runs on the same triggers as queue flushing - first authenticated render,
 * connectivity restored, and foregrounding - but only prompts.
 *
 * @param session The active auth session, or null if signed out.
 * @param isReady Whether auth and local storage are ready for submission.
 */
export function useBugReportFlushPrompt(session: AuthSession | null, isReady: boolean): void {
    const toast = useToastController();
    // Guards against stacking prompts: at most one prompt is live at a time.
    const isPromptingRef = useRef(false);

    useEffect(() => {
        if (!isBugReportingEnabled() || !isReady || session === null) {
            return;
        }

        const maybePrompt = () => {
            if (isPromptingRef.current || countPendingBugReports() === 0) {
                return;
            }
            void (async () => {
                if (!(await isDeviceOnline())) {
                    return;
                }
                const count = countPendingBugReports();
                if (isPromptingRef.current || count === 0) {
                    return;
                }
                isPromptingRef.current = true;
                const noun = count === 1 ? "report" : "reports";
                Alert.alert(
                    "Submit saved reports?",
                    `You have ${count} bug ${noun} saved on this device. Submit ${count === 1 ? "it" : "them"} now?`,
                    [
                        {
                            text: "Later",
                            style: "cancel",
                            onPress: () => {
                                isPromptingRef.current = false;
                            },
                        },
                        {
                            text: "Submit",
                            onPress: () => {
                                void flushPendingBugReports(session)
                                    .then((result) => {
                                        if (result.submitted > 0) {
                                            const sentNoun =
                                                result.submitted === 1
                                                    ? "report was"
                                                    : "reports were";
                                            toast.show(
                                                `${result.submitted} saved ${sentNoun} sent. Thank you.`,
                                            );
                                        }
                                        if (result.failed > 0) {
                                            toast.show(
                                                "Some reports couldn't be sent yet. We'll ask again next time you're online.",
                                            );
                                        }
                                    })
                                    .finally(() => {
                                        isPromptingRef.current = false;
                                    });
                            },
                        },
                    ],
                );
            })();
        };

        maybePrompt();

        const networkSubscription = NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable !== false) {
                maybePrompt();
            }
        });

        const appStateSubscription = AppState.addEventListener("change", (next: AppStateStatus) => {
            if (next === "active") {
                maybePrompt();
            }
        });

        return () => {
            networkSubscription();
            appStateSubscription.remove();
        };
    }, [session, isReady, toast]);
}
