import { create } from "zustand";
import type { DemoRole } from "lib/yee-demo-data";

/**
 * UI-only store for role switching and demo screen state.
 */
interface DemoUiStoreState {
    readonly activeRole: DemoRole;
    readonly selectedPlaceId: string;
    setActiveRole: (role: DemoRole) => void;
    setSelectedPlaceId: (placeId: string) => void;
}

/**
 * Global UI state store used across tabs.
 */
export const useDemoUiStore = create<DemoUiStoreState>((set) => ({
    activeRole: "manager",
    selectedPlaceId: "place-001",
    setActiveRole: (role: DemoRole) => {
        set(() => ({ activeRole: role }));
    },
    setSelectedPlaceId: (placeId: string) => {
        const trimmedPlaceId = placeId.trim();
        if (trimmedPlaceId.length === 0) {
            return;
        }

        set(() => ({ selectedPlaceId: trimmedPlaceId }));
    },
}));
