import * as fs from 'fs';
import * as path from 'path';
import { OmegaReplayParser } from '../parsers/omega_replay_parser';

const REPLAY1_PATH = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.txt');
const REPLAY2_PATH = path.join(__dirname, '../replays/YGO OMEGA REPLAY2.txt');

function getDecks(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return null;
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const parser = new OmegaReplayParser(content);
    return parser.parse();
}

const r1 = getDecks(REPLAY1_PATH);
const r2 = getDecks(REPLAY2_PATH);

if (r1 && r2) {
    console.log("Comparing Decks...");

    // Check Deck 1 (Player 1)
    const d1_main = JSON.stringify(r1.deck1.main);
    const d2_main = JSON.stringify(r2.deck1.main);

    const d1_extra = JSON.stringify(r1.deck1.extra);
    const d2_extra = JSON.stringify(r2.deck1.extra);

    console.log(`Replay 1 Main Deck: ${d1_main}`);
    console.log(`Replay 2 Main Deck: ${d2_main}`);

    if (d1_main === d2_main && d1_extra === d2_extra) {
        console.log("[SUCCESS] Decks match exactly!");
        console.log(`Main Count: ${r1.deck1.main.length}`);
        console.log(`Extra Count: ${r1.deck1.extra.length}`);
    } else {
        console.log("[FAIL] Decks do not match.");
        console.log(`Replay 1 Extra Deck: ${d1_extra}`);
        console.log(`Replay 2 Extra Deck: ${d2_extra}`);
    }
}
