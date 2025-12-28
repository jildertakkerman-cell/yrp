import { OmegaReplayParser } from './omega_replay_parser';
import * as fs from 'fs-extra';
import * as path from 'path';

async function main() {
    const inputFile = path.join(__dirname, '..', 'replays', 'YGO OMEGA REPLAY1.txt');
    const outputFile = path.join(__dirname, '..', 'replays', 'YGO OMEGA REPLAY1.decoded.json');

    console.log(`Reading ${inputFile}...`);
    const content = await fs.readFile(inputFile, 'utf-8');

    console.log("Parsing...");
    const parser = OmegaReplayParser.fromBase64(content.trim());

    const header = parser.getHeaderInformation();
    const decks = parser.getDecks();
    const steps = parser.getParsedReplayData();

    const output = {
        header,
        decks,
        steps
    };

    console.log(`Decoded ${steps.length} steps.`);
    await fs.writeJson(outputFile, output, { spaces: 2 });
    console.log(`Saved to ${outputFile}`);
}

main().catch(console.error);
