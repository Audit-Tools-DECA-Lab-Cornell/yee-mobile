import { getDeviceIdentity } from "./device-identity";
import type { MobileYeeDomainKey } from "./yee-mobile-audit-config";
import {
    YEE_DRAFT_SCHEMA_VERSION,
    type YeeAuditStateResponse,
    type YeeLocalDraft,
    type YeeScoreResult,
} from "./yee-types";

export interface MobileAuditFormState {
    readonly placeId: string;
    readonly placeName: string;
    readonly auditorId: string;
    /** Optional study/workshop participant ID linking this audit to a person. */
    readonly participantId: string;
    readonly auditDate: string;
    readonly startTime: string;
    readonly finishTime: string;
    readonly totalMinutes: number;
    readonly visitFrequency: string;
    readonly publicAccess: string;
    readonly openHoursAccess: string;
    readonly season: string;
    readonly weather: readonly string[];
    readonly weights: Record<MobileYeeDomainKey, string>;
    readonly weightingComments: string;
    readonly responses: Record<string, Record<string, string>>;
    readonly comments: string;
    readonly sectionComments: Record<MobileYeeDomainKey, string>;
    readonly submittedAt: string | null;
}

export function createEmptyFormState(
    placeId: string,
    placeName: string,
    auditorId: string,
): MobileAuditFormState {
    const startedAt = new Date();
    return {
        placeId,
        placeName,
        auditorId,
        participantId: "",
        auditDate: startedAt.toISOString().slice(0, 10),
        startTime: startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        finishTime: "",
        totalMinutes: 0,
        visitFrequency: "",
        publicAccess: "",
        openHoursAccess: "",
        season: "",
        weather: [],
        weights: emptyWeights(),
        weightingComments: "",
        responses: {},
        comments: "",
        sectionComments: emptySectionComments(),
        submittedAt: null,
    };
}

export function buildFormStateFromSources(input: {
    placeId: string;
    placeName: string;
    auditorId: string;
    storedDraft?: YeeLocalDraft | null;
    auditState?: YeeAuditStateResponse | null;
}): MobileAuditFormState {
    const base = createEmptyFormState(input.placeId, input.placeName, input.auditorId);
    const draftPayload =
        input.storedDraft?.participantInfo ?? input.auditState?.participant_info ?? {};
    const responsesPayload =
        input.storedDraft?.responses ??
        (isRecord(input.auditState?.responses) ? input.auditState?.responses : {});
    const domainWeights = isRecord(draftPayload.domain_weights) ? draftPayload.domain_weights : {};
    const sectionComments = isRecord(draftPayload.section_comments)
        ? draftPayload.section_comments
        : {};

    return {
        ...base,
        placeName: asString(draftPayload.place_name) ?? input.placeName,
        auditorId:
            asString(draftPayload.auditor_id) ??
            asString(input.auditState?.auditor_generated_id) ??
            input.auditorId,
        participantId: asString(draftPayload.participant_id) ?? "",
        auditDate: asString(draftPayload.audit_date) ?? base.auditDate,
        startTime: asString(draftPayload.start_time) ?? base.startTime,
        finishTime: asString(draftPayload.finish_time) ?? "",
        totalMinutes: asNumber(draftPayload.total_minutes) ?? 0,
        visitFrequency: asString(draftPayload.visit_frequency) ?? "",
        publicAccess: asString(draftPayload.public_access) ?? "",
        openHoursAccess: asString(draftPayload.open_hours_access) ?? "",
        season: asString(draftPayload.season) ?? "",
        weather: splitCsv(asString(draftPayload.weather)),
        weights: {
            access: asString(domainWeights.access) ?? "",
            activitySpaces: asString(domainWeights.activitySpaces) ?? "",
            amenities: asString(domainWeights.amenities) ?? "",
            experienceOfSpace: asString(domainWeights.experienceOfSpace) ?? "",
            aestheticsAndCare: asString(domainWeights.aestheticsAndCare) ?? "",
            useAndUsability: asString(domainWeights.useAndUsability) ?? "",
        },
        weightingComments: asString(draftPayload.weighting_comments) ?? "",
        responses: normalizeResponses(responsesPayload),
        comments: asString(draftPayload.comments) ?? "",
        sectionComments: {
            access: asString(sectionComments.access) ?? "",
            activitySpaces: asString(sectionComments.activitySpaces) ?? "",
            amenities: asString(sectionComments.amenities) ?? "",
            experienceOfSpace: asString(sectionComments.experienceOfSpace) ?? "",
            aestheticsAndCare: asString(sectionComments.aestheticsAndCare) ?? "",
            useAndUsability: asString(sectionComments.useAndUsability) ?? "",
        },
        submittedAt: asString(input.auditState?.submitted_at) ?? null,
    };
}

export function buildStoredDraft(
    state: MobileAuditFormState,
    previousDraft: YeeLocalDraft | null,
    scorePreview: YeeScoreResult | null,
    syncState: YeeLocalDraft["syncState"],
): YeeLocalDraft {
    const nowIso = new Date().toISOString();
    const nextVersion = (previousDraft?.version ?? 0) + 1;

    return {
        id: previousDraft?.id ?? state.placeId,
        schemaVersion: YEE_DRAFT_SCHEMA_VERSION,
        version: nextVersion,
        placeId: state.placeId,
        updatedAt: nowIso,
        lastUpdatedIso: nowIso,
        participantInfo: buildParticipantInfo(state),
        responses: state.responses,
        lastKnownBackendStatus: previousDraft?.lastKnownBackendStatus ?? "DRAFT",
        lastKnownSubmissionId: previousDraft?.lastKnownSubmissionId ?? null,
        scorePreview,
        syncState,
    };
}

export function buildParticipantInfo(state: MobileAuditFormState): Record<string, unknown> {
    // Stamped fresh on every save so the payload always reflects the device the
    // audit was last worked on. tablet_id is the physical label entered in
    // Settings → Device; the OS id and model are automatic backups.
    const device = getDeviceIdentity();
    return {
        auditor_id: state.auditorId,
        participant_id: state.participantId,
        tablet_id: device.tablet_id,
        os_device_id: device.os_device_id,
        device_model: device.device_model,
        place_id: state.placeId,
        place_name: state.placeName,
        audit_date: state.auditDate,
        start_time: state.startTime,
        finish_time: state.finishTime,
        total_minutes: state.totalMinutes,
        visit_frequency: state.visitFrequency,
        public_access: state.publicAccess,
        open_hours_access: state.openHoursAccess,
        season: state.season,
        weather: state.weather.join(","),
        domain_weights: state.weights,
        weighting_comments: state.weightingComments,
        comments: state.comments,
        section_comments: state.sectionComments,
    };
}

function normalizeResponses(raw: Record<string, unknown>): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    for (const [itemId, value] of Object.entries(raw)) {
        if (!isRecord(value)) {
            continue;
        }

        const nested: Record<string, string> = {};
        for (const [choiceId, answerId] of Object.entries(value)) {
            const normalized = asString(answerId);
            if (normalized !== null) {
                nested[choiceId] = normalized;
            }
        }
        result[itemId] = nested;
    }
    return result;
}

function emptyWeights(): Record<MobileYeeDomainKey, string> {
    return {
        access: "",
        activitySpaces: "",
        amenities: "",
        experienceOfSpace: "",
        aestheticsAndCare: "",
        useAndUsability: "",
    };
}

function emptySectionComments(): Record<MobileYeeDomainKey, string> {
    return {
        access: "",
        activitySpaces: "",
        amenities: "",
        experienceOfSpace: "",
        aestheticsAndCare: "",
        useAndUsability: "",
    };
}

function splitCsv(value: string | null): readonly string[] {
    if (value === null || value.trim().length === 0) {
        return [];
    }

    return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
