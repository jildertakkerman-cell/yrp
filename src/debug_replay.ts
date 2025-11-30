import { Replay } from './index';
import * as fs from 'fs';

const filename = 'ABC XYZ combo X.yrpX';

try {
    const buffer = fs.readFileSync(filename);
    console.log(`File size: ${buffer.length} bytes`);
    console.log(`First 100 bytes (hex):`, buffer.slice(0, 100).toString('hex'));

    // Read header manually
    const id = buffer.readUInt32LE(0);
    const version = buffer.readUInt32LE(4);
    const flag = buffer.readUInt32LE(8);
    const seed = buffer.readUInt32LE(12);
    const dataSize = buffer.readUInt32LE(16);
    const hash = buffer.readUInt32LE(20);
    const props = buffer.slice(24, 32);

    console.log('\nHeader:');
    console.log(`  ID: 0x${id.toString(16)} (${id})`);
    console.log(`  Version: ${version}`);
    console.log(`  Flag: 0x${flag.toString(16)} (${flag})`);
    console.log(`  Seed: ${seed}`);
    console.log(`  Data Size: ${dataSize}`);
    console.log(`  Hash: ${hash}`);
    console.log(`  Props:`, props.toString('hex'));

    console.log(`\nFlag breakdown:`);
    console.log(`  REPLAY_COMPRESSED (0x1): ${(flag & 0x1) ? 'YES' : 'NO'}`);
    console.log(`  REPLAY_TAG (0x2): ${(flag & 0x2) ? 'YES' : 'NO'}`);
    console.log(`  REPLAY_SINGLE_MODE (0x8): ${(flag & 0x8) ? 'YES' : 'NO'}`);
    console.log(`  REPLAY_NEWREPLAY (0x20): ${(flag & 0x20) ? 'YES' : 'NO'}`);

    console.log(`\nCompressed data starts at byte 32, size: ${buffer.length - 32}`);
    console.log(`First 50 bytes of compressed data:`, buffer.slice(32, 82).toString('hex'));

} catch (error) {
    console.error('Error:', error);
}
