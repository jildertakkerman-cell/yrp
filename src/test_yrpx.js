const fs = require('fs');
const path = require('path');
const lzma = require('lzma-purejs');

async function testYrpx() {
    const filePath = path.join(process.cwd(), 'ABC XYZ combo X.yrpX');
    const buffer = fs.readFileSync(filePath);

    const flag = buffer.readUInt32LE(8);
    const dataSize = buffer.readUInt32LE(16);

    console.log('Flag:', flag.toString(16));
    console.log('Compressed:', !!(flag & 0x1));
    console.log('Data Size:', dataSize);

    if (flag & 0x1) {
        const props = buffer.slice(24, 29);
        const compressedData = buffer.slice(32);

        const lzmaHeader = Buffer.alloc(13);
        props.copy(lzmaHeader, 0);
        lzmaHeader.writeUInt32LE(dataSize, 5);
        lzmaHeader.writeUInt32LE(0, 9);

        console.log('Props:', props.toString('hex'));
        console.log('Header:', lzmaHeader.toString('hex'));
        console.log('Compressed data length:', compressedData.length);
        console.log('First 20 bytes of compressed:', compressedData.slice(0, 20).toString('hex'));

        try {
            console.log('Attempting with header...');
            const lzmaStream = Buffer.concat([lzmaHeader, compressedData]);
            const result = lzma.decompressFile(lzmaStream);
            console.log('Success! Result type:', typeof result);
            console.log('Result length:', result.length || 'N/A');
        } catch (e) {
            console.error('Failed with header:', e.message);

            // Try without size in header
            try {
                console.log('\\nAttempting with unknown size...');
                const unknownSizeHeader = Buffer.alloc(13);
                props.copy(unknownSizeHeader, 0);
                unknownSizeHeader.writeUInt32LE(0xffffffff, 5);
                unknownSizeHeader.writeUInt32LE(0xffffffff, 9);
                const stream2 = Buffer.concat([unknownSizeHeader, compressedData]);
                const result2 = lzma.decompressFile(stream2);
                console.log('Success with unknown size! Length:', result2.length);
            } catch (e2) {
                console.error('Also failed with unknown size:', e2.message);
            }
        }
    }
}

testYrpx();
