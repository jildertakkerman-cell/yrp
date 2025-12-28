import * as fs from 'fs-extra';
import * as path from 'path';

// Manual definitions to avoid import issues
const MSG_START = 4;
// Hex 31 = Dec 49
const MSG_OMEGA_DATA = 49;

// Constants 
const LOCATION_DECK = 0x01;
const LOCATION_HAND = 0x02;
const LOCATION_MZONE = 0x04;
const LOCATION_SZONE = 0x08;
const LOCATION_GRAVE = 0x10;
const LOCATION_REMOVED = 0x20;
const LOCATION_EXTRA = 0x40;
const LOCATION_OVERLAY = 0x80;

function getLocationName(loc: number): string {
    if (loc & LOCATION_OVERLAY) return "OVERLAY";
    if (loc === LOCATION_DECK) return "DECK";
    if (loc === LOCATION_HAND) return "HAND";
    if (loc === LOCATION_MZONE) return "MZONE";
    if (loc === LOCATION_SZONE) return "SZONE";
    if (loc === LOCATION_GRAVE) return "GRAVE";
    if (loc === LOCATION_REMOVED) return "REMOVED";
    if (loc === LOCATION_EXTRA) return "EXTRA";
    return `UNKNOWN_LOCATION_${loc}`;
}

async function decodeOmegaReplay() {
    try {
        const inputPath = path.join(__dirname, '..', 'replays', '25_12_27-20_36_35.bytes.json');
        const outputPath = path.join(__dirname, '..', 'replays', '25_12_27-20_36_35.decoded.json');

        console.log(`Reading from ${inputPath}...`);
        const jsonContent = await fs.readJson(inputPath);

        if (!jsonContent.replayData) {
            console.error('Error: No replayData field found in JSON.');
            return;
        }

        const buffer = Buffer.from(jsonContent.replayData, 'base64');
        console.log(`Buffer size: ${buffer.length} bytes`);

        const steps = [];
        let cursor = 0;

        // Skip 8 byte header
        // 05 30 00 0f 00 00 00 00 
        cursor += 8;

        while (cursor < buffer.length) {
            const msgId = buffer.readUInt8(cursor);
            cursor += 1;

            if (msgId === MSG_START) {
                const data = buffer.subarray(cursor, cursor + 15);
                cursor += 15;

                steps.push({
                    type: 'MSG_START',
                    raw: data.toString('hex'),
                    details: {
                        type: data.readUInt8(0),
                        rule: data.readUInt8(1),
                        lp: data.readUInt32LE(2),
                        lp2: data.readUInt32LE(6),
                        deck1: data.readUInt8(10),
                        extra1: data.readUInt8(11),
                        deck2: data.readUInt8(12),
                        extra2: data.readUInt8(13),
                        hand: data.readUInt8(14)
                    }
                });
            } else if (msgId === MSG_OMEGA_DATA) { // 49
                const len = buffer.readUInt32LE(cursor);
                cursor += 4;

                const innerBuffer = buffer.subarray(cursor, cursor + len);
                cursor += len;

                steps.push({
                    type: 'MSG_OMEGA_DATA_CONTAINER',
                    len: len,
                    decoded: decodeInnerStream(innerBuffer)
                });
            } else {
                if (cursor + 4 > buffer.length) break;
                const len = buffer.readUInt32LE(cursor);

                if (len > buffer.length - cursor || len > 100000) {
                    console.log(`Abnormal length ${len} at cursor ${cursor} for ID ${msgId}. Aborting.`);
                    break;
                }

                cursor += 4;
                const data = buffer.subarray(cursor, cursor + len);
                cursor += len;

                steps.push({
                    type: `MSG_${msgId}`,
                    len: len,
                    raw: data.toString('hex')
                });
            }
        }

        console.log(`Decoded ${steps.length} steps.`);
        await fs.writeJson(outputPath, steps, { spaces: 2 });
        console.log(`Decoded data saved to ${outputPath}`);
    } catch (error) {
        console.error('Error decoding replay:', error);
    }
}

function decodeInnerStream(buffer: Buffer): any[] {
    const steps: any[] = [];
    let cursor = 0;

    let loopGuard = 0;
    while (cursor < buffer.length && loopGuard < 20000) {
        loopGuard++;

        // Skip 0s (padding/timestamps?)
        while (cursor < buffer.length && buffer[cursor] === 0) {
            cursor++;
        }
        if (cursor >= buffer.length) break;

        const msgId = buffer.readUInt8(cursor);
        cursor++;

        try {
            switch (msgId) {
                case 4: // MSG_START
                    if (cursor + 15 <= buffer.length) {
                        const raw = buffer.subarray(cursor, cursor + 15).toString('hex');
                        steps.push({ type: 'MSG_START', raw });
                        cursor += 15;
                    }
                    break;
                case 255: // 0xFF marker
                    // Skip 3 more bytes (total 4)
                    if (cursor + 3 <= buffer.length) {
                        cursor += 3;
                    }
                    break;
                case 8: // MSG_WAITING
                    // 0 payload?
                    steps.push({ type: 'MSG_WAITING' });
                    break;
                case 5: // MSG_WIN
                    if (cursor + 2 <= buffer.length) {
                        const player = buffer.readUInt8(cursor);
                        const type = buffer.readUInt8(cursor + 1);
                        cursor += 2;
                        steps.push({ type: 'MSG_WIN', player, winType: type });
                    }
                    break;
                case 6: // MSG_UPDATE_DATA
                    if (cursor + 6 <= buffer.length) {
                        const player = buffer.readUInt8(cursor);
                        const location = buffer.readUInt8(cursor + 1);
                        const dataLen = buffer.readUInt32LE(cursor + 2);
                        cursor += 6;

                        if (cursor + dataLen <= buffer.length) {
                            const data = buffer.subarray(cursor, cursor + dataLen);
                            cursor += dataLen;
                            steps.push({
                                type: 'MSG_UPDATE_DATA',
                                player, location, locationName: getLocationName(location), dataLen,
                                // raw: data.toString('hex') 
                            });
                        }
                    }
                    break;
                case 7: // MSG_UPDATE_CARD
                    // Variable length!
                    steps.push({
                        type: `MSG_UPDATE_CARD`,
                        cursorStart: cursor - 1,
                        context: buffer.subarray(cursor - 1, cursor + 19).toString('hex')
                    });
                    // Abort to analyze if it appears
                    return steps;
                case 40: // MSG_NEW_TURN
                    if (cursor + 1 <= buffer.length) {
                        const player = buffer.readUInt8(cursor);
                        cursor += 1;
                        steps.push({ type: 'MSG_NEW_TURN', player });
                    }
                    break;
                case 41: // MSG_NEW_PHASE
                    if (cursor + 2 <= buffer.length) {
                        const phase = buffer.readUInt16LE(cursor);
                        cursor += 2;
                        steps.push({ type: 'MSG_NEW_PHASE', phase });
                    }
                    break;
                case 50: // MSG_MOVE
                    if (cursor + 28 <= buffer.length) {
                        const data = buffer.subarray(cursor, cursor + 28);
                        cursor += 28;
                        steps.push({ type: 'MSG_MOVE', raw: data.toString('hex') });
                    }
                    break;
                case 90: // MSG_DRAW
                    if (cursor + 5 <= buffer.length) {
                        const player = buffer.readUInt8(cursor);
                        const count = buffer.readUInt32LE(cursor + 1);
                        cursor += 5;
                        const cards: number[] = [];
                        const cardBlockSize = 8;
                        if (cursor + count * cardBlockSize <= buffer.length) {
                            for (let i = 0; i < count; i++) {
                                const code = buffer.readUInt32LE(cursor);
                                cards.push(code);
                                cursor += cardBlockSize;
                            }
                            steps.push({ type: 'MSG_DRAW', player, count, cards });
                        }
                    }
                    break;
                case 52: // MSG_SET
                    if (cursor + 14 <= buffer.length) {
                        cursor += 14;
                        steps.push({ type: 'MSG_SET' });
                    }
                    break;
                case 60: // MSG_SUMMONING
                case 61: // MSG_SUMMONED
                case 62: // MSG_SPSUMMONING
                case 63: // MSG_SPSUMMONED
                case 64: // MSG_FLIPSUMMONING
                case 65: // MSG_FLIPSUMMONED
                    if (cursor + 14 <= buffer.length) {
                        const raw = buffer.subarray(cursor, cursor + 14).toString('hex');
                        cursor += 14;
                        steps.push({ type: `MSG_${msgId}`, raw });
                    }
                    break;
                case 70: // MSG_CHAINING
                    if (cursor + 31 <= buffer.length) {
                        cursor += 31;
                        steps.push({ type: 'MSG_CHAINING' });
                    }
                    break;

                default:
                    console.log(`Unknown MSG ID ${msgId} at inner cursor ${cursor - 1}`);
                    console.log(`Context: ${buffer.subarray(cursor - 1, cursor + 19).toString('hex')}`);
                    steps.push({
                        type: `UNKNOWN_MSG_${msgId}`,
                        cursorStart: cursor - 1,
                        context: buffer.subarray(cursor - 1, cursor + 19).toString('hex')
                    });
                    return steps;
            }
        } catch (e) {
            console.error('Error in inner decode loop', e);
            break;
        }
    }
    return steps;
}

decodeOmegaReplay();
