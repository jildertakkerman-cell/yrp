import * as fs from "fs-extra";
import * as path from "path";
import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";

// Patch BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString() };

async function parseReplays() {
    const args = process.argv.slice(2);
    let filesToProcess: string[] = [];

    if (args.length > 0) {
        // Assume args are file paths or directories
        for (const arg of args) {
            const absolutePath = path.resolve(arg);
            const stat = await fs.stat(absolutePath);
            if (stat.isDirectory()) {
                const files = await fs.readdir(absolutePath);
                filesToProcess.push(...files.filter(f => {
                    const lower = f.toLowerCase();
                    return lower.endsWith(".yrp") || lower.endsWith(".yrpx");
                }).map(f => path.join(absolutePath, f)));
            } else if (stat.isFile()) {
                const lower = arg.toLowerCase();
                if (lower.endsWith(".yrp") || lower.endsWith(".yrpx")) {
                    filesToProcess.push(absolutePath);
                }
            }
        }
    } else {
        // Default to checking 'res' directory
        const resDir = path.join(process.cwd(), "res");
        if (await fs.pathExists(resDir)) {
            const files = await fs.readdir(resDir);
            filesToProcess.push(...files.filter(f => {
                const lower = f.toLowerCase();
                return lower.endsWith(".yrp") || lower.endsWith(".yrpx");
            }).map(f => path.join(resDir, f)));
        }
    }

    if (filesToProcess.length === 0) {
        console.log("No .yrp files found.");
        return;
    }

    console.log(`Found ${filesToProcess.length} files to process.`);

    for (const file of filesToProcess) {
        try {
            console.log(`Processing ${file}...`);
            const replay = await ReplayParserTS.fromFile(file);

            const replayDataBuffer = replay.replayData;
            const parsedReplayData = replayDataBuffer ? ReplayDecoder.decode(replayDataBuffer, replay.header.id) : [];

            const data = {
                header: replay.header,
                playerNames: replay.playerNames,
                scriptName: replay.scriptName,
                parameter: replay.params,
                decks: replay.decks,
                replayData: replayDataBuffer?.toString('base64') || null,
                parsedReplayData: parsedReplayData
            };

            const outputPath = file + ".json";
            await fs.writeJson(outputPath, data, {
                spaces: 2,
                replacer: (key: string, value: any) => {
                    if (typeof value === 'bigint') {
                        return value.toString();
                    }
                    return value;
                }
            });
            console.log(`Saved JSON to ${outputPath}`);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
            fs.writeFileSync("parse_error.log", String(error) + "\n" + (error instanceof Error ? error.stack : ""));
        }
    }
}

parseReplays().catch(console.error);
