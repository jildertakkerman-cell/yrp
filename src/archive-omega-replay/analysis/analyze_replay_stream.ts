import { OmegaReplayParser } from '../parsers/omega_replay_parser';
import * as fs from 'fs';
import * as path from 'path';

async function analyze() {
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
    console.log(`Game Messages Size: ${buf.length}`);
    console.log(`First 100 bytes: ${buf.subarray(0, 100).toString('hex')}`);

    let cursor = 0;
    while (cursor < buf.length) {
        if (cursor >= buf.length) break;

        // Skip 0s? 
        if (buf[cursor] === 0) {
            // console.log(`Skipping 0 at ${cursor}`);
            cursor++;
            continue;
        }

        const msgId = buf.readUInt8(cursor);
        console.log(`MsgID: ${msgId} (0x${msgId.toString(16)}) at ${cursor}`);
        cursor++;

        // Just break after few messages to inspect manually
        if (cursor > 100) break;
    }
}

analyze().catch(console.error);
