import { createMMKV } from "react-native-mmkv";

/**
 * Dedicated MMKV instance for the bug-report queue and draft. Kept separate
 * from the app's audit/offline storage so the low-volume report data never
 * competes with the audit sync path and can be cleared independently.
 */
export const bugReportStorage = createMMKV({ id: "yee.bugReport" });
