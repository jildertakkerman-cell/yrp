import * as fs from 'fs';
import * as path from 'path';

const inputFile = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.decoded.json');

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

    console.log("Analyzing MSG_SERVER_235 (ID 235)...");

    // Group by length
    const byLength: { [len: number]: string[] } = {};

    for (const step of steps) {
        if (step.msgId === 235) {
            if (!byLength[step.len]) byLength[step.len] = [];
            byLength[step.len].push(step.raw);
        }
    }

    for (const lenStr in byLength) {
        const len = parseInt(lenStr);
        const samples = byLength[len];
        console.log(`\n=== Length ${len} (Count: ${samples.length}) ===`);

        for (let i = 0; i < samples.length; i++) {
            const raw = samples[i];
            console.log(`[${i}] Raw: ${raw.substr(0, 64)}${raw.length > 64 ? '...' : ''}`);
            console.log(`    Asc: ${hexToAscii(raw)}`);

            // Look for patterns
            const sub = 'ff9fffff';
            if (raw.includes(sub)) {
                console.log(`    -> Contains Signature ${sub} at index ${raw.indexOf(sub)}`);
            }

            // Dump ints
            const buf = Buffer.from(raw, 'hex');
            const ints = [];
            for (let j = 0; j < buf.length; j += 4) {
                if (j + 4 <= buf.length) ints.push(buf.readInt32LE(j));
            }
            console.log(`    Ints: ${ints.slice(0, 20).join(', ')} ...`);
        }
    }

} catch (e) {
    console.error(e);
}
