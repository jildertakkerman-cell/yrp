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

    console.log("Analyzing UNKNOWN_MSG_0 (ID 0)...");

    // Group by length
    const byLength: { [len: number]: string[] } = {};

    for (const step of steps) {
        if (step.msgId === 0) {
            if (!byLength[step.len]) byLength[step.len] = [];
            byLength[step.len].push(step.raw);
        }
    }

    for (const lenStr in byLength) {
        const len = parseInt(lenStr);
        const samples = byLength[len];
        console.log(`\n=== Length ${len} (Count: ${samples.length}) ===`);

        // Show 3 samples
        for (let i = 0; i < Math.min(3, samples.length); i++) {
            const raw = samples[i];
            console.log(`[${i}] Raw: ${raw.substr(0, 64)}${raw.length > 64 ? '...' : ''}`);
            console.log(`    Asc: ${hexToAscii(raw.substr(0, 64))}`);

            // Try Int32
            if (len >= 4) {
                const buf = Buffer.from(raw, 'hex');
                const ints = [];
                for (let j = 0; j < Math.min(buf.length, 16); j += 4) {
                    if (j + 4 <= buf.length) ints.push(buf.readInt32LE(j));
                }
                console.log(`    Ints: ${ints.join(', ')}`);
            }
        }
    }

} catch (e) {
    console.error(e);
}
