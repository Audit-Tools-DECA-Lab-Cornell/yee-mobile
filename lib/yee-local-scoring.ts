import type { YeeInstrumentResponse, YeeScoreResult } from "./yee-types";

const TOTAL_CATEGORY_NAME = "Score";

interface RawScoringRow {
    readonly choice_id: string | null;
    readonly answer_id: string | null;
    readonly scores_by_category_id: Record<string, number>;
}

interface RawScoringItem {
    readonly item_id?: string;
    readonly block?: string;
    readonly score_entries?: readonly RawScoringRow[];
}

export function scoreYeeResponsesLocally(
    instrument: YeeInstrumentResponse | Record<string, unknown>,
    responses: Record<string, unknown>,
): YeeScoreResult {
    const scoringCategories = readScoringCategories(instrument);
    const scoringItems = readScoringItems(instrument);

    const categoryTotals: Record<string, number> = {};
    for (const categoryName of Object.values(scoringCategories)) {
        categoryTotals[categoryName] = 0;
    }

    const scoreRowsByItem = new Map<string, readonly RawScoringRow[]>();
    const sectionByItem = new Map<string, string>();

    for (const item of scoringItems) {
        const itemId = readString(item.item_id);
        const block = readString(item.block);
        if (itemId === null || block === null || !Array.isArray(item.score_entries)) {
            continue;
        }

        scoreRowsByItem.set(itemId, item.score_entries);
        sectionByItem.set(itemId, block);
    }

    const sectionTotals: Record<string, number> = {};
    let matchedScoredAnswers = 0;

    function applyMatch(itemId: string, choiceId: string | null, answerId: string | null) {
        const rows = scoreRowsByItem.get(itemId);
        const sectionName = sectionByItem.get(itemId);
        if (!rows || sectionName === undefined) {
            return;
        }

        if (!(sectionName in sectionTotals)) {
            sectionTotals[sectionName] = 0;
        }

        for (const row of rows) {
            if (normalizeString(row.choice_id) !== choiceId) {
                continue;
            }

            const rowAnswerId = normalizeString(row.answer_id);
            if (rowAnswerId !== null && rowAnswerId !== answerId) {
                continue;
            }

            matchedScoredAnswers += 1;
            let rowTotal = 0;

            for (const [categoryId, rawScore] of Object.entries(row.scores_by_category_id ?? {})) {
                const categoryName = scoringCategories[categoryId];
                if (categoryName === undefined) {
                    continue;
                }

                const scoreValue = Number(rawScore) || 0;
                categoryTotals[categoryName] = (categoryTotals[categoryName] ?? 0) + scoreValue;
                if (categoryName === TOTAL_CATEGORY_NAME) {
                    rowTotal += scoreValue;
                }
            }

            sectionTotals[sectionName] = (sectionTotals[sectionName] ?? 0) + rowTotal;
            break;
        }
    }

    for (const [itemId, rawAnswer] of Object.entries(responses)) {
        if (typeof rawAnswer === "string") {
            applyMatch(itemId, normalizeString(rawAnswer), null);
            continue;
        }

        if (typeof rawAnswer === "object" && rawAnswer !== null && !Array.isArray(rawAnswer)) {
            for (const [choiceId, answerId] of Object.entries(rawAnswer)) {
                applyMatch(itemId, normalizeString(choiceId), normalizeString(answerId));
            }
        }
    }

    return {
        total_score: categoryTotals[TOTAL_CATEGORY_NAME] ?? 0,
        section_scores: sectionTotals,
        category_scores: categoryTotals,
        matched_scored_answers: matchedScoredAnswers,
    };
}

function readScoringCategories(
    instrument: YeeInstrumentResponse | Record<string, unknown>,
): Record<string, string> {
    const rawCategories = (instrument as { scoring_categories?: unknown }).scoring_categories;
    if (!rawCategories || typeof rawCategories !== "object" || Array.isArray(rawCategories)) {
        return {};
    }

    const categories: Record<string, string> = {};
    for (const [categoryId, categoryName] of Object.entries(
        rawCategories as Record<string, unknown>,
    )) {
        if (typeof categoryName === "string" && categoryName.trim().length > 0) {
            categories[categoryId] = categoryName.trim();
        }
    }
    return categories;
}

function readScoringItems(
    instrument: YeeInstrumentResponse | Record<string, unknown>,
): readonly RawScoringItem[] {
    const rawItems = (instrument as { scoring_items?: unknown }).scoring_items;
    if (!Array.isArray(rawItems)) {
        return [];
    }

    return rawItems as RawScoringItem[];
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : null;
}
