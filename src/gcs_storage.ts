import { Storage } from "@google-cloud/storage";

// Initialize GCS client
// When running on Cloud Run, authentication is automatic via the service account
// For local development, set GOOGLE_APPLICATION_CREDENTIALS environment variable
const storage = new Storage();

// Bucket name for storing combo JSON files
// Can be overridden via environment variable
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "yrp-combo-data";

export interface SaveResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * Save JSON data to Google Cloud Storage
 * @param filename - The name of the file (e.g., "combo-123.json")
 * @param data - The JSON data to save
 * @returns Promise with the result including the public URL if successful
 */
export async function saveJsonToGCS(filename: string, data: object): Promise<SaveResult> {
    try {
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(`combos/${filename}`);

        const jsonString = JSON.stringify(data, null, 2);

        await file.save(jsonString, {
            contentType: "application/json",
            metadata: {
                cacheControl: "public, max-age=3600",
            },
        });

        // Generate the public URL
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/combos/${filename}`;

        console.log(`Saved JSON to GCS: ${publicUrl}`);

        return {
            success: true,
            url: publicUrl,
        };
    } catch (error) {
        console.error("Error saving to GCS:", error);
        return {
            success: false,
            error: String(error),
        };
    }
}

/**
 * Load JSON data from Google Cloud Storage
 * @param filename - The name of the file to load
 * @returns Promise with the parsed JSON data
 */
export async function loadJsonFromGCS<T = unknown>(filename: string): Promise<T | null> {
    try {
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(`combos/${filename}`);

        const [contents] = await file.download();
        return JSON.parse(contents.toString()) as T;
    } catch (error) {
        console.error("Error loading from GCS:", error);
        return null;
    }
}

/**
 * List all saved combo JSON files
 * @returns Promise with array of filenames
 */
export async function listCombosFromGCS(): Promise<string[]> {
    try {
        const bucket = storage.bucket(BUCKET_NAME);
        const [files] = await bucket.getFiles({ prefix: "combos/" });

        return files.map((file) => file.name.replace("combos/", ""));
    } catch (error) {
        console.error("Error listing files from GCS:", error);
        return [];
    }
}

/**
 * Delete a JSON file from Google Cloud Storage
 * @param filename - The name of the file to delete
 * @returns Promise with success status
 */
export async function deleteJsonFromGCS(filename: string): Promise<boolean> {
    try {
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(`combos/${filename}`);

        await file.delete();
        console.log(`Deleted from GCS: combos/${filename}`);
        return true;
    } catch (error) {
        console.error("Error deleting from GCS:", error);
        return false;
    }
}

/**
 * Generate a unique filename for a combo based on timestamp and optional name
 * @param name - Optional name for the combo
 * @returns Generated filename
 */
export function generateComboFilename(name?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = name
        ? name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50)
        : "combo";
    return `${safeName}_${timestamp}.json`;
}
