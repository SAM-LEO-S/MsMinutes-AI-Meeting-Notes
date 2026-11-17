import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Import pdfkit from the api-server package
const pdfkitPath = path.join(__dirname, '..', 'artifacts', 'api-server', 'node_modules', 'pdfkit');

interface Section {
  level: number;
  title: string;
  content: string;
}

function parseMarkdown(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check for headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        sections.push(currentSection);
      }
      // Start new section
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2],
        content: ''
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n');
    sections.push(currentSection);
  }

  return sections;
}

function generatePDF(sections: Section[], outputPath: string): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(outputPath);
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

  // Add content
  let yPosition = 50;
  const pageHeight = doc.page.height;
  const marginBottom = 50;

  sections.forEach((section) => {
    // Check if we need a new page
    if (yPosition > pageHeight - marginBottom) {
      doc.addPage();
      yPosition = 50;
    }

    // Section header
    const fontSize = Math.max(10, 24 - section.level * 3);
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#1e3a8a')
      .text(section.title, { continued: false })
      .moveDown(0.3);
    yPosition += fontSize + 10;

    // Section content
    const contentLines = section.content.split('\n');
    doc.fontSize(10).font('Helvetica').fillColor('#374151');

    for (const line of contentLines) {
      if (line.trim() === '') {
        doc.moveDown(0.3);
        yPosition += 5;
        continue;
      }

      // Handle bullet points
      if (line.startsWith('- ')) {
        doc.text(`• ${line.substring(2)}`, { continued: false });
        yPosition += 15;
      } 
      // Handle numbered lists
      else if (line.match(/^\d+\./)) {
        doc.text(line, { continued: false });
        yPosition += 15;
      }
      // Handle code blocks (simplified)
      else if (line.startsWith('```')) {
        doc.font('Courier').fillColor('#dc2626');
        yPosition += 5;
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
        doc.text(text, { continued: false });
        yPosition += 15;
      }
      // Regular text
      else {
        doc.text(line, { continued: false });
        yPosition += 15;
      }

      // Check for page break
      if (yPosition > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = 50;
      }
    }

    doc.moveDown(0.5);
    yPosition += 10;
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
}

async function main() {
  const mdPath = path.join(__dirname, '..', 'TECH_STACK.md');
  const pdfPath = path.join(__dirname, '..', 'TECH_STACK.pdf');

  console.log('Reading TECH_STACK.md...');
  const mdContent = fs.readFileSync(mdPath, 'utf-8');

  console.log('Parsing markdown...');
  const sections = parseMarkdown(mdContent);

  console.log('Generating PDF...');
  generatePDF(sections, pdfPath);

  console.log(`PDF generated successfully: ${pdfPath}`);
}

main().catch(console.error);
