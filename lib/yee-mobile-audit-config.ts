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

export const seasonOptions = [
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "autumn", label: "Autumn" },
    { value: "winter", label: "Winter" },
] as const;

export const weatherOptions = [
    { value: "sunny-mostly-sunny", label: "Sunny / Mostly sunny" },
    { value: "mostly-cloudy-overcast", label: "Mostly cloudy / Overcast" },
    { value: "rainy-drizzling", label: "Rainy / drizzling" },
    { value: "windy", label: "Windy" },
    { value: "snowy-flurries", label: "Snowy / Flurries" },
    { value: "stormy", label: "Stormy" },
    { value: "feels-hot", label: "Feels hot / very hot" },
    { value: "feels-cold", label: "Feels cold / very cold" },
] as const;

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

export function getWeightPrompt(domain: MobileYeeDomainKey): string {
    switch (domain) {
        case "access":
            return "How important is it to you that you can easily and safely get to these spaces?";
        case "activitySpaces":
            return "How important is it to you that these places have the spaces and/or equipment that allow you to do the activities you like (Ex: have spaces for sports/games, for hanging out with friends, for spending quiet time on your own, etc)?";
        case "amenities":
            return "How important is it to you that these places have amenities that make the space more comfortable and suitable (like bathrooms, WiFi, garbage bins, places to buy food/drinks, seating for groups, shade, etc)?";
        case "experienceOfSpace":
            return "How important is it to you that these places feel pleasant and safe to be in (Ex: feel peaceful, have lots of nature or nice views, feel safe and comfortable, where you will not be bothered or feel out of place, etc)?";
        case "aestheticsAndCare":
            return "How important is it to you that these places look nice and well cared for (Ex: have lots of greenery, have gardens or art to look at, are free from litter and graffiti, look like someone is taking good care of it, etc)?";
        case "useAndUsability":
            return "How important is it to you that these places are suitable for many activities for youth and/or the community (Ex: allow for lots of different types of activities, have lights that allow for night use, are good for youth programming or dog walking, etc)?";
    }
}

export function ensureQuestionMark(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }

    if (/[?!.]$/.test(trimmed)) {
        return trimmed;
    }

    return `${trimmed}?`;
}
