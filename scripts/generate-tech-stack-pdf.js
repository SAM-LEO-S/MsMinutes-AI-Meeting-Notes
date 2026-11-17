import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const mdPath = path.join(__dirname, '..', 'TECH_STACK.md');
const pdfPath = path.join(__dirname, '..', 'TECH_STACK.pdf');

console.log('Reading TECH_STACK.md...');
const mdContent = fs.readFileSync(mdPath, 'utf-8');

console.log('Generating PDF...');
const doc = new PDFDocument({ margin: 50, size: 'A4' });
const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);

// Add title page
doc.fontSize(24).font('Helvetica-Bold').fillColor('#1e3a8a')
  .text('MsMinutes AI Meeting Notes', { align: 'center' })
  .moveDown(0.5)
  .fontSize(18).fillColor('#4b5563')
  .text('Technical Stack & External APIs', { align: 'center' })
  .moveDown(2)
  .fontSize(12).fillColor('#6b7280')
  .text('Prepared for Management Review', { align: 'center' })
  .moveDown(0.5)
  .text(new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), { align: 'center' });

doc.addPage();

// Parse and render markdown
const lines = mdContent.split('\n');
let yPosition = 50;
const pageHeight = doc.page.height;
const marginBottom = 50;

lines.forEach((line) => {
  // Check if we need a new page
  if (yPosition > pageHeight - marginBottom) {
    doc.addPage();
    yPosition = 50;
  }

  // Handle headers
  const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headerMatch) {
    const level = headerMatch[1].length;
    const fontSize = Math.max(10, 24 - level * 3);
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#1e3a8a')
      .text(headerMatch[2], { continued: false })
      .moveDown(0.3);
    yPosition += fontSize + 10;
  }
  // Handle bullet points
  else if (line.startsWith('- ')) {
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(`• ${line.substring(2)}`, { continued: false });
    yPosition += 15;
  }
  // Handle numbered lists
  else if (line.match(/^\d+\./)) {
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(line, { continued: false });
    yPosition += 15;
  }
  // Handle code blocks (simplified)
  else if (line.startsWith('```')) {
    doc.font('Courier').fillColor('#dc2626');
    yPosition += 5;
  }
  // Handle bold text
  else if (line.includes('**')) {
    const parts = line.split('**');
    let text = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        text += parts[i];
      } else {
        text += parts[i];
      }
    }
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(text, { continued: false });
    yPosition += 15;
  }
  // Handle inline code
  else if (line.includes('`')) {
    const parts = line.split('`');
    let text = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        text += parts[i];
      } else {
        text += parts[i];
      }
    }
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(text, { continued: false });
    yPosition += 15;
  }
  // Handle empty lines
  else if (line.trim() === '') {
    doc.moveDown(0.3);
    yPosition += 5;
  }
  // Regular text
  else {
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(line, { continued: false });
    yPosition += 15;
  }
});

// Add footer
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  doc.fontSize(9).fillColor('#9ca3af')
    .text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 30, {
      align: 'center'
    });
}

doc.end();

stream.on('finish', () => {
  console.log(`PDF generated successfully: ${pdfPath}`);
});
