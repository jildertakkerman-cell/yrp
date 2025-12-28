import express from "express";
import * as path from "path";
import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";
import { analyzeResources } from "./resource_analyzer";
import { analyzeChains } from "./chain_analyzer";

// Clear module cache for distill_combo to force reload
const distillComboPath = require.resolve("./distill_combo_v2");
delete require.cache[distillComboPath];

import { distillReplayData } from "./distill_combo_v2";

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(process.cwd(), "public")));

// Parse raw body for file uploads
app.use(express.raw({ type: "application/octet-stream", limit: "50mb" }));

app.post("/parse", async (req, res) => {
    try {
        const buffer = req.body;
        console.log(`Received request. Body is Buffer: ${Buffer.isBuffer(buffer)}, Length: ${buffer ? buffer.length : 0}`);

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

// Resource analysis endpoint for card advantage charts
app.post("/analyze", async (req, res) => {
    try {
        const buffer = req.body;
        console.log(`[ANALYZE] Received request. Buffer length: ${buffer ? buffer.length : 0}`);

        const replay = new ReplayParserTS(buffer);
        await replay.parse();
        console.log("[ANALYZE] Replay parsed successfully");
        console.log("[ANALYZE] Player names from replay:", replay.playerNames);

        const replayDataBuffer = replay.replayData;
        const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, replay.header.id) : [];

        // Analyze resources
        console.log("[ANALYZE] Analyzing resources...");
        const resourceAnalysis = analyzeResources(parsedReplayData);
        console.log(`[ANALYZE] Generated ${resourceAnalysis.snapshots.length} snapshots`);

        // Analyze chains
        console.log("[ANALYZE] Analyzing chain efficiency...");
        const chainAnalysis = analyzeChains(parsedReplayData);
        console.log(`[ANALYZE] Found ${chainAnalysis.summary.totalInteractions} interactions`);

        // Analyze opening hands (requires deck data)
        console.log("[ANALYZE] Analyzing opening hands...");
        const { analyzeOpeningHands } = await import("./hand_analyzer");
        const handAnalysis = analyzeOpeningHands(parsedReplayData, replay.decks);
        console.log(`[ANALYZE] Hand analysis complete. P1 verdict: ${handAnalysis.player1Hand?.verdict || 'N/A'}`);

        // Extract player names with proper fallbacks
        const playerNames: string[] = [];
        if (replay.playerNames && replay.playerNames.length >= 2) {
            playerNames.push(replay.playerNames[0] || "Player 1");
            playerNames.push(replay.playerNames[1] || "Player 2");
        } else if (replay.playerNames && replay.playerNames.length === 1) {
            playerNames.push(replay.playerNames[0] || "Player 1");
            playerNames.push("Player 2");
        } else {
            playerNames.push("Player 1", "Player 2");
        }

        console.log("[ANALYZE] Final player names:", playerNames);

        res.json({
            header: replay.header,
            playerNames,
            resourceAnalysis,
            chainAnalysis,
            handAnalysis
        });
    } catch (error) {
        console.error("[ANALYZE] Error:", error);
        res.status(500).json({ error: "Failed to analyze replay file", details: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open this URL in your browser to use the GUI.");
});
