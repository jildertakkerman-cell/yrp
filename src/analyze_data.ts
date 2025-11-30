import * as fs from 'fs';

const dump = JSON.parse(fs.readFileSync('replay_dump_new.json', 'utf8'));

function analyzeUpdateData(raw: string) {
    const buf = Buffer.from(raw, 'hex');
    let cursor = 0;
    // Skip header: player(1) + loc(1) + len(4) = 6 bytes
    // Wait, the 'raw' in dump includes the message ID?
    // In replay_decoder.ts:
    // [MSG_UPDATE_DATA]: (d) => ...
    // The 'd' passed to parser is the payload.
    // In dump, "raw" is the full message payload?
    // Let's check replay_decoder.ts decode loop.
    // It reads msgId, then len, then reads 'len' bytes as data.
    // Then calls parser(data).
    // So 'raw' in dump is the payload passed to parser.

    // MSG_UPDATE_DATA payload:
    // player(1), location(1), dataLen(4), data(...)

    const player = buf.readUInt8(0);
    const location = buf.readUInt8(1);
    const dataLen = buf.readUInt32LE(2);
    const data = buf.slice(6);

    console.log(`MSG_UPDATE_DATA: Player ${player}, Loc ${location}, DataLen ${dataLen}`);

    if (data.length !== dataLen) {
        console.log(`  Warning: Data length mismatch. Expected ${dataLen}, got ${data.length}`);
    }

    // Try parsing data as [u16 len] [bytes] chunks
    let dCursor = 0;
    let chunkCount = 0;
    let validChunks = true;

    while (dCursor < data.length) {
        if (dCursor + 2 > data.length) {
            console.log(`  Error: Truncated length at ${dCursor}`);
            validChunks = false;
            break;
        }
        const chunkLen = data.readUInt16LE(dCursor);
        dCursor += 2;
        if (dCursor + chunkLen > data.length) {
            console.log(`  Error: Chunk length ${chunkLen} exceeds buffer at ${dCursor}`);
            validChunks = false;
            break;
        }
        const chunk = data.slice(dCursor, dCursor + chunkLen);
        // console.log(`  Chunk ${chunkCount}: Len ${chunkLen}, Data: ${chunk.toString('hex')}`);

        // Analyze chunk content
        // If len is 8, it might be [Unknown 4] [CardCode 4]
        if (chunkLen === 8) {
            const u1 = chunk.readUInt32LE(0);
            const code = chunk.readUInt32LE(4);
            // console.log(`    -> U1: ${u1}, Code: ${code}`);
        }

        dCursor += chunkLen;
        chunkCount++;
    }

    if (validChunks) {
        console.log(`  Success: Parsed ${chunkCount} chunks.`);
    }
}

function analyzeReloadField(raw: string) {
    const buf = Buffer.from(raw, 'hex');
    // MSG_RELOAD_FIELD payload:
    // player(1) + data...

    const player = buf.readUInt8(0);
    const data = buf.slice(1);

    console.log(`MSG_RELOAD_FIELD: Player ${player}, Len ${data.length}`);

    if (data.length >= 8) {
        const val1 = data.readUInt32LE(0);
        const val2 = data.readUInt32LE(4);
        console.log(`  Offset 0 (Flags?): ${val1} (0x${val1.toString(16)})`);
        console.log(`  Offset 4 (LP1?): ${val2}`);
    }

    // Look for LP2 (8000 = 0x1f40)
    for (let i = 0; i < data.length - 4; i += 4) {
        const val = data.readUInt32LE(i);
        if (val === 8000) {
            console.log(`  Found 8000 at offset ${i}`);
        }
    }
}

console.log("Analyzing MSG_UPDATE_DATA...");
for (const step of dump.steps) {
    if (step.type === 'MSG_UPDATE_DATA') {
        analyzeUpdateData(step.raw);
        break; // Analyze first one
    }
}

console.log("\nAnalyzing MSG_RELOAD_FIELD...");
for (const step of dump.steps) {
    if (step.type === 'MSG_RELOAD_FIELD') {
        analyzeReloadField(step.raw);
        break;
    }
}
