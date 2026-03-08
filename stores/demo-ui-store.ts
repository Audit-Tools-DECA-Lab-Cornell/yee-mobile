import { create } from "zustand";

/**
 * UI-only store for selected place state.
 */
interface DemoUiStoreState {
    readonly selectedPlaceId: string;
    setSelectedPlaceId: (placeId: string) => void;
}

/**
 * Global UI state store used across tabs.
 */
export const useDemoUiStore = create<DemoUiStoreState>((set) => ({
    selectedPlaceId: "place-001",
    setSelectedPlaceId: (placeId: string) => {
        const trimmedPlaceId = placeId.trim();
        if (trimmedPlaceId.length === 0) {
            return;
        }

        set(() => ({ selectedPlaceId: trimmedPlaceId }));
    },
}));
