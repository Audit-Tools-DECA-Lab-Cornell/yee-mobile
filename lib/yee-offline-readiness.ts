export function getOfflineReadinessMessage(options: {
    readonly hasOfflineLoginCredentials: boolean;
    readonly hasCachedAssignedPlaces: boolean;
    readonly hasCachedInstrument: boolean;
}): string {
    const missingSteps: string[] = [];

    if (!options.hasOfflineLoginCredentials) {
        missingSteps.push("complete one successful online sign-in on this device");
    }
    if (!options.hasCachedAssignedPlaces) {
        missingSteps.push("sync the auditor's assigned places");
    }
    if (!options.hasCachedInstrument) {
        missingSteps.push("cache the YEE survey instrument while online");
    }

    if (missingSteps.length === 0) {
        return "This device is ready for offline field work.";
    }

    return `Before going offline, ${joinMissingSteps(missingSteps)}.`;
}

function joinMissingSteps(steps: readonly string[]): string {
    if (steps.length === 1) {
        return steps[0] ?? "";
    }

    const allButLast = steps.slice(0, -1);
    const last = steps[steps.length - 1] ?? "";
    return `${allButLast.join(", ")}, and ${last}`;
}
