import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function exportLetterToPdf(letterText, companyName, outputPath) {
    const dir = path.dirname(outputPath);
    let base = path.basename(outputPath, '.pdf');

    if (base.length > 80) {
        const safeBase = base.substring(0, 70).replace(/_+$/, '');
        const unique = Date.now().toString(36);
        outputPath = path.join(dir, `${safeBase}_${unique}.pdf`);
    }

    await fs.promises.mkdir(dir, { recursive: true });

    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(12).text(`Lettre de motivation - ${companyName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(letterText);

    doc.end();

    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(outputPath));
        writeStream.on('error', reject);
    });
}
