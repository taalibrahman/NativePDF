import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Trash2, GripVertical, FileUp, ListTree, Scissors, FileText } from 'lucide-react';
import { mergePDFs, downloadLocalBlob } from '../lib/pdf-core';
import PDFThumbnail from './PDFThumbnail';
import SplitViewer from './SplitViewer';

export default function MergeSplitWorkspace({ onBack, isDark, sharedFile }) {
  const [mode, setMode] = useState('merge'); // 'merge' or 'split'
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (sharedFile) {
      if (mode === 'split') {
        setFiles([sharedFile]);
      } else {
        // Prevent duplicate addition if useEffect runs multiple times
        setFiles(prev => prev.some(f => f === sharedFile) ? prev : [...prev, sharedFile]);
      }
    }
  }, [sharedFile, mode]);

  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (uploaded.length > 0) {
      if (mode === 'split') {
        // Enforce maximum 1 file for split mode
        setFiles([uploaded[0]]);
      } else {
        setFiles(prev => [...prev, ...uploaded]);
      }
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, idx) => idx !== indexToRemove));
  };

  const executeMerge = async () => {
    setIsProcessing(true);
    try {
      const mergedBytes = await mergePDFs(files);
      if (mergedBytes) {
        downloadLocalBlob(mergedBytes, 'merged_output.pdf');
      }
    } catch (err) {
      console.error("Local Merge Error:", err);
      alert("Failed to merge PDFs. Ensure files are valid and not corrupted.");
    }
    setIsProcessing(false);
  };

  return (
    <div className={`p-4 md:p-8 w-full max-w-7xl mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      <button onClick={onBack} className="flex items-center gap-2 mb-8 text-blue-500 hover:text-blue-600 transition-colors font-medium">
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h2 className="text-3xl font-bold">Merge & Directory Split</h2>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Zero-trust operations executing solely within your hardware's RAM limit.
          </p>
        </div>

        <div className={`flex items-center p-1.5 rounded-xl shadow-inner ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <button 
            onClick={() => { setMode('merge'); setFiles([]); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${mode === 'merge' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <ListTree className="w-4 h-4" /> Merge Multiple
          </button>
          <button 
            onClick={() => { setMode('split'); setFiles([]); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${mode === 'split' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Scissors className="w-4 h-4" /> Clean Split
          </button>
        </div>
      </div>

      {files.length === 0 || mode === 'merge' ? (
        <>
          <div className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-colors mb-6 shadow-sm ${
            isDark ? 'border-gray-700 bg-gray-900/50 hover:border-blue-500/50' : 'border-gray-300 bg-white hover:border-blue-400'
          }`}>
            <FileUp className={`w-12 h-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <h3 className="text-xl font-medium">{mode === 'split' ? 'Upload PDF to Split' : 'Add PDF Documents'}</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No internet connection required. Parsed locally.</p>
            <label className="mt-4 bg-emerald-500 hover:bg-emerald-600 cursor-pointer text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-md">
              Select Files
              <input type="file" multiple={mode === 'merge'} accept="application/pdf,.pdf" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </>
      ) : null}

      {mode === 'merge' && files.length > 0 && (
        <>
          <div className="flex justify-end mb-4">
             <button 
              onClick={executeMerge} 
              disabled={isProcessing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Merging Offline...' : 'Merge All & Download'}
              {!isProcessing && <Download className="w-5 h-5" />}
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 pt-2">
            {files.map((file, idx) => (
              <div key={idx} className={`relative flex flex-col items-center p-3 rounded-xl group transition-transform hover:scale-105 ${isDark ? 'bg-[#2a2a2a] border border-gray-700 shadow-lg' : 'bg-gray-50 shadow border border-gray-200'}`}>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={() => removeFile(idx)} className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-xl cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab">
                  <div className="bg-gray-800 text-white p-1.5 rounded-lg shadow-xl">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
                <PDFThumbnail file={file} />
                <span className={`mt-4 text-xs font-semibold truncate w-full text-center px-2 py-1 rounded bg-black/5 ${isDark ? 'text-gray-300 bg-black/20' : 'text-gray-700'}`} title={file.name}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'split' && files.length === 1 && (
         <>
           <div className="flex justify-between items-center bg-gray-800 rounded-xl p-4 mb-4 shadow gap-4">
             <div className="flex items-center gap-3 min-w-0 flex-1">
               <FileText className="w-5 h-5 flex-shrink-0 text-gray-400"/>
               <span className="font-monospace text-sm md:text-base text-gray-300 truncate">{files[0].name}</span>
             </div>
             <button onClick={() => setFiles([])} className="text-red-400 hover:text-red-300 text-xs md:text-sm font-medium flex-shrink-0">Cancel</button>
           </div>
           <SplitViewer file={files[0]} isDark={isDark} />
         </>
      )}
    </div>
  );
}
