import * as fs from 'fs';
import * as path from 'path';

const inputFile = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.decoded.json');
const outFile = 'analysis_159.txt';

function hexToAscii(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        str += (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.';
    }
    return str;
}

try {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const steps = data.steps;

    const outStream = fs.createWriteStream(outFile);
    const log = (msg: string) => {
        outStream.write(msg + '\n');
        console.log(msg.substr(0, 100)); // Limit console output
    };

    log("Analyzing MSG_SERVER_PACKET_159 (ID 159)...");

    let count = 0;

    for (const step of steps) {
        if (step.msgId === 159) {
            log(`\nPacket #${count} (Len ${step.len}):`);

            if (step.raw.startsWith('ffff')) {
                const buf = Buffer.from(step.raw, 'hex');
                // Skip ffff (2 bytes)
                const ints = [];
                let offset = 2;
                while (offset + 4 <= buf.length) {
                    ints.push(buf.readInt32LE(offset));
                    offset += 4;
                }
                log(`  -> Ints (${ints.length}): [${ints.slice(0, 15).join(', ')} ... ]`);
                log(`  -> Tail (${buf.length - offset} bytes): ${buf.slice(offset).toString('hex')}`);
            } else {
                log(`Raw: ${step.raw.substr(0, 64)}...`);
            }
            count++;
        }
    }

    log(`\nTotal 159 Packets: ${count}`);
    outStream.end();
} catch (e) {
    console.error("Error:", e);
}
