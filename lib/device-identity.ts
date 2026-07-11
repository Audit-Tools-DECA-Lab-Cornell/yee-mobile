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
const OS_DEVICE_ID_KEY = "yee.device_identity.os_device_id.v1";

let storage: ReturnType<typeof createMMKV> | null = null;
let tabletIdCache: string | null = null;
/**
 * OS device id: memory cache over the MMKV-persisted value. Persisting the
 * resolved id means only the very first launch ever has an async-resolution
 * window; every later launch reads it synchronously before the first save.
 */
let osDeviceIdCache: string | null = null;
/** Single-flight guard for the lazy re-hydration kicked by getDeviceIdentity. */
let lazyHydration: Promise<void> | null = null;

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
 * The in-memory cache is updated regardless so audits in this session carry
 * the label, but the caller is told when the durable write failed — a
 * session-only label silently vanishing on restart would defeat the point of
 * labeling the device, so Settings surfaces that state.
 *
 * @param value Raw input; stored trimmed.
 * @returns True when the label was durably written to device storage.
 */
export function saveTabletId(value: string): boolean {
    const trimmed = value.trim();
    tabletIdCache = trimmed;

    const instance = getStorage();
    if (instance === null) {
        return false;
    }

    try {
        instance.set(TABLET_ID_KEY, trimmed);
        return true;
    } catch {
        // In-memory cache still holds the value for this session only.
        return false;
    }
}

/**
 * Read the OS device identifier resolved on a previous launch.
 *
 * @returns The persisted id, or "" when none has been resolved yet.
 */
function readOsDeviceId(): string {
    if (osDeviceIdCache !== null) {
        return osDeviceIdCache;
    }

    const instance = getStorage();
    if (instance === null) {
        return "";
    }

    try {
        osDeviceIdCache = instance.getString(OS_DEVICE_ID_KEY) ?? "";
    } catch {
        return "";
    }
    return osDeviceIdCache;
}

/**
 * Resolve the best-effort OS device identifier and persist it. Called once at
 * app startup; each platform's getter throws on the other platform, which
 * degrades to "" rather than failing startup. Persisting the result closes the
 * cold-start race: an early save may still stamp "" on the very first launch,
 * but every launch after that reads the id synchronously from MMKV.
 */
export async function hydrateDeviceIdentity(): Promise<void> {
    if (readOsDeviceId().length > 0) {
        return;
    }

    const resolved = await resolveOsDeviceId();
    if (resolved.length === 0) {
        return;
    }

    osDeviceIdCache = resolved;
    try {
        getStorage()?.set(OS_DEVICE_ID_KEY, resolved);
    } catch {
        // In-memory cache already holds the value for this session.
    }
}

async function resolveOsDeviceId(): Promise<string> {
    try {
        const androidId = Application.getAndroidId();
        if (typeof androidId === "string" && androidId.length > 0) {
            return androidId;
        }
    } catch {
        // Not Android — fall through to the iOS vendor ID.
    }

    try {
        const vendorId = await Application.getIosIdForVendorAsync();
        if (typeof vendorId === "string" && vendorId.length > 0) {
            return vendorId;
        }
    } catch {
        // Unavailable (e.g. web); report unknown.
    }
    return "";
}

/**
 * Snapshot the device identity for stamping into audit metadata.
 *
 * Synchronous so the draft/submit pipeline can call it inline; the OS id is
 * the MMKV-persisted value from a previous launch or whatever
 * {@link hydrateDeviceIdentity} has resolved this session. When it is still
 * unknown, a background re-hydration is kicked so the next save self-heals.
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

    const osDeviceId = readOsDeviceId();
    if (osDeviceId.length === 0 && lazyHydration === null) {
        lazyHydration = hydrateDeviceIdentity()
            .catch(() => undefined)
            .finally(() => {
                lazyHydration = null;
            });
    }

    return {
        tablet_id: readTabletId(),
        os_device_id: osDeviceId,
        device_model: deviceModel,
    };
}

/**
 * Backfill blank device-identity fields in a participant_info payload from the
 * CURRENT device identity, never overwriting a non-empty captured value.
 *
 * Applied at send time in the API layer: a payload stamped before first-launch
 * hydration finished (or before the tablet was labeled) is frozen in the
 * offline queue with "" fields, but it drains through the same device later —
 * so filling the blanks at send keeps the values accurate and rescues queued
 * audits that would otherwise ship without an id.
 *
 * Async so it can await the hydration attempt first: even the very first send
 * on a fresh install waits for the OS id resolution (an early return when it
 * is already known) instead of racing it and shipping "".
 */
export async function withDeviceIdentityFallback(
    info: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    try {
        await hydrateDeviceIdentity();
    } catch {
        // Best-effort: an unresolvable id still must never block the send.
    }
    const device = getDeviceIdentity();
    const filled = { ...info };
    for (const key of ["tablet_id", "os_device_id", "device_model"] as const) {
        const current = filled[key];
        const isBlank = typeof current !== "string" || current.length === 0;
        if (isBlank && device[key].length > 0) {
            filled[key] = device[key];
        }
    }
    return filled;
}
