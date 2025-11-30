
import * as fs from "fs";
import * as path from "path";
import { Replay } from "./src/index";

async function run() {
    const filePath = path.join(process.cwd(), "replays", "ABC XYZ combo X.yrpX");
    console.log(`Reading file: ${filePath}`);

    try {
        const buffer = fs.readFileSync(filePath);
        console.log(`File read, size: ${buffer.length}`);

        const replay = await Replay.fromBuffer(buffer);
        console.log("Replay parsed successfully");
        console.log("Header:", replay.getHeader());
    } catch (error) {
        console.error("Error parsing replay:", error);
    }
}

run();
