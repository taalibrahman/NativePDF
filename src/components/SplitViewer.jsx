import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Scissors } from 'lucide-react';
import PDFThumbnail from './PDFThumbnail';
import { splitPDF } from '../lib/pdf-core';

export default function SplitViewer({ file, isDark }) {
  const [totalPages, setTotalPages] = useState(0);
  const [splitIndices, setSplitIndices] = useState([]); // Stores multiple boundary markers
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let loadingTask;
    const loadPdf = async () => {
      try {
        const buffer = await file.arrayBuffer();
        loadingTask = pdfjsLib.getDocument(buffer);
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);
      } catch (err) {
        console.error("Error loading PDF page breakdown", err);
      }
    };
    loadPdf();
    return () => { if (loadingTask) loadingTask.destroy(); };
  }, [file]);

  const handleSplit = async () => {
    if (splitIndices.length === 0) return;
    setIsProcessing(true);
    await splitPDF(file, splitIndices);
    setIsProcessing(false);
  };

  const toggleSplit = (idx) => {
    setSplitIndices(prev => {
      if (prev.includes(idx)) {
        return prev.filter(i => i !== idx);
      }
      return [...prev, idx].sort((a,b) => a - b);
    });
  };

  if (!totalPages) {
     return <div className="p-8 text-center animate-pulse py-20 font-medium opacity-60">Scanning PDF structure...</div>;
  }

  const pagesArray = Array.from({ length: totalPages }, (_, i) => i);

  return (
    <div className="w-full mt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">Visual Split Editor</h3>
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
            Draw unlimited boundary lines! Hit download to compress them elegantly into a native local `.zip` file.
          </p>
        </div>
        <button
          onClick={handleSplit}
          disabled={splitIndices.length === 0 || isProcessing}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {isProcessing ? 'Slicing & Zipping...' : `Zip ${splitIndices.length + 1} Slices`}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-1 gap-y-10 justify-center relative pt-4 pb-20">
        {pagesArray.map((idx) => {
          const hasMarker = splitIndices.includes(idx);
          
          return (
          <React.Fragment key={idx}>
            <div className={`relative flex flex-col items-center w-32 p-2 rounded-xl transition-all shadow-sm group-hover:scale-105 ${isDark ? 'bg-[#2a2a2a] border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
              <PDFThumbnail file={file} pageNumber={idx + 1} />
              <span className={`mt-3 text-xs font-semibold px-2 py-1 rounded shadow-inner ${isDark ? 'bg-black/30' : 'bg-gray-200'}`}>
                Page {idx + 1}
              </span>
              
              {hasMarker && (
                 <div className="absolute inset-0 border-4 border-indigo-500/40 rounded-xl pointer-events-none transition-colors"></div>
              )}
            </div>

            {/* Unlimited Split boundary target */}
            {idx < totalPages - 1 && (
              <div 
                className="relative flex items-center justify-center group cursor-pointer w-6 mx-1 hover:bg-blue-500/5 rounded-full transition-colors"
                onClick={() => toggleSplit(idx)}
              >
                {hasMarker ? (
                  <div className="absolute z-20 flex flex-col items-center top-1/2 -translate-y-1/2">
                    <div className="w-1 h-32 bg-blue-500 rounded-full shadow-lg"></div>
                    <div className="bg-blue-500 text-white rounded-full p-2 shadow-xl border-4 border-white absolute top-1/2 -translate-y-1/2 transform scale-110">
                       <Scissors className="w-5 h-5" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute z-20 flex flex-col items-center top-1/2 -translate-y-1/2 opacity-40 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="border-l-2 border-dashed border-blue-400/50 h-32"></div>
                    <div className="backdrop-blur-md bg-white/20 text-gray-800 rounded-full p-2 shadow-xl border border-white/30 absolute top-1/2 -translate-y-1/2 transform transition-transform hover:scale-110">
                       <Scissors className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        )})}
      </div>
    </div>
  );
}
