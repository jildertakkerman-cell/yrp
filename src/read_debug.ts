import * as fs from 'fs';

const content = fs.readFileSync('deck_debug.txt', 'utf16le');
const lines = content.split('\n');
const out = [];
for (const line of lines) {
    if (line.includes('[DECK DEBUG]')) {
        out.push(line);
    }
}
fs.writeFileSync('clean_debug.txt', out.join('\n'));
