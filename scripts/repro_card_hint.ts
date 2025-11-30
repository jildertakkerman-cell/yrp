import { ReplayDecoder } from '../src/replay_decoder';

const MSG_CARD_HINT = 160;
const rawHex = "0008030000000500000006030050da523f0000";
const buffer = Buffer.from(rawHex, 'hex');

// Mock helpers
function getLocationName(loc: number): string {
    if (loc === 8) return "SZONE";
    return `UNKNOWN_LOCATION_${loc}`;
}

function getPositionName(pos: number): string {
    if (pos === 5) return "FACEUP_ATTACK|FACEUP_DEFENSE"; // Example
    return `UNKNOWN_POS_${pos}`;
}

function getCardHintName(type: number): string {
    if (type === 6) return "CHINT_DESC_ADD";
    return `UNKNOWN_CHINT_${type}`;
}

console.log("Parsing MSG_CARD_HINT with hypothesized structure:");
// Hypothesis:
// controller (1)
// location (1)
// sequence (4)
// position (4)
// type (4)
// val (4)
// Total: 1 + 1 + 4 + 4 + 4 + 4 = 18 bytes?
// Raw length is 19 bytes.
// Maybe there's padding? Or one field is 1 byte?

// Let's look at raw: 00 08 03000000 05000000 06 030050da 523f0000
// 00 -> Controller (0)
// 08 -> Location (SZONE)
// 03 00 00 00 -> Sequence (3)
// 05 00 00 00 -> Position (5)
// 06 -> Type (CHINT_DESC_ADD)?
// 03 00 50 da -> Val?
// 52 3f 00 00 -> ?

// Wait, the raw hex is:
// 00 08 03 00 00 00 05 00 00 00 06 03 00 50 da 52 3f 00 00
// Length: 19 bytes.

// 00 (1)
// 08 (1)
// 03 00 00 00 (4) -> Sequence 3
// 05 00 00 00 (4) -> Position 5
// 06 (1) -> Type 6 (CHINT_DESC_ADD)
// 03 00 50 da (4) -> Val?
// 52 3f 00 00 (4) -> ?

// The current parser reads:
// controller (1)
// location (1)
// sequence (1) -> 03
// position (1) -> 00
// type (1) -> 00
// val (4) -> 00 00 05 00 -> 5?

// If sequence is 4 bytes (03 00 00 00), then position starts at 6.
// If position is 4 bytes (05 00 00 00), then type starts at 10.
// If type is 1 byte (06), then val starts at 11.
// 11 + 4 = 15 bytes.
// But we have 19 bytes.

// Maybe type is 4 bytes?
// 06 03 00 50 -> Type? That's huge.
// Or maybe 06 is type, and then 3 bytes padding?
// 06 00 00 00?
// But the next byte is 03.

// Let's check the values.
// Sequence 3 makes sense.
// Position 5 makes sense.
// Type 6 (CHINT_DESC_ADD) makes sense.
// Val?
// The raw hex ends with `da 52 3f 00 00`.
// `da 52 3f` looks like part of a float or something? Or just random?
// Wait, `00 08 03 00 00 00 05 00 00 00 06 03 00 50 da 52 3f 00 00`
// 19 bytes is odd.

// Let's try:
// Controller (1)
// Location (1)
// Sequence (4)
// Position (4)
// Type (4)
// Val (4)
// Total 18 bytes.
// Where is the 19th byte? Or is it 20 bytes and one was cut off?
// The JSON says "len": 19.

// Let's try to read it as:
// Controller (1)
// Location (1)
// Sequence (4)
// Position (4)
// Type (4)
// Val (4)
// And see what we get.

console.log("Raw buffer length:", buffer.length);
const controller = buffer.readUInt8(0);
const location = buffer.readUInt8(1);
const sequence = buffer.readUInt32LE(2);
const position = buffer.readUInt32LE(6);
const type = buffer.readUInt32LE(10); // 0x50000306? No.
// 06 03 00 50 -> 0x50000306.
// If type is 1 byte: 06.
// Then what is 03 00 50 da?
// Maybe val is 4 bytes?
// If type is 1 byte, val starts at 11.
// 03 00 50 da -> 0xda500003?

// Let's just print the values.
console.log({
    controller,
    location,
    locationName: getLocationName(location),
    sequence,
    position,
    positionName: getPositionName(position),
    typeAt10: buffer.readUInt32LE(10),
    byteAt10: buffer.readUInt8(10),
    byteAt11: buffer.readUInt8(11),
    valAt11: buffer.readUInt32LE(11), // If type is 1 byte
    valAt14: buffer.readUInt32LE(14)  // If type is 4 bytes
});
