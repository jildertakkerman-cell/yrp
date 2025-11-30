
import * as fs from "fs-extra";
import * as path from "path";
import { ReplayParserTS } from "../src/replay_parser_ts";
import { ReplayDecoder } from "../src/replay_decoder";
import { distillReplayData } from "../src/distill_combo";

async function run() {
    const replayPath = path.join(process.cwd(), "replays", "ABC XYZ combo Hangar.yrpX");
    console.log(`Reading replay from ${replayPath}...`);

    const buffer = await fs.readFile(replayPath);

    console.log("Parsing replay...");
    const replay = new ReplayParserTS(buffer);
    await replay.parse();

    const replayDataBuffer = replay.replayData;
    const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, replay.header.id) : [];

    const replayData = {
        header: replay.header,
        parsedReplayData: parsedReplayData
    };

    console.log("Distilling combo...");
    const distilledCombo = await distillReplayData(replayData);

    console.log("Checking for B-Buster Drake instances...");
    const drakes = distilledCombo.combos.combo1.cards.filter(c => c.name === "B-Buster Drake");

    console.log(`Found ${drakes.length} B-Buster Drake instances:`);
    drakes.forEach(d => console.log(`- ${d.id} (${d.zone})`));

    if (drakes.length > 1) {
        console.log("SUCCESS: Multiple instances found.");
    } else {
        console.log("FAILURE: Only one instance found.");
    }
}

run().catch(console.error);
