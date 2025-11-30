import * as fs from "fs-extra";
import { ReplayDecoder } from "../src/replay_decoder";

async function run() {
    const inputFile = "../replays/parsed/ABC XYZ combo X - with TTG.yrpX.json";
    const data = await fs.readJson(inputFile);

    if (!data.replayData) {
        console.error("No replayData found in JSON");
        return;
    }

    const buffer = Buffer.from(data.replayData, 'base64');
    const steps = ReplayDecoder.decode(buffer, data.header.id);

    const cardId = 70860415;
    console.log(`Searching for events involving card ${cardId}...`);

    const output = [];
    for (const step of steps) {
        // Check for MSG_DRAW
        if (step.type === "MSG_DRAW") {
            if (step.details.cards && step.details.cards.some((c: any) => c.code === cardId)) {
                output.push({ ...step, note: "MSG_DRAW found with card" });
            }
        }

        // Check for MSG_MOVE
        if (step.type === "MSG_MOVE") {
            if (step.details && step.details.code === cardId) {
                output.push({ ...step, note: "MSG_MOVE with ID" });
            } else if (step.details && step.details.newLocation === 2) { // 2 is HAND
                // Capture any move to hand to see if it's our card but with code 0
                output.push({ ...step, note: "MSG_MOVE to HAND (any card)" });
            }
        }

        // Check for UPDATE_DATA or UPDATE_CARD which might reveal the ID
        if (step.type === "MSG_UPDATE_DATA" || step.type === "MSG_UPDATE_CARD") {
            if (step.details.card && step.details.card.code === cardId) {
                output.push({ ...step, note: "UPDATE_CARD revealing ID" });
            }
            if (step.details.cards && step.details.cards.some((c: any) => c.code === cardId)) {
                output.push({ ...step, note: "UPDATE_DATA revealing ID" });
            }
        }
    }
    fs.writeFileSync("../data/reproduce_output_v2.json", JSON.stringify(output, null, 2));
    console.log("Output written to ../data/reproduce_output_v2.json");
}

run().catch(console.error);
