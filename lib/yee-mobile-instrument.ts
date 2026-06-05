import type { MobileYeeDomainKey, MobileYeeStepNumber } from "./yee-mobile-audit-config";
import { getDomainForStep } from "./yee-mobile-audit-config";
import type { YeeInstrumentResponse } from "./yee-types";

interface RawTextEntry {
    readonly Display?: string;
}

interface RawInstrumentSection {
    readonly block?: string;
    readonly title?: string;
    readonly intro_text?: string;
    readonly comment_prompt?: string;
}

interface RawScoringItem {
    readonly item_id?: string;
    readonly base_question_id?: string;
    readonly block?: string;
    readonly block_title?: string;
    readonly question_text?: string;
    readonly item_kind?: string;
    readonly choices?: Record<string, RawTextEntry>;
    readonly answers?: Record<string, RawTextEntry>;
}

export interface InstrumentOption {
    readonly id: string;
    readonly label: string;
}

export interface InstrumentPromptRow {
    readonly choiceId: string;
    readonly label: string;
    readonly presenceItemId: string;
    readonly presenceAnswers: readonly InstrumentOption[];
    readonly conditionItemId: string | null;
    readonly conditionAnswers: readonly InstrumentOption[];
}

export interface InstrumentPromptGroup {
    readonly id: string;
    readonly instruction: string | null;
    readonly rows: readonly InstrumentPromptRow[];
}

export interface InstrumentSectionDefinition {
    readonly domain: MobileYeeDomainKey;
    readonly step: MobileYeeStepNumber;
    readonly title: string;
    readonly blockLabel: string;
    readonly introText: string;
    readonly commentPrompt: string;
    readonly groups: readonly InstrumentPromptGroup[];
}

export interface NormalizedInstrument {
    readonly sections: readonly InstrumentSectionDefinition[];
}

export function normalizeInstrument(instrument: YeeInstrumentResponse): NormalizedInstrument {
    const rawSections = Array.isArray((instrument as { sections?: unknown }).sections)
        ? ((instrument as { sections: unknown[] }).sections as RawInstrumentSection[])
        : [];
    const rawItems = Array.isArray((instrument as { scoring_items?: unknown }).scoring_items)
        ? ((instrument as { scoring_items: unknown[] }).scoring_items as RawScoringItem[])
        : [];

    const sectionsByDomain = new Map<MobileYeeDomainKey, InstrumentSectionDefinition>();
    for (const rawSection of rawSections) {
        const domain = blockToDomain(rawSection.block ?? rawSection.title ?? "");
        if (domain === null) {
            continue;
        }

        const step = domainToStep(domain);
        if (step === null) {
            continue;
        }

        sectionsByDomain.set(domain, {
            domain,
            step,
            title: rawSection.title?.trim() || fallbackTitle(domain),
            blockLabel:
                rawSection.block?.trim() || rawSection.title?.trim() || fallbackTitle(domain),
            introText: sanitizeRichText(rawSection.intro_text ?? ""),
            commentPrompt: sanitizeRichText(
                rawSection.comment_prompt ?? "Optional comments for this section.",
            ),
            groups: [],
        });
    }

    const itemsByDomain = new Map<MobileYeeDomainKey, Map<string, RawScoringItem[]>>();
    for (const item of rawItems) {
        const domain = blockToDomain(item.block ?? item.block_title ?? "");
        const baseQuestionId = item.base_question_id?.trim();
        if (domain === null || baseQuestionId === undefined || baseQuestionId.length === 0) {
            continue;
        }

        const grouped = itemsByDomain.get(domain) ?? new Map<string, RawScoringItem[]>();
        grouped.set(baseQuestionId, [...(grouped.get(baseQuestionId) ?? []), item]);
        itemsByDomain.set(domain, grouped);
    }

    const normalizedSections = (Object.keys(DOMAIN_ORDER) as MobileYeeDomainKey[])
        .map((domain) => {
            const section = sectionsByDomain.get(domain);
            if (section === undefined) {
                return null;
            }

            const grouped = itemsByDomain.get(domain) ?? new Map<string, RawScoringItem[]>();
            const groups = [...grouped.entries()].map(([baseQuestionId, items]) => {
                const presence = items.find((entry) => entry.item_kind === "presence") ?? items[0];
                const condition = items.find((entry) => entry.item_kind === "condition") ?? null;
                const choices = normalizeOptions(presence?.choices ?? {});
                const presenceAnswers = normalizeOptions(presence?.answers ?? {});
                const conditionAnswers = normalizeOptions(condition?.answers ?? {});
                const instruction = normalizeInstruction(presence?.question_text ?? "");

                return {
                    id: baseQuestionId,
                    instruction,
                    rows: choices.map((choice) => ({
                        choiceId: choice.id,
                        label: choice.label,
                        presenceItemId: presence?.item_id?.trim() || baseQuestionId,
                        presenceAnswers,
                        conditionItemId: condition?.item_id?.trim() || null,
                        conditionAnswers,
                    })),
                } satisfies InstrumentPromptGroup;
            });

            return {
                ...section,
                groups,
            } satisfies InstrumentSectionDefinition;
        })
        .filter(Boolean) as InstrumentSectionDefinition[];

    return { sections: normalizedSections };
}

export function getSectionForStep(
    instrument: NormalizedInstrument,
    step: MobileYeeStepNumber,
): InstrumentSectionDefinition | null {
    const domain = getDomainForStep(step);
    if (domain === null) {
        return null;
    }

    return instrument.sections.find((section) => section.domain === domain) ?? null;
}

export function answerLabel(
    options: readonly InstrumentOption[],
    id: string | undefined,
): string | null {
    if (id === undefined) {
        return null;
    }

    return options.find((option) => option.id === id)?.label ?? null;
}

export function isAffirmativeAnswer(
    options: readonly InstrumentOption[],
    answerId: string | undefined,
): boolean {
    const label = answerLabel(options, answerId)?.toLowerCase() ?? "";
    return label.startsWith("yes") || label.includes("yes,") || label === "yes";
}

function normalizeInstruction(text: string): string | null {
    const cleaned = sanitizeRichText(text);
    if (cleaned.length === 0) {
        return null;
    }

    const lowered = cleaned.toLowerCase();
    if (lowered.includes("click to write the question text")) {
        return null;
    }

    return cleaned;
}

function normalizeOptions(source: Record<string, RawTextEntry>): readonly InstrumentOption[] {
    return Object.entries(source).map(([id, value]) => ({
        id,
        label: ensureReadableLabel(value.Display ?? id),
    }));
}

function ensureReadableLabel(label: string): string {
    const stripped = sanitizeRichText(label).replace(/\s+/g, " ").trim();
    if (stripped.length === 0) {
        return "Untitled item";
    }

    const normalized = stripped.replace(/example:/gi, "Ex:");
    return /[?!.]$/.test(normalized) ? normalized : `${normalized}?`;
}

function sanitizeRichText(value: string): string {
    return value
        .replace(/<br\s*\/?>(\s*)/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function fallbackTitle(domain: MobileYeeDomainKey): string {
    return DOMAIN_ORDER[domain];
}

function blockToDomain(value: string): MobileYeeDomainKey | null {
    const normalized = value.toLowerCase();
    if (normalized.includes("access")) return "access";
    if (normalized.includes("activity spaces")) return "activitySpaces";
    if (normalized.includes("amenities")) return "amenities";
    if (normalized.includes("experience")) return "experienceOfSpace";
    if (normalized.includes("aesthetics")) return "aestheticsAndCare";
    if (normalized.includes("use & usability") || normalized.includes("use and usability"))
        return "useAndUsability";
    return null;
}

function domainToStep(domain: MobileYeeDomainKey): MobileYeeStepNumber | null {
    return (
        {
            access: 3,
            activitySpaces: 4,
            amenities: 5,
            experienceOfSpace: 6,
            aestheticsAndCare: 7,
            useAndUsability: 8,
        } as const
    )[domain];
}

const DOMAIN_ORDER: Record<MobileYeeDomainKey, string> = {
    access: "Access",
    activitySpaces: "Activity Spaces",
    amenities: "Amenities",
    experienceOfSpace: "Experience of the Space",
    aestheticsAndCare: "Aesthetics & Care",
    useAndUsability: "Use & Usability",
};
