const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const doc = await PDFDocument.create();
  
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([500, 500]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 400, size: 50 });
  }
  
  const pdfBytes = await doc.save();
  fs.writeFileSync('scratch/dummy.pdf', pdfBytes);

  console.log("Created dummy.pdf with 5 pages.");

  // Test the exact split mathematically
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const splitIndex = 2; // Split after page 3

  const doc1 = await PDFDocument.create();
  const doc2 = await PDFDocument.create();

  const pages1 = await doc1.copyPages(pdfDoc, Array.from({ length: splitIndex + 1 }, (_, i) => i));
  pages1.forEach(p => doc1.addPage(p));

  const pages2 = await doc2.copyPages(pdfDoc, Array.from({ length: totalPages - (splitIndex + 1) }, (_, i) => i + splitIndex + 1));
  pages2.forEach(p => doc2.addPage(p));

  fs.writeFileSync('scratch/dummy_part1.pdf', await doc1.save());
  fs.writeFileSync('scratch/dummy_part2.pdf', await doc2.save());

  console.log("Split successful! doc1 pages:", doc1.getPageCount(), "- doc2 pages:", doc2.getPageCount());
}

run().catch(console.error);
