import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'replays', 'YGO OMEGA REPLAY1.txt');
const content = fs.readFileSync(filePath, 'utf-8').trim();
const buffer = Buffer.from(content, 'base64');

console.log('Use Length:', content.length);
console.log('Buffer Length:', buffer.length);
console.log('Header Hex:', buffer.subarray(0, 32).toString('hex'));
console.log('Header String:', buffer.subarray(0, 32).toString('utf-8')); // Just in case
