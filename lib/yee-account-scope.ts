export interface YeeAccountLease {
    readonly accountId: string;
    readonly generation: number;
}

type AccountChangeListener = (lease: YeeAccountLease | null) => void;

let activeAccountId: string | null = null;
let generation = 0;
const listeners = new Set<AccountChangeListener>();

export function activateYeeAccount(accountId: string | null): void {
    const normalized = accountId !== null && accountId.trim().length > 0 ? accountId : null;
    if (normalized === activeAccountId) {
        return;
    }

    activeAccountId = normalized;
    generation += 1;
    const lease = normalized === null ? null : { accountId: normalized, generation };
    for (const listener of listeners) {
        listener(lease);
    }
}

export function getActiveYeeAccountId(): string | null {
    return activeAccountId;
}

export function captureYeeAccountLease(accountId: string): YeeAccountLease | null {
    return activeAccountId === accountId ? { accountId, generation } : null;
}

export function isYeeAccountLeaseCurrent(lease: YeeAccountLease): boolean {
    return activeAccountId === lease.accountId && generation === lease.generation;
}

export function subscribeToYeeAccountChanges(listener: AccountChangeListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
