import express from "express";
import cors from "cors";
import * as path from "path";
import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";
import { analyzeResources } from "./resource_analyzer";
import { analyzeChains } from "./chain_analyzer";

// Clear module cache for distill_combo to force reload
const distillComboPath = require.resolve("./distill_combo_v2");
delete require.cache[distillComboPath];

import { distillReplayData } from "./distill_combo_v2";
import { generatePDF } from "./pdf_generator";
import {
    saveJsonToGCS,
    loadJsonFromGCS,
    listCombosFromGCS,
    deleteJsonFromGCS,
    generateComboFilename,
    saveReplayToGCS,
    saveReplayJsonToGCS,
} from "./gcs_storage";

// Magic bytes for replay file identification
const REPLAY_YRP1 = 0x31707279; // .yrp format
const REPLAY_YRPX = 0x58707279; // .yrpX format

/**
 * Validates that a buffer is a valid .yrpX replay file by checking magic bytes.
 * Returns an object with validation result and details.
 */
function validateYrpxFile(buffer: Buffer): { valid: boolean; error?: string; fileType?: string } {
    if (!Buffer.isBuffer(buffer)) {
        return { valid: false, error: "Invalid input: expected binary data" };
    }

    if (buffer.length < 32) {
        return { valid: false, error: "File too small to be a valid replay file (minimum 32 bytes required)" };
    }

    const magicBytes = buffer.readUInt32LE(0);

    if (magicBytes === REPLAY_YRPX) {
        return { valid: true, fileType: "yrpX" };
    }

    if (magicBytes === REPLAY_YRP1) {
        return { valid: false, error: "This appears to be a .yrp file (older format). Only .yrpX files are supported." };
    }

    // Log the actual magic bytes for debugging (in hex)
    const hexMagic = magicBytes.toString(16).padStart(8, '0');
    return { valid: false, error: `Invalid file format. Expected .yrpX replay file (magic bytes: 0x${hexMagic})` };
}

const app = express();
// Use PORT environment variable for Cloud Run compatibility
const PORT = parseInt(process.env.PORT || "3000", 10);

// Enable CORS for cross-origin requests from other websites
// Must be before other middleware to handle preflight OPTIONS requests
app.use(cors({
    origin: true, // Reflect the request origin (works better than '*' with credentials)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    preflightContinue: false,
}));

// Serve static files from 'public' directory
app.use(express.static(path.join(process.cwd(), "public")));

// Parse raw body for file uploads
app.use(express.raw({ type: "application/octet-stream", limit: "50mb" }));

// Parse JSON body for /pdf endpoint
app.use(express.json({ limit: "50mb" }));

app.post("/parse", async (req, res) => {
    try {
        const buffer = req.body;
        console.log(`Received request. Body is Buffer: ${Buffer.isBuffer(buffer)}, Length: ${buffer ? buffer.length : 0}`);

        // Validate file is a .yrpX file
        const validation = validateYrpxFile(buffer);
        if (!validation.valid) {
            console.log(`[parse] File validation failed: ${validation.error}`);
            res.status(400).json({ error: "Invalid file", details: validation.error });
            return;
        }
        console.log(`[parse] File validated as ${validation.fileType}`);

        const replay = new ReplayParserTS(buffer);
        await replay.parse();
        console.log("Replay parsed successfully");

        const replayDataBuffer = replay.replayData;
        const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, replay.header.id) : [];

        const replayData = {
            header: replay.header,
            parsedReplayData: parsedReplayData
        };

        // Distill the combo
        console.log("Distilling combo...");
        console.log("[DEBUG SERVER] About to call distillReplayData");
        console.log("[DEBUG SERVER] distillReplayData function:", typeof distillReplayData);
        const distilledCombo = await distillReplayData(replayData);
        console.log("Combo distilled successfully");

        res.json(distilledCombo);
    } catch (error) {
        console.error("Error parsing replay:", error);
        res.status(500).json({ error: "Failed to parse replay file", details: String(error) });
    }
});

app.post("/pdf", async (req, res) => {
    try {
        const comboData = req.body;
        console.log("Generating PDF...", comboData ? "data received" : "no data");
        const pdfBuffer = await generatePDF(comboData);
        console.log("PDF generated successfully");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=combo.pdf");
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ error: "Failed to generate PDF", details: String(error) });
    }
});

// Combined endpoint: Upload .yrpX file -> Get PDF directly
// This is the main endpoint for external integrations
app.post("/yrpx-to-pdf", async (req, res) => {
    try {
        const buffer = req.body;
        console.log(`[yrpx-to-pdf] Received file. Is Buffer: ${Buffer.isBuffer(buffer)}, Length: ${buffer ? buffer.length : 0}`);

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            res.status(400).json({ error: "No file data received. Send the .yrpX file as binary in the request body." });
            return;
        }

        // Validate file is a .yrpX file
        const validation = validateYrpxFile(buffer);
        if (!validation.valid) {
            console.log(`[yrpx-to-pdf] File validation failed: ${validation.error}`);
            res.status(400).json({ error: "Invalid file", details: validation.error });
            return;
        }
        console.log(`[yrpx-to-pdf] File validated as ${validation.fileType}`);

        // Check if user opted in to save replay (via X-Save-Replay header)
        const saveReplay = req.headers['x-save-replay'] === 'true';
        const originalFilename = (req.headers['x-filename'] as string) || 'replay.yrpX';

        if (saveReplay) {
            // Save replay to GCS (non-blocking, don't wait for result)
            saveReplayToGCS(originalFilename, buffer)
                .then(result => {
                    if (result.success) {
                        console.log(`[yrpx-to-pdf] Replay saved to GCS: ${result.url}`);
                    } else {
                        console.error(`[yrpx-to-pdf] Failed to save replay: ${result.error}`);
                    }
                })
                .catch(err => console.error(`[yrpx-to-pdf] Error saving replay:`, err));
        } else {
            console.log(`[yrpx-to-pdf] User opted out of saving replay`);
        }

        // Step 1: Parse the replay
        const replay = new ReplayParserTS(buffer);
        await replay.parse();
        console.log("[yrpx-to-pdf] Replay parsed successfully");
        console.log(`[yrpx-to-pdf] Player names: ${replay.playerNames.join(', ')}`);

        const replayDataBuffer = replay.replayData;
        const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, replay.header.id) : [];

        const replayData = {
            header: replay.header,
            parsedReplayData: parsedReplayData,
            playerNames: replay.playerNames
        };

        // Step 2: Distill the combo
        console.log("[yrpx-to-pdf] Distilling combo...");
        const distilledCombo = await distillReplayData(replayData);
        console.log("[yrpx-to-pdf] Combo distilled successfully");

        if (saveReplay) {
            // Save distilled JSON to GCS (non-blocking)
            saveReplayJsonToGCS(originalFilename, distilledCombo)
                .then(result => {
                    if (result.success) {
                        console.log(`[yrpx-to-pdf] Distilled JSON saved to GCS: ${result.url}`);
                    } else {
                        console.error(`[yrpx-to-pdf] Failed to save distilled JSON: ${result.error}`);
                    }
                })
                .catch(err => console.error(`[yrpx-to-pdf] Error saving distilled JSON:`, err));
        }

        // Step 3: Generate PDF
        console.log("[yrpx-to-pdf] Generating PDF...");
        const pdfBuffer = await generatePDF(distilledCombo);
        console.log("[yrpx-to-pdf] PDF generated successfully");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=combo.pdf");
        res.send(pdfBuffer);
    } catch (error) {
        console.error("[yrpx-to-pdf] Error:", error);
        res.status(500).json({ error: "Failed to process replay file", details: String(error) });
    }
});

// Save combo JSON to Google Cloud Storage
app.post("/combos", async (req, res) => {
    try {
        const { name, data } = req.body;

        if (!data) {
            res.status(400).json({ error: "No combo data provided" });
            return;
        }

        const filename = generateComboFilename(name);
        const result = await saveJsonToGCS(filename, data);

        if (result.success) {
            res.json({
                success: true,
                filename,
                url: result.url,
            });
        } else {
            res.status(500).json({ error: "Failed to save combo", details: result.error });
        }
    } catch (error) {
        console.error("Error saving combo:", error);
        res.status(500).json({ error: "Failed to save combo", details: String(error) });
    }
});

// List all saved combos
app.get("/combos", async (_req, res) => {
    try {
        const files = await listCombosFromGCS();
        res.json({ combos: files });
    } catch (error) {
        console.error("Error listing combos:", error);
        res.status(500).json({ error: "Failed to list combos", details: String(error) });
    }
});

// Load a specific combo by filename
app.get("/combos/:filename", async (req, res) => {
    try {
        const { filename } = req.params;
        const data = await loadJsonFromGCS(filename);

        if (data) {
            res.json(data);
        } else {
            res.status(404).json({ error: "Combo not found" });
        }
    } catch (error) {
        console.error("Error loading combo:", error);
        res.status(500).json({ error: "Failed to load combo", details: String(error) });
    }
});

// Delete a combo by filename
app.delete("/combos/:filename", async (req, res) => {
    try {
        const { filename } = req.params;
        const success = await deleteJsonFromGCS(filename);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: "Failed to delete combo" });
        }
    } catch (error) {
        console.error("Error deleting combo:", error);
        res.status(500).json({ error: "Failed to delete combo", details: String(error) });
    }
});

// Debug endpoint to test GCS connection and permissions
app.get("/debug/gcs-test", async (_req, res) => {
    try {
        const testBuffer = Buffer.from("GCS test file - " + new Date().toISOString());
        const result = await saveReplayToGCS("test-connection.txt", testBuffer);

        if (result.success) {
            res.json({
                success: true,
                message: "GCS connection successful!",
                url: result.url,
                bucket: process.env.GCS_REPLAY_BUCKET_NAME || "yugioh-card-images-archetype-nexus",
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                bucket: process.env.GCS_REPLAY_BUCKET_NAME || "yugioh-card-images-archetype-nexus",
                hint: "Check that the Cloud Run service account has 'Storage Object Creator' role on this bucket",
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined,
            bucket: process.env.GCS_REPLAY_BUCKET_NAME || "yugioh-card-images-archetype-nexus",
        });
    }
});

// Debug endpoint to check service configuration
app.get("/debug/config", (_req, res) => {
    res.json({
        gcsBucket: process.env.GCS_BUCKET_NAME || "yrp-combo-data (default)",
        gcsReplayBucket: process.env.GCS_REPLAY_BUCKET_NAME || "yugioh-card-images-archetype-nexus (default)",
        nodeEnv: process.env.NODE_ENV || "not set",
        port: PORT,
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log("Open this URL in your browser to use the GUI.");
});
