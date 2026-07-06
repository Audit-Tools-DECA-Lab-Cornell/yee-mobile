import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { Platform } from "react-native";

import type { BugReportContext } from "lib/bug-report/types";

/**
 * Route/audit breadcrumbs the caller already knows from navigation state. Only
 * identifiers are accepted - never answer content.
 */
export interface BugReportRouteContext {
    route?: string;
    screen?: string;
    projectId?: string;
    placeId?: string;
    /** The YeeAuditSubmission id of the audit the reporter is in, if any. */
    submissionId?: string;
    sectionId?: string;
    questionId?: string;
    syncPhase?: string;
}

/**
 * Assemble a privacy-filtered diagnostic context for a mobile bug report.
 *
 * This is an allow-list by construction: device, app, locale, network, and the
 * passed-in route/audit identifiers only. It never reads audit answers, notes,
 * tokens, or persisted storage dumps.
 */
export async function buildMobileBugReportContext(
    route: BugReportRouteContext,
): Promise<BugReportContext> {
    const context: BugReportContext = {
        platform: Platform.OS,
        os_version: String(Platform.Version),
        app_version: Constants.expoConfig?.version ?? undefined,
        client_timestamp: new Date().toISOString(),
    };

    if (route.route) context.route = route.route;
    if (route.screen) context.screen = route.screen;
    if (route.projectId) context.project_id = route.projectId;
    if (route.placeId) context.place_id = route.placeId;
    if (route.submissionId) context.yee_submission_id = route.submissionId;
    if (route.sectionId) context.section_id = route.sectionId;
    if (route.questionId) context.question_id = route.questionId;
    if (route.syncPhase) context.sync_phase = route.syncPhase;

    try {
        const state = await NetInfo.fetch();
        context.network_online = state.isConnected !== false && state.isInternetReachable !== false;
        if (state.type) {
            context.network_type = String(state.type);
        }
    } catch {
        /* network probing is best-effort; omit on failure */
    }

    return context;
}

/**
 * Whether the device currently appears online enough to submit. Bug-report
 * submission is online-only, so callers gate on this before sending.
 */
export async function isDeviceOnline(): Promise<boolean> {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected !== false && state.isInternetReachable !== false;
    } catch {
        return false;
    }
}
