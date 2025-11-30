import express from "express";
import * as path from "path";
import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";

import { distillReplayData } from "./distill_combo";

const app = express();
const PORT = 3000;

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
        const distilledCombo = await distillReplayData(replayData);
        console.log("Combo distilled successfully");

        res.json(distilledCombo);
    } catch (error) {
        console.error("Error parsing replay:", error);
        res.status(500).json({ error: "Failed to parse replay file", details: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open this URL in your browser to use the GUI.");
});
