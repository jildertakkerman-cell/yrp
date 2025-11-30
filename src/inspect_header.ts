import * as fs from "fs-extra";

const REPLAY_COMPRESSED = 0x1;
const REPLAY_TAG = 0x2;
const REPLAY_DECODED = 0x4;
const REPLAY_SINGLE_MODE = 0x8;
const REPLAY_LUA64 = 0x10;
const REPLAY_NEWREPLAY = 0x20;
const REPLAY_HAND_TEST = 0x40;
const REPLAY_DIRECT_SEED = 0x80;
const REPLAY_64BIT_DUELFLAG = 0x100;
const REPLAY_EXTENDED_HEADER = 0x200;

async function inspect(file: string) {
    const buffer = await fs.readFile(file);
    const id = buffer.readUInt32LE(0);
    const version = buffer.readUInt32LE(4);
    const flag = buffer.readUInt32LE(8);
    const seed = buffer.readUInt32LE(12);
    const dataSize = buffer.readUInt32LE(16);
    const hash = buffer.readUInt32LE(20);
    const props = buffer.slice(24, 32);

    console.log("File:", file);
    console.log("ID:", id.toString(16));
    console.log("Version:", version);
    console.log("Flag:", flag.toString(16));
    console.log("  COMPRESSED:", !!(flag & REPLAY_COMPRESSED));
    console.log("  TAG:", !!(flag & REPLAY_TAG));
    console.log("  DECODED:", !!(flag & REPLAY_DECODED));
    console.log("  SINGLE_MODE:", !!(flag & REPLAY_SINGLE_MODE));
    console.log("  LUA64:", !!(flag & REPLAY_LUA64));
    console.log("  NEWREPLAY:", !!(flag & REPLAY_NEWREPLAY));
    console.log("  HAND_TEST:", !!(flag & REPLAY_HAND_TEST));
    console.log("  DIRECT_SEED:", !!(flag & REPLAY_DIRECT_SEED));
    console.log("  64BIT_DUELFLAG:", !!(flag & REPLAY_64BIT_DUELFLAG));
    console.log("  EXTENDED_HEADER:", !!(flag & REPLAY_EXTENDED_HEADER));
    console.log("Seed:", seed);
    console.log("DataSize:", dataSize);
    console.log("Hash:", hash);
    console.log("Props:", props.toString('hex'));
}

inspect(process.argv[2]).catch(console.error);
