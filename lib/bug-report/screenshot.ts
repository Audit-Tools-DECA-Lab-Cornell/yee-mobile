import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { z } from "zod";

import type { AuthSession } from "lib/auth/types";
import { authedBugReportRequest } from "lib/bug-report/api";

/**
 * A screenshot uploaded to Cloudinary. Only the URL and public id are sent to
 * the backend - the image itself lives in Cloudinary.
 */
export interface UploadedScreenshot {
    url: string;
    publicId: string;
}

const uploadParamsSchema = z.object({
    cloud_name: z.string().min(1),
    api_key: z.string().min(1),
    timestamp: z.number().int(),
    signature: z.string().min(1),
    folder: z.string().min(1),
});

function toFileUri(uri: string): string {
    if (uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("asset://")) {
        return uri;
    }
    if (uri.startsWith("/")) {
        return `file://${uri}`;
    }
    return uri;
}

/**
 * Whether the client intends to capture screenshots. The Cloudinary secret and
 * signing live on the backend; this flag only gates whether the app attempts a
 * capture at all, so it stays off for builds that have not opted in.
 */
export function isScreenshotUploadConfigured(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME);
}

/**
 * Ask the backend for signed Cloudinary upload params. Returns `null` if the
 * backend has no Cloudinary credentials configured (HTTP 503), so the caller can
 * report screenshots as unavailable rather than failing the report.
 */
async function fetchSignedUploadParams(
    session: AuthSession,
): Promise<z.infer<typeof uploadParamsSchema> | null> {
    try {
        const response = await authedBugReportRequest(
            session,
            "/yee/bug-reports/screenshot-upload-params",
            {
                method: "GET",
            },
        );
        return uploadParamsSchema.parse(response);
    } catch {
        return null;
    }
}

// Timeout applied to the raw Cloudinary multipart upload (20 s). The background
// flush must not hang indefinitely on a stalled upload.
const CLOUDINARY_UPLOAD_TIMEOUT_MS = 20_000;

/**
 * Upload a captured local screenshot URI to Cloudinary using a backend-signed
 * request (no unsigned upload preset - the API secret never reaches the device).
 *
 * Returns the uploaded reference, or `null` when upload is unavailable. Throws
 * only on an actual upload failure so callers can keep bug-report submission
 * non-blocking when screenshot attachment fails.
 */
export async function uploadCapturedScreenshot(
    session: AuthSession,
    uri: string,
): Promise<UploadedScreenshot | null> {
    const params = await fetchSignedUploadParams(session);
    if (params === null) {
        return null;
    }

    const file = new File(toFileUri(uri));
    if (!file.exists || file.size === 0) {
        throw new Error(`Captured screenshot is not readable: ${file.uri}`);
    }

    const formData = new FormData();
    formData.append("file", file, file.name || "bug-report-screenshot.png");
    formData.append("api_key", params.api_key);
    formData.append("timestamp", String(params.timestamp));
    formData.append("signature", params.signature);
    formData.append("folder", params.folder);

    // Abort the upload if Cloudinary does not respond within the timeout so a
    // background flush cannot hang on a stalled connection.
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, CLOUDINARY_UPLOAD_TIMEOUT_MS);

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
        response = await fetch(
            `https://api.cloudinary.com/v1_1/${params.cloud_name}/image/upload`,
            {
                method: "POST",
                headers: { Accept: "application/json" },
                body: formData,
                signal: controller.signal,
            },
        );
    } finally {
        clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as {
        secure_url?: string;
        public_id?: string;
        error?: { message?: string };
    } | null;
    if (!response.ok) {
        const message =
            json?.error?.message ?? `Cloudinary upload failed with status ${response.status}`;
        throw new Error(message);
    }
    if (!json) {
        throw new Error("Cloudinary upload returned an empty response");
    }
    if (!json.secure_url || !json.public_id) {
        throw new Error("Cloudinary upload returned an unexpected response");
    }
    return { url: json.secure_url, publicId: json.public_id };
}
