
import { ReplayParserTS } from './replay_parser_ts';
import { ReplayDecoder } from './replay_decoder';
import * as path from 'path';
import * as fs from 'fs-extra';

async function main() {
    const replayPath = path.join(__dirname, '..', 'ABC XYZ combo X.yrpX');
    console.log(`Loading replay from: ${replayPath}`);

    try {
        const parser = await ReplayParserTS.fromFile(replayPath);
        console.log("Replay parsed successfully.");
        console.log("Header:", parser.header);
        console.log("Players:", parser.playerNames);

        if (parser.replayData) {
            console.log(`Decoding replay data (Size: ${parser.replayData.length})...`);
            const steps = ReplayDecoder.decode(parser.replayData, parser.header.id);
            console.log(`Decoded ${steps.length} steps.`);

            console.log(`Decoded ${steps.length} steps.`);

            const output = {
                header: parser.header,
                playerNames: parser.playerNames,
                params: parser.params,
                decks: parser.decks,
                steps: steps
            };

            const outputPath = path.join(__dirname, '..', 'replay_dump_new.json');

            const jsonString = JSON.stringify(output, (key, value) =>
                typeof value === 'bigint'
                    ? value.toString()
                    : value // return everything else unchanged
                , 2);

            await fs.writeFile(outputPath, jsonString);
            console.log(`Full replay dump written to: ${outputPath}`);

        } else {
            console.log("No replay data found.");
        }

    } catch (e) {
        console.error("Error parsing replay:", e);
    }
}

main();
