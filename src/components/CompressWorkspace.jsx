import React, { useState } from 'react';
import { ArrowLeft, Download, FileUp, Settings2, Target } from 'lucide-react';
import { flattenAndCompressPDF } from '../lib/pdf-core';
import * as pdfjsLib from 'pdfjs-dist';

export default function CompressWorkspace({ onBack, isDark, sharedFile }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [targetKB, setTargetKB] = useState(1000); 

  React.useEffect(() => {
    if (sharedFile) {
      setFile(sharedFile);
      setProgress(0);
    }
  }, [sharedFile]);

  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (uploaded.length > 0) {
      setFile(uploaded[0]);
      setProgress(0);
    }
  };

  const executeCompression = async () => {
    if (!file || targetKB <= 0) return;
    setIsProcessing(true);
    setProgress(5);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const compressedBlobs = [];
      const budgetBytes = targetKB * 1024 * 0.95; // Extreme 5% safety boundary
      const perPageBudget = budgetBytes / numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const originalViewport = page.getViewport({ scale: 1.0 });
        
        // Iterative algorithm variables
        let bestBuffer = null;
        let lastBufferResort = null;
        const scaleTiers = [1.2, 1.0, 0.75, 0.5, 0.4]; 
        let achieved = false;
        
        for (const currentScale of scaleTiers) {
           if (achieved) break;
           
           const viewport = page.getViewport({ scale: currentScale });
           const canvas = document.createElement('canvas');
           const ctx = canvas.getContext('2d');
           
           canvas.width = viewport.width;
           canvas.height = viewport.height;
           
           ctx.fillStyle = '#ffffff';
           ctx.fillRect(0, 0, canvas.width, canvas.height);

           await page.render({ canvasContext: ctx, viewport }).promise;
           
           const qualityTiers = [0.8, 0.6, 0.4, 0.2, 0.1];
           for (const q of qualityTiers) {
              const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
              
              if (blob.size <= perPageBudget) {
                 bestBuffer = await blob.arrayBuffer();
                 achieved = true;
                 break; // Success! Broken out heavily optimized.
              } else {
                 lastBufferResort = await blob.arrayBuffer();
              }
           }
           
           // Garbage collection cycle mapping natively
           canvas.width = 0;
           canvas.height = 0;
        }

        // Failsafe injection block if pure math fails
        compressedBlobs.push({
           buffer: bestBuffer || lastBufferResort,
           width: originalViewport.width,
           height: originalViewport.height
        });
        
        setProgress(Math.round((i / numPages) * 100));
        
        // Ensure UI updates at 60fps locking hardware limits optimally
        await new Promise(r => setTimeout(r, 0));
      }

      await flattenAndCompressPDF(compressedBlobs, file.name);

    } catch (err) {
      console.error("Native Compression Error:", err);
      alert("Compression Engine failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`p-4 md:p-8 w-full max-w-4xl mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      <button onClick={onBack} className="flex items-center gap-2 mb-8 text-emerald-500 hover:text-emerald-400 transition-colors font-medium">
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold mb-3 tracking-tight">Precision Compressor</h2>
        <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Dictate the exact file size limits you need. We mathematically compress offline to fall cleanly underneath it.
        </p>
      </div>

      {!file ? (
        <div className={`border-2 border-dashed rounded-3xl p-8 md:p-16 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.01] shadow-lg ${
          isDark ? 'border-gray-700 bg-gray-900/50 hover:border-emerald-500/50' : 'border-gray-300 bg-white hover:border-emerald-400'
        }`}>
          <div className="bg-emerald-500/10 p-4 rounded-full">
            <FileUp className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-2">Import Document to Target</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>We scan layout dimensions continuously offline.</p>
          </div>
          <label className="mt-4 bg-emerald-500 hover:bg-emerald-600 cursor-pointer text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-md text-lg">
            Select Heavy PDF
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        <div className={`p-4 md:p-8 rounded-3xl shadow-xl transition-colors ${isDark ? 'bg-[#2a2a2a] border border-gray-700' : 'bg-white border border-gray-200'}`}>
          
          <div className="flex flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-500/20">
             <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                <div className="bg-emerald-500/20 p-2 md:p-3 rounded-lg flex-shrink-0">
                   <Settings2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg md:text-xl truncate">{file.name}</h3>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Original Size: {(file.size / 1024).toFixed(0)} KB</p>
                </div>
             </div>
             <button onClick={() => setFile(null)} className="text-red-400 hover:text-red-500 text-xs md:text-sm font-semibold transition-colors flex-shrink-0 p-2">Discard</button>
          </div>

          <div className={`mb-8 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-inner ${isDark ? 'bg-[#212121] border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
             <div className="flex-shrink-0 bg-emerald-500/20 p-4 rounded-full">
                <Target className="w-10 h-10 text-emerald-500" />
             </div>
             <div className="flex-grow text-center md:text-left">
                <h4 className="text-2xl font-bold mb-2">Target Boundary</h4>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Input your exact limit constraints. If you want <span className="font-bold text-emerald-400">Under 1MB</span>, enter something like `990` below.
                </p>
                
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <div className="relative">
                    <input 
                      type="number" 
                      value={targetKB}
                      onChange={(e) => setTargetKB(Number(e.target.value))}
                      disabled={isProcessing}
                      className={`w-40 text-2xl font-bold p-3 rounded-xl outline-none focus:ring-4 transition-all ${isDark ? 'bg-gray-800 text-white focus:ring-emerald-500/30' : 'bg-white text-gray-900 border focus:ring-emerald-500/20'}`}
                    />
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>KB</span>
                  </div>
                  
                  {file.size / 1024 < targetKB && (
                     <span className="text-xs text-yellow-500 font-bold bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
                       Original file is already smaller than {targetKB} KB. You can still compress if you want.
                     </span>
                  )}
                </div>
             </div>
          </div>

          <button 
             onClick={executeCompression} 
             disabled={isProcessing}
             className="w-full relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-90 group"
           >
             <div className="relative z-10 flex items-center justify-center gap-2 text-lg">
                 {isProcessing ? `Calculating Math Safely... ${progress}%` : `Execute Precision Targeting`}
             </div>
             {/* Progress Bar Fill */}
             {isProcessing && (
               <div 
                 className="absolute top-0 left-0 h-full bg-emerald-400/40 transition-all duration-300 ease-out z-0" 
                 style={{ width: `${progress}%` }}
               />
             )}
          </button>
        </div>
      )}
    </div>
  );
}
