const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function processOCR() {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    
    process.stdin.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) process.exit(1);

        try {
            console.error("Preprocessing...");
            const processedBuffer = await sharp(buffer)
                .resize(2500)
                .grayscale()
                .normalize()
                .toBuffer();

            const tessdataPath = path.join(process.cwd(), 'tessdata');
            
            // Re-download or ensure eng exists? I already did.
            // Let's try just 'por' to be safe first.
            const worker = await createWorker('por', 1, {
                langPath: tessdataPath,
                cachePath: process.cwd(),
            });

            console.error("Recognizing...");
            const { data: { text } } = await worker.recognize(processedBuffer);
            await worker.terminate();

            if (text) {
                console.error(`Success: ${text.length} chars`);
                process.stdout.write(text);
            } else {
                console.error("No text found");
                process.stdout.write("");
            }
            process.exit(0);
        } catch (error) {
            console.error("OCR Error:", error);
            process.exit(1);
        }
    });
}

processOCR();
