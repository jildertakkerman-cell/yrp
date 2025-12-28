import { OmegaReplayParser } from '../parsers/omega_replay_parser';
import * as fs from 'fs';
import * as path from 'path';

async function dump() {
    const filePath = path.join(__dirname, '..', 'replays', 'YGO OMEGA REPLAY1.txt');
    const content = fs.readFileSync(filePath, 'utf-8').trim();

    console.log("Loading Omega Replay...");
    const parser = OmegaReplayParser.fromBase64(content);
    const replay = parser.parse();

    if (!replay.gameMessagesRaw) {
        console.error("No game messages found!");
        return;
    }

    const buf = replay.gameMessagesRaw;
    console.log(`Buffer Size: ${buf.length}`);
    console.log(`First 64 bytes hex:`);
    console.log(buf.subarray(0, 64).toString('hex').match(/../g)?.join(' '));

    // Dump first few inferred messages manually (assuming ID + Payload)
    let cursor = 0;
    for (let i = 0; i < 5; i++) {
        const id = buf[cursor];
        console.log(`[${i}] Offset ${cursor}: ID 0x${id.toString(16)} (${id})`);
        cursor++;
        // Just print next 30 bytes to visualize context
        console.log(`    Context: ${buf.subarray(cursor, cursor + 30).toString('hex')}`);
    }
}

dump().catch(console.error);
