import express from "express";
import * as path from "path";
import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";

// Clear module cache for distill_combo to force reload
const distillComboPath = require.resolve("./distill_combo_v2");
delete require.cache[distillComboPath];

import { distillReplayData } from "./distill_combo_v2";
import { generatePDF } from "./pdf_generator";

const app = express();
// Use PORT environment variable for Cloud Run compatibility
const PORT = parseInt(process.env.PORT || "3000", 10);

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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log("Open this URL in your browser to use the GUI.");
});
