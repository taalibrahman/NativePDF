import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ScanText, FileUp, Settings2, Zap, Brain, Copy, Check, Download } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import InteractiveExtractViewer from './InteractiveExtractViewer';

export default function ExtractWorkspace({ onBack, isDark, sharedFile }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('fast'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (sharedFile) {
      setFile(sharedFile);
      setExtractedText('');
      setProgress(0);
    }
  }, [sharedFile]);

  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (uploaded.length > 0) {
      setFile(uploaded[0]);
      setExtractedText('');
      setProgress(0);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, "")}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const executeFastExtraction = async (pdf, numPages) => {
    let fullText = "";
    setStatusText('Scraping physical string vectors...');
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Structurally map text keeping space bounds natively
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        
        setProgress(Math.round((i/numPages)*100));
        await new Promise(r => setTimeout(r, 0));
    }
    return fullText;
  };

  const executeExtraction = async () => {
    if (!file) return;
    
    if (mode === 'deep') {
       setShowViewer(true);
       return;
    }

    setIsProcessing(true);
    setProgress(5);
    setExtractedText('');

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const textBlob = await executeFastExtraction(pdf, numPages);
      setExtractedText(textBlob || 'No text could be extracted structurally.');
      
    } catch (err) {
      console.error("Extraction Framework Error:", err);
      alert("Failed to initialize text extraction arrays: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgress(100);
      setStatusText('');
    }
  };

  return (
    <div className={`p-4 md:p-8 w-full max-w-5xl mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      <button onClick={onBack} className="flex items-center gap-2 mb-8 text-blue-500 hover:text-blue-400 transition-colors font-medium">
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold mb-3 tracking-tight">Extract Text <span className="text-indigo-500">(OCR)</span></h2>
        <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl mx-auto`}>
          Strips strings directly entirely natively minimizing data leaks. Supports flat scanned photography documents.
        </p>
      </div>

      {!file ? (
        <div className={`border-2 border-dashed rounded-3xl p-8 md:p-16 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.01] shadow-lg ${
          isDark ? 'border-gray-700 bg-gray-900/50 hover:border-blue-500/50' : 'border-gray-300 bg-white hover:border-blue-400'
        }`}>
          <div className="bg-blue-500/10 p-4 rounded-full">
            <ScanText className="w-12 h-12 text-blue-500" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-2">Import Document</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>We support native vector harvesting and local neural net scraping offline.</p>
          </div>
          <label className="mt-4 bg-blue-500 hover:bg-blue-600 cursor-pointer text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-md text-lg">
            Select PDF
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Controls Panel */}
          <div className={`w-full lg:w-1/3 p-6 rounded-3xl shadow-xl transition-colors h-fit ${isDark ? 'bg-[#2a2a2a] border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center gap-3 min-w-0 flex-1 mb-8 pb-6 border-b border-gray-500/20">
               <div className="bg-blue-500/20 p-2 rounded-lg flex-shrink-0">
                  <FileUp className="w-6 h-6 text-blue-500" />
               </div>
               <div className="min-w-0 flex-1">
                 <h3 className="font-bold text-lg truncate">{file.name}</h3>
                 <button onClick={() => {setFile(null); setExtractedText('');}} className="text-red-400 hover:text-red-500 text-xs font-semibold transition-colors mt-1">Discard File</button>
               </div>
            </div>

            <div className="space-y-4 mb-8">
              <label 
                className={`cursor-pointer w-full p-4 rounded-xl border-2 transition-all flex flex-col gap-1 relative ${mode === 'fast' ? 'border-blue-500 bg-blue-500/10' : (isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => setMode('fast')}
              >
                 <div className="flex items-center gap-2 font-bold mb-1">
                   <Zap className="w-5 h-5 text-blue-500" /> Fast Vector Scrape
                 </div>
                 <span className="text-xs opacity-70">Lightning fast. Fails if PDF is a scanned photo. Extracts digital string vectors securely.</span>
              </label>

              <label 
                className={`cursor-pointer w-full p-4 rounded-xl border-2 transition-all flex flex-col gap-1 relative ${mode === 'deep' ? 'border-indigo-500 bg-indigo-500/10' : (isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => setMode('deep')}
              >
                 <div className="flex items-center gap-2 font-bold mb-1">
                   <Brain className="w-5 h-5 text-indigo-500" /> Deep Neural OCR
                 </div>
                 <span className="text-xs opacity-70">Intensive WASM limits. Physically reads pixel photography layouts offline statically. Very CPU heavy.</span>
              </label>
            </div>

            <button 
               onClick={executeExtraction} 
               disabled={isProcessing}
               className="w-full relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all disabled:opacity-90 group"
             >
               <div className="relative z-10 flex flex-col items-center justify-center gap-1">
                   <span>{isProcessing ? `Extracting... ${progress}%` : 'Execute Tool'}</span>
                   {isProcessing && <span className="text-xs text-blue-200 font-medium">{statusText}</span>}
               </div>
               
               {isProcessing && (
                 <div 
                   className="absolute top-0 left-0 h-full bg-blue-400/40 transition-all duration-300 ease-out z-0" 
                   style={{ width: `${progress}%` }}
                 />
               )}
            </button>
          </div>

          {/* Results Panel */}
          <div className={`w-full lg:w-2/3 p-6 rounded-3xl shadow-xl transition-colors flex flex-col ${isDark ? 'bg-[#2a2a2a] border border-gray-700' : 'bg-white border border-gray-200'}`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold">Extracted String Tree</h3>
               
               {extractedText && (
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={handleCopy}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                   >
                     {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                     {copied ? 'Copied' : 'Copy'}
                   </button>
                   <button 
                     onClick={downloadText}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                   >
                     <Download className="w-4 h-4" /> Save .txt
                   </button>
                 </div>
               )}
             </div>

             <div className={`flex-1 rounded-xl p-4 overflow-y-auto min-h-[300px] lg:min-h-[500px] border relative ${isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                {extractedText ? (
                  <pre className={`whitespace-pre-wrap font-sans text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {extractedText}
                  </pre>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                    <span className="text-sm font-medium">Text payload rendering space...</span>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {showViewer && <InteractiveExtractViewer file={file} isDark={isDark} onClose={() => setShowViewer(false)} />}
    </div>
  );
}
