import { createContext, useContext } from "react";
import type { View } from "react-native";

/**
 * Bridges deeply-nested audit step content (the DomainStep question rows) to the
 * persistent shell's single scroll view, so a row can be scrolled into view
 * WITHOUT the shell subscribing to the draft. The shell owns the scroll ref and
 * a registry of row nodes; rows register their native node on mount and ask the
 * shell to scroll a specific row to the top ("Jump to next unanswered").
 */
export interface AuditRowScrollController {
    /** Register (node) or unregister (null) a row's native view by stable key. */
    readonly registerRow: (key: string, node: View | null) => void;
    /** Scroll the registered row for `key` to near the top of the viewport. */
    readonly scrollToRow: (key: string) => void;
}

const NOOP_CONTROLLER: AuditRowScrollController = {
    registerRow: () => undefined,
    scrollToRow: () => undefined,
};

export const AuditRowScrollContext = createContext<AuditRowScrollController>(NOOP_CONTROLLER);

export function useAuditRowScroll(): AuditRowScrollController {
    return useContext(AuditRowScrollContext);
}

/** Stable per-row key shared by the row registry and the jump-to-unanswered scan. */
export function auditRowKey(presenceItemId: string, choiceId: string): string {
    return `${presenceItemId}:${choiceId}`;
}
