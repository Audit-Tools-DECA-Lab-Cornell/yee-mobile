import type { MobileYeeDomainKey, MobileYeeStepNumber } from "./yee-mobile-audit-config";
import { getDomainForStep } from "./yee-mobile-audit-config";
import type { YeeInstrumentResponse } from "./yee-types";

interface RawTextEntry {
    readonly Display: string;
}

interface RawInstrumentSection {
    readonly block: string | undefined;
    readonly title: string | undefined;
    readonly intro_text: string | undefined;
    readonly comment_prompt: string | undefined;
}

interface RawScoringItem {
    readonly item_id: string | undefined;
    readonly base_question_id: string | undefined;
    readonly block: string | undefined;
    readonly block_title: string | undefined;
    readonly item_kind: string | undefined;
    readonly choices: Readonly<Record<string, RawTextEntry>>;
    readonly answers: Readonly<Record<string, RawTextEntry>>;
}

export interface InstrumentOption {
    readonly id: string;
    readonly label: string;
}

export interface InstrumentLogicalQuestion {
    readonly key: string;
    readonly choiceId: string;
    readonly prompt: string;
    readonly presenceItemId: string;
    readonly presenceAnswers: readonly InstrumentOption[];
    readonly conditionItemId: string | null;
    readonly conditionAnswers: readonly InstrumentOption[];
}

export interface InstrumentSectionDefinition {
    readonly domain: MobileYeeDomainKey;
    readonly step: MobileYeeStepNumber;
    readonly title: string;
    readonly blockLabel: string;
    readonly introText: string;
    readonly commentPrompt: string;
    readonly questions: readonly InstrumentLogicalQuestion[];
}

/** A visit-context question (step 1), fully backend-supplied. */
export interface InstrumentContextQuestion {
    readonly id: string;
    readonly prompt: string;
    readonly multiSelect: boolean;
    readonly options: readonly InstrumentOption[];
}

/** One domain row on the youth-weighting step (step 2). */
export interface InstrumentWeightingDomain {
    readonly key: MobileYeeDomainKey;
    readonly label: string;
    readonly prompt: string;
}

/** The youth-weighting step content: intro + scale + per-domain prompts. */
export interface InstrumentWeighting {
    readonly title: string;
    readonly description: string;
    readonly options: readonly InstrumentOption[];
    readonly domains: readonly InstrumentWeightingDomain[];
}

export interface NormalizedInstrument {
    readonly sections: readonly InstrumentSectionDefinition[];
    /** Visit-context questions in display order (excludes auto-generated ids). */
    readonly contextQuestions: readonly InstrumentContextQuestion[];
    readonly weighting: InstrumentWeighting;
    /** Shared "If yes, please rate the condition…" follow-up prompt. */
    readonly conditionPrompt: string;
    /** Prompt for the overall/final comments field before review & submit. */
    readonly finalCommentsPrompt: string;
}

/** Stable ids for the visit-context questions the client binds to draft slices. */
export const CONTEXT_QUESTION_IDS = {
    visitFrequency: "visit_frequency",
    publicAccess: "public_access",
    openHoursAccess: "open_hours_access",
    season: "season",
    weather: "weather",
} as const;

// Defensive fallbacks for the two short inline prompts, used only if a
// pre-migration cached instrument omits them. The backend is the source of
// truth; any fresh fetch overrides these.
const DEFAULT_CONDITION_PROMPT =
    "If yes, please rate the condition that this feature or area is in.";
const DEFAULT_FINAL_COMMENTS_PROMPT = "Overall survey comments";

const DOMAIN_KEYS: readonly MobileYeeDomainKey[] = [
    "access",
    "activitySpaces",
    "amenities",
    "experienceOfSpace",
    "aestheticsAndCare",
    "useAndUsability",
];
const DOMAIN_KEY_SET: ReadonlySet<string> = new Set(DOMAIN_KEYS);

function isDomainKey(value: string): value is MobileYeeDomainKey {
    return DOMAIN_KEY_SET.has(value);
}

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
    source: Readonly<Record<string, unknown>>,
    key: string,
): string | undefined {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
}

function parseTextEntries(value: unknown): Readonly<Record<string, RawTextEntry>> {
    if (!isUnknownRecord(value)) {
        return {};
    }

    const entries: Record<string, RawTextEntry> = {};
    for (const [id, rawEntry] of Object.entries(value)) {
        if (!isUnknownRecord(rawEntry)) {
            continue;
        }
        const display = optionalString(rawEntry, "Display");
        if (display === undefined) {
            continue;
        }
        entries[id] = { Display: display };
    }
    return entries;
}

function parseRawSections(value: unknown): readonly RawInstrumentSection[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((rawSection): readonly RawInstrumentSection[] => {
        if (!isUnknownRecord(rawSection)) {
            return [];
        }
        return [
            {
                block: optionalString(rawSection, "block"),
                title: optionalString(rawSection, "title"),
                intro_text: optionalString(rawSection, "intro_text"),
                comment_prompt: optionalString(rawSection, "comment_prompt"),
            },
        ];
    });
}

function parseRawScoringItems(value: unknown): readonly RawScoringItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((rawItem): readonly RawScoringItem[] => {
        if (!isUnknownRecord(rawItem)) {
            return [];
        }
        return [
            {
                item_id: optionalString(rawItem, "item_id"),
                base_question_id: optionalString(rawItem, "base_question_id"),
                block: optionalString(rawItem, "block"),
                block_title: optionalString(rawItem, "block_title"),
                item_kind: optionalString(rawItem, "item_kind"),
                choices: parseTextEntries(rawItem["choices"]),
                answers: parseTextEntries(rawItem["answers"]),
            },
        ];
    });
}

function toOptionList(
    source: readonly { readonly value?: string; readonly label?: string }[] | undefined,
): readonly InstrumentOption[] {
    if (!Array.isArray(source)) {
        return [];
    }
    return source
        .filter((entry) => entry && typeof entry.value === "string")
        .map((entry) => ({
            id: String(entry.value),
            label: readableLabel(entry.label ?? entry.value ?? ""),
        }));
}

export function normalizeInstrument(instrument: YeeInstrumentResponse): NormalizedInstrument {
    const rawSections = parseRawSections(instrument.sections);
    const rawItems = parseRawScoringItems(instrument.scoring_items);

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
            questions: [],
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

    const normalizedSections = DOMAIN_KEYS.flatMap(
        (domain): readonly InstrumentSectionDefinition[] => {
            const section = sectionsByDomain.get(domain);
            if (section === undefined) {
                return [];
            }

            const grouped = itemsByDomain.get(domain) ?? new Map<string, RawScoringItem[]>();
            const questions = [...grouped.entries()].flatMap(
                ([baseQuestionId, items]): readonly InstrumentLogicalQuestion[] => {
                    const presence = items.find((entry) => entry.item_kind === "presence");
                    if (presence === undefined) {
                        return [];
                    }

                    const condition =
                        items.find((entry) => entry.item_kind === "condition") ?? null;
                    const choices = normalizeOptions(presence.choices ?? {}, "question");
                    const presenceAnswers = normalizeOptions(presence.answers ?? {}, "answer");
                    const conditionAnswers = normalizeOptions(condition?.answers ?? {}, "answer");
                    const presenceItemId = presence.item_id?.trim() || baseQuestionId;
                    const rawConditionItemId = condition?.item_id?.trim() || null;
                    const hasCondition = rawConditionItemId !== null && conditionAnswers.length > 0;

                    return choices.map((choice): InstrumentLogicalQuestion => ({
                        key: `${presenceItemId}:${choice.id}`,
                        choiceId: choice.id,
                        prompt: choice.label,
                        presenceItemId,
                        presenceAnswers,
                        conditionItemId: hasCondition ? rawConditionItemId : null,
                        conditionAnswers: hasCondition ? conditionAnswers : [],
                    }));
                },
            );

            return [
                {
                    ...section,
                    questions,
                },
            ];
        },
    );

    return {
        sections: normalizedSections,
        contextQuestions: normalizeContextQuestions(instrument),
        weighting: normalizeWeighting(instrument),
        conditionPrompt:
            sanitizeRichText(instrument.condition_prompt ?? "") || DEFAULT_CONDITION_PROMPT,
        finalCommentsPrompt:
            sanitizeRichText(instrument.final_comments_prompt ?? "") ||
            DEFAULT_FINAL_COMMENTS_PROMPT,
    };
}

/**
 * Visit-context questions in display order. Auto-generated ids (auditor_id,
 * audit_date) and the weighting question are excluded — the client renders those
 * elsewhere. Each question keeps its backend id so the step can bind it to the
 * matching draft slice.
 */
function normalizeContextQuestions(
    instrument: YeeInstrumentResponse,
): readonly InstrumentContextQuestion[] {
    const raw = Array.isArray(instrument.pre_audit_questions) ? instrument.pre_audit_questions : [];
    return raw
        .filter(
            (question) =>
                question &&
                typeof question.id === "string" &&
                question.auto_generated !== true &&
                question.id !== "importance_weighting",
        )
        .map((question) => ({
            id: String(question.id),
            prompt: sanitizeRichText(question.prompt ?? ""),
            multiSelect: question.multi_select === true,
            options: toOptionList(question.options),
        }));
}

function normalizeWeighting(instrument: YeeInstrumentResponse): InstrumentWeighting {
    const raw = instrument.weighting ?? null;
    const domains = (Array.isArray(raw?.domains) ? raw.domains : []).flatMap(
        (domain): readonly InstrumentWeightingDomain[] =>
            domain && typeof domain.key === "string" && isDomainKey(domain.key)
                ? [
                      {
                          key: domain.key,
                          label: readableLabel(domain.label ?? ""),
                          prompt: sanitizeRichText(domain.prompt ?? ""),
                      },
                  ]
                : [],
    );

    return {
        title: sanitizeRichText(raw?.title ?? ""),
        description: sanitizeRichText(raw?.description ?? ""),
        options: toOptionList(raw?.options),
        domains,
    };
}

/** The context question with this id, or `null` if the instrument omits it. */
export function findContextQuestion(
    instrument: NormalizedInstrument,
    id: string,
): InstrumentContextQuestion | null {
    return instrument.contextQuestions.find((question) => question.id === id) ?? null;
}

/** Display label for a single-select context answer, or "Not answered". */
export function contextAnswerLabel(
    instrument: NormalizedInstrument,
    id: string,
    value: string | null | undefined,
): string {
    if (value === null || value === undefined || String(value).length === 0) {
        return "Not answered";
    }
    const option = findContextQuestion(instrument, id)?.options.find(
        (entry) => entry.id === String(value),
    );
    return option?.label ?? String(value);
}

/** Comma-joined labels for a multi-select context answer, or "Not answered". */
export function contextAnswerLabelList(
    instrument: NormalizedInstrument,
    id: string,
    values: readonly string[],
): string {
    if (values.length === 0) {
        return "Not answered";
    }
    const options = findContextQuestion(instrument, id)?.options ?? [];
    return values
        .map((value) => options.find((entry) => entry.id === value)?.label ?? value)
        .join(", ");
}

/** Display label for a youth-weighting scale value, or "Not answered". */
export function weightOptionLabel(
    instrument: NormalizedInstrument,
    value: string | null | undefined,
): string {
    if (value === null || value === undefined || String(value).trim().length === 0) {
        return "Not answered";
    }
    const option = instrument.weighting.options.find((entry) => entry.id === String(value));
    return option?.label ?? String(value);
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

/**
 * Normalize a choice/answer map into display options.
 *
 * `kind` decides punctuation: `"question"` prompts (the per-row choice labels)
 * get a trailing "?" when the source omits one, while `"answer"` options
 * (Yes / No / Yes, a lot / Poor / Great …) are left verbatim — appending "?" to
 * an answer produced the reported "Yes?" / "No?" labels.
 */
function normalizeOptions(
    source: Readonly<Record<string, RawTextEntry>>,
    kind: "question" | "answer",
): readonly InstrumentOption[] {
    return Object.entries(source).map(([id, value]) => ({
        id,
        label:
            kind === "question"
                ? ensureReadableLabel(value.Display ?? id)
                : readableLabel(value.Display ?? id),
    }));
}

function readableLabel(label: string): string {
    const stripped = sanitizeRichText(label).replace(/\s+/g, " ").trim();
    if (stripped.length === 0) {
        return "Untitled item";
    }

    return stripped.replace(/example:/gi, "Ex:");
}

function ensureReadableLabel(label: string): string {
    const normalized = readableLabel(label);
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
