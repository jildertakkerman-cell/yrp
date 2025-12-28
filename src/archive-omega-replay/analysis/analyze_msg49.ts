import * as fs from 'fs';
import * as path from 'path';

const inputFile = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.decoded.json');

try {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const steps = data.steps;

    const outStream = fs.createWriteStream('analysis_49.txt');
    const log = (msg: string) => { outStream.write(msg + '\n'); console.log(msg.slice(0, 100)); };

    log("Analyzing UNKNOWN_MSG_49 (ID 49)...");

    let lastInt = -1;
    let increasing = true;

    for (const step of steps) {
        if (step.msgId === 49) {
            const buf = Buffer.from(step.raw, 'hex');
            if (buf.length === 5) {
                const b0 = buf[0];
                const i1 = buf.readInt32LE(1);

                log(`Raw: ${step.raw} -> B0: ${b0} (0x${b0.toString(16)}), Int: ${i1}`);

                // Allow reset to 0 (new turn/duel?)
                if (i1 < lastInt && i1 !== 0) increasing = false;
                lastInt = i1;
            } else {
                log(`Raw: ${step.raw} (Len ${step.len}) - Unexpected Length`);
            }
        }
    }

    log(`\nIs Int32 strictly non-decreasing (allowing resets)? ${increasing}`);
    outStream.end();

} catch (e) {
    console.error(e);
}
