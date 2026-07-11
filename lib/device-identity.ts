import * as Application from "expo-application";
import * as Device from "expo-device";
import { createMMKV } from "react-native-mmkv";

/**
 * Device-local identity metadata stamped into every audit's participant info.
 *
 * Field programs label their shared tablets with physical ID numbers so a
 * completed audit can be traced back to the device it was captured on. That
 * label is not software-discoverable, so it is entered once (Settings → Device)
 * and persisted device-scoped in MMKV — like display preferences, it applies to
 * whichever auditor signs in. Best-effort OS identifiers (Android ID / iOS
 * vendor ID, plus the hardware model name) ride along as a backup so audits
 * from an unlabeled device can still be distinguished.
 */

/** Identity payload merged into `participant_info` on every draft save/submit. */
export interface DeviceIdentity {
    /** Manually entered physical tablet label ("" when not set). */
    readonly tablet_id: string;
    /** OS-provided device identifier ("" when unavailable). */
    readonly os_device_id: string;
    /** Hardware model name, e.g. "iPad (10th generation)" ("" when unknown). */
    readonly device_model: string;
}

const TABLET_ID_KEY = "yee.device_identity.tablet_id.v1";

let storage: ReturnType<typeof createMMKV> | null = null;
let tabletIdCache: string | null = null;
/** Resolved once by {@link hydrateDeviceIdentity}; "" until then/when unavailable. */
let osDeviceIdCache = "";

/**
 * Lazily open the device-identity MMKV instance.
 *
 * @returns The MMKV instance, or null when native storage is unavailable.
 */
function getStorage(): ReturnType<typeof createMMKV> | null {
    if (storage !== null) {
        return storage;
    }

    try {
        storage = createMMKV({ id: "yee.device-identity" });
        return storage;
    } catch {
        return null;
    }
}

/**
 * Read the manually entered tablet label.
 *
 * @returns The stored label, or "" when none has been set.
 */
export function readTabletId(): string {
    if (tabletIdCache !== null) {
        return tabletIdCache;
    }

    const instance = getStorage();
    if (instance === null) {
        return "";
    }

    try {
        tabletIdCache = instance.getString(TABLET_ID_KEY) ?? "";
    } catch {
        return "";
    }
    return tabletIdCache;
}

/**
 * Persist the manually entered tablet label.
 *
 * @param value Raw input; stored trimmed.
 */
export function saveTabletId(value: string): void {
    const trimmed = value.trim();
    tabletIdCache = trimmed;

    const instance = getStorage();
    if (instance === null) {
        return;
    }

    try {
        instance.set(TABLET_ID_KEY, trimmed);
    } catch {
        // In-memory cache already holds the latest value for this session.
    }
}

/**
 * Resolve the best-effort OS device identifier into the module cache. Called
 * once at app startup; each platform's getter throws on the other platform,
 * which degrades to "" rather than failing startup.
 */
export async function hydrateDeviceIdentity(): Promise<void> {
    try {
        const androidId = Application.getAndroidId();
        if (typeof androidId === "string" && androidId.length > 0) {
            osDeviceIdCache = androidId;
            return;
        }
    } catch {
        // Not Android — fall through to the iOS vendor ID.
    }

    try {
        const vendorId = await Application.getIosIdForVendorAsync();
        if (typeof vendorId === "string" && vendorId.length > 0) {
            osDeviceIdCache = vendorId;
        }
    } catch {
        // Unavailable (e.g. web); leave the cache empty.
    }
}

/**
 * Snapshot the device identity for stamping into audit metadata.
 *
 * Synchronous so the draft/submit pipeline can call it inline; the OS id is
 * whatever {@link hydrateDeviceIdentity} resolved at startup.
 *
 * @returns Identity fields with "" for anything unknown.
 */
export function getDeviceIdentity(): DeviceIdentity {
    let deviceModel = "";
    try {
        deviceModel = Device.modelName ?? "";
    } catch {
        deviceModel = "";
    }

    return {
        tablet_id: readTabletId(),
        os_device_id: osDeviceIdCache,
        device_model: deviceModel,
    };
}
