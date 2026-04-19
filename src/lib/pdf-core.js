import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * Memory-safe operation to merge multiple PDF File objects into a single raw Uint8Array blob.
 * Bypasses reading large arrays into React state.
 * @param {File[]} files - Array of native browser File objects from the dropzone
 * @returns {Promise<Uint8Array>} - The compiled raw byte array of the new document
 */
export async function mergePDFs(files) {
  if (!files || files.length === 0) return null;

  // Create an empty, base PDF document logically in memory
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    // Read the binary buffer only exactly when needed inside the loop
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the individual file into pdf-lib
    const pdfToLoad = await PDFDocument.load(arrayBuffer);
    
    // Retrieve all page indices for this specific document
    const pageIndices = pdfToLoad.getPageIndices();
    
    // Copy all pages safely
    const copiedPages = await mergedPdf.copyPages(pdfToLoad, pageIndices);
    
    // Append the copied pages into our master assembly document
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  // Serialize the compiled logic map into raw unassigned bytes
  const pdfBytes = await mergedPdf.save();
  return pdfBytes;
}

/**
 * Triggers a secure, memory-managed DOM download of a Uint8Array byte map.
 * Immediately revokes the object URL after triggering to dump V8 cache limits.
 * @param {Uint8Array} bytes 
 * @param {string} filename 
 * @param {string} type
 */
export function downloadLocalBlob(bytes, filename = 'nativepdf-output.pdf', type = 'application/pdf') {
  const blob = new Blob([bytes], { type });
  
  // Creates a highly volatile pointer URL mapped directly to the local hardware blob
  const localUrl = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = localUrl;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  
  // CRITICAL: Dump the memory mapping aggressively so we don't crash the browser
  setTimeout(() => URL.revokeObjectURL(localUrl), 100);
}

/**
 * Splits a single PDF dynamically across multiple boundaries and bundles into a local zip.
 * @param {File} file 
 * @param {Number[]} splitIndices (array of 0-indexed page numbers to split AFTER)
 */
export async function splitPDF(file, splitIndices) {
  if (!splitIndices || splitIndices.length === 0) return false;

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  const zip = new JSZip();
  const baseName = file.name.replace(/\.[^/.]+$/, "") || 'document';

  // Sort boundary markers from smallest page to largest
  const sortedCuts = [...splitIndices].sort((a,b) => a - b);
  // Cap boundaries spanning from virtual page exactly prior to array Start -> array End
  const boundaries = [-1, ...sortedCuts, totalPages - 1];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startIdx = boundaries[i] + 1;
    const endIdx = boundaries[i+1];
    
    // Safety check just in case mathematical array logic glitches overlapping clicks
    if (startIdx > endIdx) continue;

    const newDoc = await PDFDocument.create();
    const length = endIdx - startIdx + 1;
    
    // Splice raw pages straight from original V8 memory layer without corrupting state structure
    const copied = await newDoc.copyPages(pdfDoc, Array.from({ length }, (_, idx) => idx + startIdx));
    copied.forEach(p => newDoc.addPage(p));

    const bytes = await newDoc.save();
    
    // Dump chunk blindly into browser zip cache
    zip.file(`${baseName}_part${i + 1}.pdf`, bytes);
  }

  // Finalize zip compression using absolute native processor resources, zero network overhead
  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  
  // Emit file to physical hardware disk
  downloadLocalBlob(zipBytes, `${baseName}_splits.zip`, 'application/zip');
  
  return true;
}

/**
 * Takes native JPEG byte arrays from an OffscreenCanvas background pipeline
 * and securely restitches them natively into an optimized readonly PDF wrapper mapping matching dimensions perfectly.
 * @param {Array<{buffer: ArrayBuffer, width: number, height: number}>} pagesData 
 * @param {string} originalName 
 */
export async function flattenAndCompressPDF(pagesData, originalName) {
  const newPdf = await PDFDocument.create();
  
  for (const pageData of pagesData) {
    const uint8Array = new Uint8Array(pageData.buffer);
    const image = await newPdf.embedJpg(uint8Array);
    
    // Stretch original boundaries mathematically ensuring offline documents do not shrink dimensions visually
    const page = newPdf.addPage([pageData.width, pageData.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageData.width,
      height: pageData.height
    });
  }

  const bytes = await newPdf.save();
  const baseName = originalName.replace(/\.[^/.]+$/, "") || 'document';
  downloadLocalBlob(bytes, `${baseName}-compressed.pdf`);
}
