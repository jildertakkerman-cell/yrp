import { ReplayDecoder } from '../src/replay_decoder';

const MSG_DRAW = 90;
const rawHex = "00010000007f3e39040a000000";
const buffer = Buffer.from(rawHex, 'hex');

// Mock helpers
function getLocationName(loc: number): string {
    if (loc === 1) return "DECK";
    if (loc === 2) return "HAND";
    return `UNKNOWN_LOCATION_${loc}`;
}

console.log("Parsing MSG_DRAW with hypothesized structure:");
// Hypothesis:
// player (1)
// count (1)
// cards:
//   code (4)
//   controller (4) ?? No, controller is usually 1 byte.
//   location (4) ??
//   sequence (4) ??
//   position (4) ??

// Let's look at the raw hex: 00 01 000000 7f3e3904 0a000000
// 00 -> player 0
// 01 -> count 1
// 000000 -> 3 bytes padding? Or is count 4 bytes?
// If count is 4 bytes: 01 00 00 00.
// Then 7f3e3904 -> code (70860415)
// Then 0a000000 -> 10?

// Wait, the current parser says:
// offset = 5 + i * 7
// 5 is 2 (player+count) + 3 (padding?)
// The raw hex is 13 bytes long.
// 00 (player)
// 01 (count)
// 00 00 00 (padding?)
// 7f 3e 39 04 (code)
// 0a 00 00 00 (???)

// If I read it as:
// player: 1 byte
// count: 1 byte
// padding: 3 bytes? No, that's weird.

// Let's try to match the values.
// Code 70860415 is 0x04393E7F.
// In raw: 7f 3e 39 04. So that's at offset 5?
// 00 01 00 00 00 7f 3e 39 04 0a 00 00 00
// 0  1  2  3  4  5  6  7  8  9  10 11 12

// If code is at 5, then 2,3,4 are 00 00 00.
// If count is 4 bytes, then 01 00 00 00 matches bytes 1-4.
// So player (1), count (4).
// Then code (4) at 5.
// Then 0a 00 00 00 at 9.
// 0x0A is 10.
// Is that the controller? location? sequence?
// 10 is 0x0A.
// If it's a card property...
// 0x0A = 10.
// In the JSON, controller is 10? That seems wrong. Controller is usually 0 or 1.
// Unless it's a bitfield?

// Let's check `replay.cpp` or `replay.h` if possible, or just guess.
// The JSON output says:
// "controller": 10,
// "location": 0,
// "sequence": 0

// The current parser reads:
// code: d.readUInt32LE(offset) -> offset 5.
// controller: d.readUInt8(offset + 4) -> offset 9 -> 0x0A (10).
// location: d.readUInt8(offset + 5) -> offset 10 -> 0x00.
// sequence: d.readUInt8(offset + 6) -> offset 11 -> 0x00.

// If the structure is:
// code (4)
// parameter (4)?
// 0x0A000000 -> 10.

// Maybe `MSG_DRAW` just has code? And the rest is implied?
// But `MSG_DRAW` usually implies drawing from DECK to HAND.
// So location should be HAND (2) or DECK (1).
// If it's not in the message, then it's implied.

// However, if the parser is reading 10 as controller, that's definitely wrong.

console.log("Raw buffer length:", buffer.length);
console.log("Player:", buffer.readUInt8(0));
console.log("Count (assuming 4 bytes):", buffer.readUInt32LE(1)); // 1
console.log("Code (at 5):", buffer.readUInt32LE(5)); // 70860415
console.log("Next 4 bytes (at 9):", buffer.readUInt32LE(9)); // 10

// If the next 4 bytes are 10...
// Maybe it's the sequence in hand?
// Or maybe it's the high bits of the code? No.

// Let's look at `replay_decoder.ts` again.
// It skips 3 bytes? No, `offset = 5`.
// 0 (player) + 1 (count) = 2.
// Where does 5 come from?
// Ah, the current parser does:
// player = d.readUInt8(0)
// count = d.readUInt8(1)
// loop i < count
// offset = 5 + i * 7.
// It skips bytes 2, 3, 4. Why?
// Maybe it assumes count is 4 bytes but reads it as 1 byte and skips 3?
// If count is 4 bytes, then offset should start at 5.

// If count is 4 bytes, then:
// player (1)
// count (4) -> 01 00 00 00
// content starts at 5.
// 7f 3e 39 04 -> code.
// 0a 00 00 00 -> ?
// If this is `code` (4) and `param` (4).
// 0x0A = 10.
// If it's `MSG_DRAW`, maybe it's `code` and `is_public`? Or `sequence`?

// If I look at `ocgapi_constants.h` or similar...
// But I don't have access to the C++ source of the *game*, only the parser.

// Let's assume the structure is:
// Code (4)
// Unknown (4)

// If I look at the JSON again:
// "controller": 10
// "location": 0
// "sequence": 0
// This comes from:
// controller: d.readUInt8(9) -> 0x0A
// location: d.readUInt8(10) -> 0x00
// sequence: d.readUInt8(11) -> 0x00

// If the 4 bytes at 9 are 0x0A000000.
// Maybe it's just the code? And the rest is padding?
// Or maybe `MSG_DRAW` only sends the code?
// If so, where does the parser get the idea of controller/location/sequence?
// It seems the parser *tries* to read them, but maybe they aren't there.

// Wait, if `MSG_DRAW` is just "Player X draws N cards: [Code1, Code2...]", then we don't need location/sequence/controller because it's always "Player X draws to Hand".
// The controller is Player X.
// The location is HAND.
// The sequence is the next available slot in HAND.

// So the parser might be over-reading.
// If the structure is:
// Player (1)
// Count (4)
// Cards (Count * 4 bytes) -> Just the codes?
// 1 + 4 + 1*4 = 9 bytes.
// But the raw length is 13 bytes.
// 13 - 9 = 4 bytes extra.
// Maybe each card is 8 bytes?
// Code (4) + ? (4)
// 1 + 4 + 1*8 = 13 bytes. Matches!

// So each card entry is 8 bytes.
// Code (4)
// ? (4) -> 0x0A000000 -> 10.
// What is 10?
// 0x80000000 is QUERY_END? No.
// 0x0A is 10.
// Maybe it's the high bits of the code? No.
// Maybe it's a flag?
// 0x8 is QUERY_TYPE? 0x2 is QUERY_POSITION?
// 8 | 2 = 10.
// But this is `MSG_DRAW`, not `MSG_UPDATE_DATA`.

// Let's check `replay.cpp` if available in the file list.
// I see `lib/replay.h` in the file list.
