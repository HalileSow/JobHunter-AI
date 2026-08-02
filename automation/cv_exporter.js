import PDFDocument from 'pdfkit';
import fs from 'fs';

function stripMarkdown(text = '') {
    return String(text)
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '- ')
        .replace(/\r/g, '')
        .trim();
}

export async function exportCvToPdf(cvText, jobTitle, companyName, outputPath, highlights = []) {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(18).text(`CV ciblé - ${companyName}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(12).text(`Poste visé : ${jobTitle}`, { align: 'center' });
    doc.moveDown();

    if (highlights.length > 0) {
        doc.fontSize(11).text('Compétences et atouts ciblés', { underline: true });
        highlights.forEach((item) => {
            doc.text(`- ${item}`);
        });
        doc.moveDown();
    }

    doc.fontSize(11).text('CV source adapté', { underline: true });
    doc.moveDown(0.5);

    const content = stripMarkdown(cvText);
    doc.fontSize(10).text(content, {
        align: 'left',
        lineGap: 2
    });

    doc.end();

    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}
