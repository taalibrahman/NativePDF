import * as pdfjsLib from 'pdfjs-dist';
// Explicitly force the Web Worker imported locally recursively
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Because we are running pdfjs inside a web worker thread concurrently, we must map 
// the options object cleanly to an isolated property
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

self.onmessage = async (e) => {
  try {
    const { fileBuffer, scale, quality } = e.data;
    
    // Process stringified buffers directly natively 
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const compressedBlobs = [];

    // Increment over each individual page natively keeping RAM utilization stable
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      
      // Utilize OffscreenCanvas explicitly to prevent main React thread locking
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');
      
      // Inject persistent opaque white background logic (PDFs lack a default background color)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      
      // Generate highly optimized raw JPEG blob structure without alpha transparency
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const arrayBuffer = await blob.arrayBuffer();
      
      compressedBlobs.push(arrayBuffer);
      
      // Dynamically map and dispatch pipeline success increments back to the UI state
      self.postMessage({ type: 'PROGRESS', progress: Math.round((i / numPages) * 100) });
    }

    self.postMessage({ type: 'SUCCESS', buffers: compressedBlobs });
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message || error.toString() });
  }
};
