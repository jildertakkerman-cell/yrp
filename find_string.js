const fs = require('fs');
const path = require('path');

const filePath = 'replays/ABC XYZ combo X - with TTG.yrpX.json';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const targetCode = 77411244;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"type": "MSG_CHAINING"')) {
        // Check next 20 lines for code
        for (let j = i; j < Math.min(lines.length, i + 20); j++) {
            if (lines[j].includes(`"code": ${targetCode}`)) {
                console.log(`Found Chaining at line ${i}:`);
                for (let k = i; k < i + 20; k++) {
                    console.log(`${k + 1}: ${lines[k]}`);
                }
                // Only first one
                i = lines.length;
                break;
            }
        }
    }
}
