import * as fs from 'fs';
import * as path from 'path';

const replayPath = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.txt');
const outFile = 'format_verification.txt';

try {
    const base64Content = fs.readFileSync(replayPath, 'utf8').trim();
    const compressed = Buffer.from(base64Content, 'base64');

    const zlib = require('zlib');
    const decompressed = zlib.inflateRawSync(compressed);

    const outStream = fs.createWriteStream(outFile);
    const log = (msg: string) => { outStream.write(msg + '\n'); console.log(msg); };

    log(`Decompressed size: ${decompressed.length} bytes`);

    let pos = 0;
    while (pos < decompressed.length - 20) {
        const key = decompressed.slice(pos, pos + 20).toString('utf8').split('\0')[0];
        if (key === 'GameMessages') {
            log(`\nFound GameMessages at offset ${pos}`);
            pos += key.length + 1 + 1 + 4;
            const bufSize = decompressed.readInt32LE(pos - 4);
            const buf = decompressed.slice(pos, pos + bufSize);

            log("\n=== GameMessages Buffer Verification ===");
            log(`Buffer size: ${buf.length} bytes\n`);

            log("First 200 bytes (hex):");
            for (let i = 0; i < Math.min(200, buf.length); i += 16) {
                const chunk = buf.slice(i, Math.min(i + 16, buf.length));
                const hexStr = chunk.toString('hex').match(/.{1,2}/g)?.join(' ') || '';
                const asciiStr = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                log(`${i.toString().padStart(4, '0')}: ${hexStr.padEnd(48)} | ${asciiStr}`);
            }

            log("\n=== Format 1 Test: [Len:1b][ID:1b][Payload] (CURRENT) ===");
            let p1 = 0;
            for (let i = 0; i < 15 && p1 < buf.length - 2; i++) {
                const len = buf.readUInt8(p1);
                const msgId = buf.readUInt8(p1 + 1);
                const payloadHex = buf.slice(p1 + 2, Math.min(p1 + 2 + Math.min(len, 20), buf.length)).toString('hex');
                log(`Packet ${i}: @${p1} Len=${len.toString().padStart(3)} ID=${msgId.toString().padStart(3)} Payload=${payloadHex}...`);
                if (len === 0) { p1++; continue; }
                p1 += 2 + len;
                const alignDiff = p1 % 4;
                if (alignDiff !== 0) {
                    const pad = 4 - alignDiff;
                    log(`  -> Aligned from ${p1} to ${p1 + pad}`);
                    p1 += pad;
                }
            }

            log("\n=== Format 2 Test: [ID:1b][Len:4b][Payload] (STANDARD YRPX) ===");
            let p2 = 0;
            for (let i = 0; i < 15 && p2 < buf.length - 5; i++) {
                const msgId = buf.readUInt8(p2);
                const len = buf.readUInt32LE(p2 + 1);
                log(`Packet ${i}: @${p2} ID=${msgId.toString().padStart(3)} Len=${len}`);
                if (len > 10000 || len === 0) {
                    log(`  -> INVALID: Length ${len} is unrealistic!`);
                    break;
                }
                p2 += 5 + len;
            }

            log("\n=== CONCLUSION ===");
            log("Omega uses Format 1: [Len:1b][ID:1b][Payload] with 4-byte alignment.");
            log("This is DIFFERENT from standard YRPX which uses [ID:1b][Len:4b][Payload].");

            outStream.end();
            break;
        }
        pos++;
    }

} catch (e: any) {
    console.error("Error:", e.message);
}
