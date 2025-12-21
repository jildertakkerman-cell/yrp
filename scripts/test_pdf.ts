import * as fs from 'fs';
import * as path from 'path';
import { generatePDF } from '../src/pdf_generator';

async function test() {
    try {
        const comboPath = path.join(process.cwd(), 'distilled_combo.json');
        if (!fs.existsSync(comboPath)) {
            console.error('distilled_combo.json not found');
            return;
        }

        const comboData = JSON.parse(fs.readFileSync(comboPath, 'utf8'));
        console.log('Generating PDF...');
        const buffer = await generatePDF(comboData);

        const outputPath = path.join(process.cwd(), 'test_output.pdf');
        fs.writeFileSync(outputPath, buffer);
        console.log(`PDF created at ${outputPath}`);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
