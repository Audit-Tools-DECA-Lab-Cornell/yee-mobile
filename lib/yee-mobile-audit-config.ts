export type MobileYeeStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type MobileYeeDomainKey =
    | "access"
    | "activitySpaces"
    | "amenities"
    | "experienceOfSpace"
    | "aestheticsAndCare"
    | "useAndUsability";

export const mobileYeeSteps: { step: MobileYeeStepNumber; title: string; description: string }[] = [
    { step: 1, title: "Context", description: "Record the visit details for this place." },
    { step: 2, title: "Weighting", description: "Tell us how important each domain is to you." },
    { step: 3, title: "Access", description: "Complete the Access questions." },
    { step: 4, title: "Activity Spaces", description: "Complete the Activity Spaces questions." },
    { step: 5, title: "Amenities", description: "Complete the Amenities questions." },
    {
        step: 6,
        title: "Experience",
        description: "Complete the Experience of the Space questions.",
    },
    {
        step: 7,
        title: "Aesthetics & Care",
        description: "Complete the Aesthetics & Care questions.",
    },
    { step: 8, title: "Use & Usability", description: "Complete the Use & Usability questions." },
    { step: 9, title: "Final Comments", description: "Add any overall comments before review." },
];

export const mobileYeeDomainLabels: Record<MobileYeeDomainKey, string> = {
    access: "Access",
    activitySpaces: "Activity Spaces",
    amenities: "Amenities",
    experienceOfSpace: "Experience of the Space",
    aestheticsAndCare: "Aesthetics & Care",
    useAndUsability: "Use & Usability",
};

export const mobileYeeWeightOptions = [
    { value: "3", label: "Very important to me" },
    { value: "2", label: "Somewhat important to me" },
    { value: "1", label: "Not really important to me" },
] as const;

export const visitFrequencyOptions = [
    { value: "never-before", label: "I have never been here before" },
    { value: "every-or-almost-every-day", label: "Every day or almost every day" },
    { value: "once-or-twice-a-week", label: "Once or twice a week" },
    { value: "once-or-twice-a-month", label: "Once or twice a month" },
    { value: "few-times-less-than-monthly", label: "Only a few times (less than once a month)" },
    { value: "not-in-last-6-months", label: "I have not been here in the last 6 months" },
] as const;

export const publicAccessOptions = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "not-sure", label: "I'm not sure" },
] as const;

export const openHoursAccessOptions = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "not-sure", label: "I'm not sure" },
] as const;

export const seasonOptions = [
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "autumn", label: "Autumn" },
    { value: "winter", label: "Winter" },
] as const;

export function getOptionLabel(
    options: readonly { value: string; label: string }[],
    value: string | number | null | undefined,
): string {
    if (value === null || value === undefined) {
        return "Not answered";
    }

    const normalized = String(value);
    return options.find((option) => option.value === normalized)?.label ?? normalized;
}

export function getWeightLabel(value: string | number | null | undefined): string {
    return getOptionLabel(mobileYeeWeightOptions, value);
}

export function getWeightNumber(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return "Not answered";
    }

    const normalized = String(value).trim();
    return normalized.length === 0 ? "Not answered" : normalized;
}

export function getVisitFrequencyLabel(value: string | null | undefined): string {
    return getOptionLabel(visitFrequencyOptions, value);
}

export function getSeasonLabel(value: string | null | undefined): string {
    return getOptionLabel(seasonOptions, value);
}

export function getPublicAccessLabel(value: string | null | undefined): string {
    return getOptionLabel(publicAccessOptions, value);
}

export function getOpenHoursAccessLabel(value: string | null | undefined): string {
    return getOptionLabel(openHoursAccessOptions, value);
}

/**
 * Narrow a raw key from the cached instrument to one of the six scored domains.
 * Anything else (a key a future instrument adds, a typo) is not a domain and
 * must render neutral rather than borrow another domain's colour.
 */
export function asMobileYeeDomainKey(key: string | null | undefined): MobileYeeDomainKey | null {
    if (!key) return null;
    return Object.hasOwn(mobileYeeDomainLabels, key) ? (key as MobileYeeDomainKey) : null;
}

export function getDomainForStep(step: MobileYeeStepNumber): MobileYeeDomainKey | null {
    switch (step) {
        case 3:
            return "access";
        case 4:
            return "activitySpaces";
        case 5:
            return "amenities";
        case 6:
            return "experienceOfSpace";
        case 7:
            return "aestheticsAndCare";
        case 8:
            return "useAndUsability";
        default:
            return null;
    }
}

export function getStepTitle(step: MobileYeeStepNumber): string {
    return mobileYeeSteps.find((entry) => entry.step === step)?.title ?? `Step ${step}`;
}

export function getNextStep(step: MobileYeeStepNumber): MobileYeeStepNumber | null {
    return step < 9 ? ((step + 1) as MobileYeeStepNumber) : null;
}

export function getPreviousStep(step: MobileYeeStepNumber): MobileYeeStepNumber | null {
    return step > 1 ? ((step - 1) as MobileYeeStepNumber) : null;
}

export function ensureQuestionMark(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }

    // Already terminated, or already a question mid-string (e.g. a prompt whose
    // "?" is followed by a parenthetical example). Don't append a second mark.
    if (/[?!.]$/.test(trimmed) || trimmed.includes("?")) {
        return trimmed;
    }

    return `${trimmed}?`;
}
