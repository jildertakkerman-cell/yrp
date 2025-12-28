import * as fs from 'fs';
import * as path from 'path';
import { OmegaReplayParser } from './omega_replay_parser';

console.log("Start");
const p2 = path.join(__dirname, '../replays/YGO OMEGA REPLAY2.txt');
console.log("Path:", p2);

try {
    const c = fs.readFileSync(p2, 'utf8').trim();
    console.log("Read length:", c.length);

    // Test constructor
    // Note: older parser expected Buffer, we updated it to accept string?
    // Let's force Buffer to be safe if update failed
    const buf = Buffer.from(c, 'base64');
    console.log("Buffer len:", buf.length);

    const parser = new OmegaReplayParser(buf);
    console.log("Parser created");

    const replay = parser.parse();
    console.log("Parsed!");
    console.log("Deck1 Main len:", replay.deck1.main.length);
    console.log("Deck1 Extra len:", replay.deck1.extra.length);
    console.log("Sample:", replay.deck1.main.slice(0, 5));
} catch (e) {
    console.error("Error:", e);
}
