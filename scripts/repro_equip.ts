import { ReplayDecoder } from '../src/replay_decoder';

const MSG_EQUIP = 93;
const rawHex = "0008030000000500000000040400000004000000";
const buffer = Buffer.from(rawHex, 'hex');

// Mock helpers since they are not exported
function getLocationName(loc: number): string {
    if (loc === 8) return "SZONE";
    if (loc === 4) return "MZONE";
    return `UNKNOWN_LOCATION_${loc}`;
}

// We need to temporarily modify the decoder to test our hypothesis
// or we can just manually parse the buffer in this script to verify the values match expected.

console.log("Parsing MSG_EQUIP with hypothesized structure:");
const controller = buffer.readUInt8(0);
const location = buffer.readUInt8(1);
const sequence = buffer.readUInt32LE(2);
const position = buffer.readUInt32LE(6);
const targetController = buffer.readUInt8(10);
const targetLocation = buffer.readUInt8(11);
const targetSequence = buffer.readUInt32LE(12);
const targetPosition = buffer.readUInt32LE(16);

console.log({
    controller,
    location,
    locationName: getLocationName(location),
    sequence,
    position,
    targetController,
    targetLocation,
    targetLocationName: getLocationName(targetLocation),
    targetSequence,
    targetPosition
});
