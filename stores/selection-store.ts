import { create } from "zustand";

/**
 * UI-only store tracking which assigned place the auditor has selected.
 */
interface SelectionStoreState {
    /** Identifier of the currently selected place, or an empty string when none. */
    readonly selectedPlaceId: string;
    /**
     * Select a place by identifier. Blank values are ignored so the current
     * selection is never cleared by an empty update.
     *
     * @param placeId Identifier of the place to select.
     */
    setSelectedPlaceId: (placeId: string) => void;
}

/**
 * Global selection store shared across the tab screens.
 */
export const useSelectionStore = create<SelectionStoreState>((set) => ({
    selectedPlaceId: "",
    setSelectedPlaceId: (placeId: string) => {
        const trimmedPlaceId = placeId.trim();
        if (trimmedPlaceId.length === 0) {
            return;
        }

        set(() => ({ selectedPlaceId: trimmedPlaceId }));
    },
}));
