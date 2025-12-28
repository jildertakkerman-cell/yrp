import * as fs from 'fs';
import * as path from 'path';
import { OmegaReplayParser } from './omega_replay_parser';

const REPLAY1_PATH = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.txt');
const REPLAY2_PATH = path.join(__dirname, '../replays/YGO OMEGA REPLAY2.txt');

function getDecks(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return null;
    }
    // Read file - handle potential issues
    try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        const parser = new OmegaReplayParser(content);
        const replay = parser.parse();
        // Return only deck1 as that seems to be the player's deck
        return replay.deck1;
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e);
        return null;
    }
}

console.log("Starting deck verification...");

const deck1 = getDecks(REPLAY1_PATH);
const deck2 = getDecks(REPLAY2_PATH);

if (deck1 && deck2) {
    const d1_main = JSON.stringify(deck1.main);
    const d2_main = JSON.stringify(deck2.main);
    const d1_extra = JSON.stringify(deck1.extra);
    const d2_extra = JSON.stringify(deck2.extra);

    console.log(`\nReplay 1 (Main: ${deck1.main.length}, Extra: ${deck1.extra.length})`);
    console.log(`Replay 2 (Main: ${deck2.main.length}, Extra: ${deck2.extra.length})`);

    let match = true;
    if (d1_main !== d2_main) {
        console.log("[FAIL] Main decks differ!");
        match = false;
    }
    if (d1_extra !== d2_extra) {
        console.log("[FAIL] Extra decks differ!");
        match = false;
    }

    if (match) {
        console.log("[SUCCESS] Decks match exactly!");
        console.log("Deck Codes Sample:", JSON.stringify(deck1.main.slice(0, 10)));
    }
} else {
    console.log("Could not load both decks.");
}
