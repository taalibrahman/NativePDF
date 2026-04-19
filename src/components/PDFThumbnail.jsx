import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export default function PDFThumbnail({ file, pageNumber = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let renderTask;
    let loadingTask;

    const renderThumbnail = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber); // Render the specified page representation

        const viewport = page.getViewport({ scale: 0.3 }); // Low resolution scale for performance
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering PDF thumbnail:", err);
        }
      }
    };

    renderThumbnail();

    return () => {
      if (renderTask) renderTask.cancel();
      if (loadingTask) loadingTask.destroy();
    };
  }, [file]);

  return (
    <div className="bg-white rounded shadow-md border border-gray-200 overflow-hidden flex items-center justify-center w-full h-32 relative">
      <canvas ref={canvasRef} className="w-full h-full object-contain"></canvas>
    </div>
  );
}
