import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function exportLetterToPdf(letterText, companyName, outputPath) {
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(12).text(`Lettre de motivation - ${companyName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(letterText);

    doc.end();

    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}
