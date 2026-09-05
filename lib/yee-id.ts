/**
 * Small, dependency-free unique-id helpers for the YEE mobile offline layer.
 *
 * Avoids pulling in a `uuid` runtime dependency: the Expo/React Native runtime
 * exposes `crypto.randomUUID` (and Node does too), so we use it when present and
 * fall back to a v4-shaped string built from `crypto.getRandomValues` or, as a
 * last resort, `Math.random` (only ever hit in environments without WebCrypto).
 */

function randomUuidV4(): string {
    const cryptoObj: Crypto | undefined =
        typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;

    if (cryptoObj !== undefined && typeof cryptoObj.randomUUID === "function") {
        return cryptoObj.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (cryptoObj !== undefined && typeof cryptoObj.getRandomValues === "function") {
        cryptoObj.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }

    // Set version (4) and variant (10xx) bits per RFC 4122.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

    const hex: string[] = [];
    for (let index = 0; index < bytes.length; index += 1) {
        hex.push((bytes[index] ?? 0).toString(16).padStart(2, "0"));
    }
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
        .slice(6, 8)
        .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * Build a submission idempotency key.
 *
 * Generated ONCE when a submission is first enqueued and persisted with the
 * queue item - NEVER regenerated on retry. Format: `yee-${placeId}-${uuid}`,
 * truncated to the backend's 64-char maximum.
 *
 * @param placeId Place the submission targets.
 */
export function buildIdempotencyKey(placeId: string): string {
    return `yee-${placeId}-${randomUuidV4()}`.slice(0, 64);
}
