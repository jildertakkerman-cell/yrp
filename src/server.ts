import express from "express";
import * as path from "path";
import { Replay } from "./index";
import { ReplayDecoder } from "./replay_decoder";

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

        if (!buffer || buffer.length === 0) {
            console.error("Error: Buffer is empty");
            return res.status(400).json({ error: "No file data received" });
        }

        const replay = await Replay.fromBuffer(buffer);
        console.log("Replay parsed successfully");

        const replayDataBuffer = replay.getReplayData();
        const header = replay.getHeader();
        const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, header.id) : [];

        const data = {
            header: replay.getHeader(),
            playerNames: replay.getPlayerNames(),
            scriptName: replay.getScriptName(),
            parameter: replay.getParameter(),
            decks: replay.getDecks(),
            replayData: replayDataBuffer?.toString('base64') || null,
            parsedReplayData: parsedReplayData
        };

        res.json(data);
    } catch (error) {
        console.error("Error parsing replay:", error);
        res.status(500).json({ error: "Failed to parse replay file", details: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open this URL in your browser to use the GUI.");
});
