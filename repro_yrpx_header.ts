
import { ReplayParserTS } from './src/replay_parser_ts';
import * as fs from 'fs';
// @ts-ignore
import * as lzma from 'lzma-purejs';

const REPLAY_COMPRESSED = 0x1;
const REPLAY_EXTENDED_HEADER = 0x200;
const REPLAY_YRPX = 0x58707279;

async function run() {
    console.log("Creating dummy replay with extended header...");

    // 1. Create dummy data
    const dummyData = Buffer.from("Hello World Replay Data");

    // 2. Compress it
    // lzma-purejs compressFile returns a Buffer
    const compressed = lzma.compressFile(dummyData);
    console.log(`Compressed size: ${compressed.length}`);

    // 3. Create Header
    // Total header size = 32 (base) + 40 (extended) = 72
    const headerSize = 32 + 40;
    const buffer = Buffer.alloc(headerSize + compressed.length - 13); // -13 because we strip LZMA header from compressed usually?
    // Wait, ReplayParserTS expects:
    // props = buffer.slice(24, 29)
    // compressedData = buffer.slice(32) (currently)

    // The compressed buffer from lzma.compressFile includes the 13 byte header.
    // We need to extract props (5 bytes) and put them in the YRPX header.
    // And put the rest (data) after the YRPX header.

    const props = compressed.slice(0, 5);
    const data = compressed.slice(13); // Skip 13 byte header (props + size)

    // Write YRPX Header
    buffer.writeUInt32LE(REPLAY_YRPX, 0); // id
    buffer.writeUInt32LE(1, 4); // version
    buffer.writeUInt32LE(REPLAY_COMPRESSED | REPLAY_EXTENDED_HEADER, 8); // flag
    buffer.writeUInt32LE(12345, 12); // seed
    buffer.writeUInt32LE(dummyData.length, 16); // dataSize
    buffer.writeUInt32LE(0, 20); // hash

    props.copy(buffer, 24); // props at 24

    // If extended header is supported, data should start at 32 + 40 = 72.
    // If not supported (current bug), it reads from 32.

    // We place data at 72.
    data.copy(buffer, 72);

    // Fill the extended header area with garbage to ensure failure if read as data
    buffer.fill(0xAA, 32, 72);

    console.log(`Created buffer of size ${buffer.length}`);

    try {
        const parser = new ReplayParserTS(buffer);
        await parser.parse();
        console.log("SUCCESS: Parsed successfully (Unexpected if bug exists)");
    } catch (e: any) {
        console.log("CAUGHT ERROR: " + e.message);
        if (e.message.includes("Failed to decompress")) {
            console.log("VERIFIED: Reproduction successful - failed to decompress due to offset mismatch.");
        } else {
            console.log("FAILED: Different error caught.");
        }
    }
}

run().catch(console.error);
