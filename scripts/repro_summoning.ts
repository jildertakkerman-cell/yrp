import { ReplayDecoder } from '../src/replay_decoder';

const MSG_SUMMONING = 60;
const rawHex = "7f3e390400040200000001000000";
const buffer = Buffer.from(rawHex, 'hex');

// Mock helpers
function getLocationName(loc: number): string {
    if (loc === 4) return "MZONE";
    return `UNKNOWN_LOCATION_${loc}`;
}

function getPositionName(pos: number): string {
    if (pos === 1) return "FACEUP_ATTACK";
    if (pos === 4) return "FACEUP_DEFENSE";
    return `UNKNOWN_POS_${pos}`;
}

console.log("Parsing MSG_SUMMONING with hypothesized structure:");
// Hypothesis:
// code (4)
// controller (1) ??
// location (1) ??
// sequence (4) ??
// position (4) ??

// Raw hex: 7f 3e 39 04 00 04 02 00 00 00 01 00 00 00
// Length: 14 bytes.
// 7f 3e 39 04 -> Code (70860415)
// 00 -> Controller?
// 04 -> Location (MZONE)?
// 02 00 00 00 -> Sequence (2)?
// 01 00 00 00 -> Position (1 - FACEUP_ATTACK)?

console.log("Raw buffer length:", buffer.length);
const code = buffer.readUInt32LE(0);
const controller = buffer.readUInt8(4);
const location = buffer.readUInt8(5);
const sequence = buffer.readUInt32LE(6);
const position = buffer.readUInt32LE(10);

console.log({
    code,
    controller,
    location,
    locationName: getLocationName(location),
    sequence,
    position,
    positionName: getPositionName(position)
});
