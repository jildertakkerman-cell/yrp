const fs = require('fs');
const path = require('path');

const filePath = 'ABC XYZ combo X - with TTG.yrpX.json';
const targetCode = 18326736;
const targetLoc = 192;

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`"code": ${targetCode}`)) {
        // Check surrounding lines for newLocation
        let foundLoc = false;
        for (let j = i; j < Math.min(lines.length, i + 20); j++) {
            if (lines[j].includes(`"newLocation": ${targetLoc}`)) {
                foundLoc = true;
                console.log(`Found MSG_MOVE at line ${i}:`);
                for (let k = Math.max(0, i - 5); k < j + 10; k++) {
                    console.log(`${k + 1}: ${lines[k]}`);
                }
                break;
            }
        }
        if (foundLoc) break;
    }
}
