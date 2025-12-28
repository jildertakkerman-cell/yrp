import { OmegaReplayParser } from './omega_replay_parser';
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
    let cursor = 0;

    console.log("Decoding as [Len(1) + ID(1) + Data(Len)]...");

    while (cursor < buf.length) {
        if (cursor + 2 > buf.length) break;

        const len = buf.readUInt8(cursor);
        cursor++;

        if (len === 0) {
            // Treating 0 length as padding or just skip?
            // If followed by 0, padding?
            // Let's print invalid if we stuck in 0s
            if (cursor < buf.length && buf[cursor] === 0) {
                console.log(`[${cursor - 1}] Padding 00s...`);
                while (cursor < buf.length && buf[cursor] === 0) cursor++;
            }
            continue;
        }

        if (cursor >= buf.length) break;
        const id = buf.readUInt8(cursor);
        cursor++;

        const dataLen = len; // Or len includes ID? My hypothesis was len = payload size (excluding ID).
        // Let's assume Len = payload size.

        if (cursor + dataLen > buf.length) {
            console.log(`[${cursor - 2}] len=${len}, ID=${id}. Not enough data.`);
            break;
        }

        const data = buf.subarray(cursor, cursor + dataLen);
        cursor += dataLen;

        console.log(`[${cursor - dataLen - 2}] Len=${len} ID=${id} (0x${id.toString(16)}) Data=${data.toString('hex')}`);

        if (cursor > 500) break; // Limit output
    }
}

analyze().catch(console.error);
