import * as fs from 'fs';
import * as path from 'path';
import http from 'http';

const filePath = path.join(process.cwd(), 'res', 'yrp-basic.yrp');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/parse',
    method: 'POST',
    headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(fileBuffer);
req.end();
