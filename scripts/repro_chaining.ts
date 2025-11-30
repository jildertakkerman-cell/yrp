import { ReplayDecoder } from '../src/replay_decoder';

const MSG_CHAINING = 70;
const rawHex = "b55c9f0000040400000001000000000404000000000000000000000001000000";
const buffer = Buffer.from(rawHex, 'hex');

// Mock helpers
function getLocationName(loc: number): string {
    if (loc === 4) return "MZONE";
    return `UNKNOWN_LOCATION_${loc}`;
}

console.log("Parsing MSG_CHAINING with hypothesized structure:");
// Hypothesis:
// code (4)
// pcode (4)
// function (4)
// triggerController (1)
// triggerLocation (1)
// triggerSequence (4)
// triggerPosition (4)? No, current parser doesn't read triggerPosition.
// controller (1)
// location (1)
// sequence (4)
// desc (4)

// Raw hex: b5 5c 9f 00 00 04 04 00 00 00 01 00 00 00 00 04 04 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00
// Length: 32 bytes.

// 0-3: b5 5c 9f 00 -> code (10443957)
// 4-7: 00 04 04 00 -> pcode (263168)
// 8-11: 00 00 01 00 -> function (65536)
// 12: 00 -> triggerController (0)
// 13: 00 -> triggerLocation (0)
// 14-17: 00 00 04 04 -> triggerSequence? 0x04040000? No.
// 14: 00
// 15: 04
// 16: 04
// 17: 00

// Let's look at the values.
// 12: 00
// 13: 00
// 14: 00
// 15: 00
// 16: 04
// 17: 04
// 18: 00
// 19: 00
// 20: 00
// 21: 00
// 22: 00
// 23: 00
// 24: 00
// 25: 00
// 26: 00
// 27: 00
// 28: 01
// 29: 00
// 30: 00
// 31: 00

// Wait, raw hex again:
// b5 5c 9f 00 (code)
// 00 04 04 00 (pcode)
// 00 00 01 00 (function)
// 00 (triggerController)
// 00 (triggerLocation)
// 00 00 00 00 (triggerSequence 4 bytes?)
// 04 (controller)
// 04 (location)
// 00 00 00 00 (sequence 4 bytes?)
// 00 00 00 00 (desc 4 bytes?)
// 01 00 00 00 (???)

// Total bytes: 4+4+4+1+1+4+1+1+4+4+4 = 32 bytes?
// 12 + 1 + 1 + 4 = 18.
// 18 + 1 + 1 + 4 = 24.
// 24 + 4 = 28.
// 28 + 4 = 32.

// So:
// code (4)
// pcode (4)
// function (4)
// triggerController (1)
// triggerLocation (1)
// triggerSequence (4)
// controller (1)
// location (1)
// sequence (4)
// desc (4)
// param (4) ??

// Let's try to parse with this structure.

console.log("Raw buffer length:", buffer.length);
const code = buffer.readUInt32LE(0);
const pcode = buffer.readUInt32LE(4);
const func = buffer.readUInt32LE(8);
const triggerController = buffer.readUInt8(12);
const triggerLocation = buffer.readUInt8(13);
const triggerSequence = buffer.readUInt32LE(14);
const controller = buffer.readUInt8(18);
const location = buffer.readUInt8(19);
const sequence = buffer.readUInt32LE(20);
const desc = buffer.readUInt32LE(24);
const param = buffer.readUInt32LE(28);

console.log({
    code,
    pcode,
    func,
    triggerController,
    triggerLocation,
    triggerLocationName: getLocationName(triggerLocation),
    triggerSequence,
    controller,
    location,
    locationName: getLocationName(location),
    sequence,
    desc,
    param
});
