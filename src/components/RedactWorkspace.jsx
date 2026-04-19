import React, { useState } from 'react';
import { ArrowLeft, Edit3, FileUp, ShieldCheck } from 'lucide-react';
import InteractiveRedactViewer from './InteractiveRedactViewer';

export default function RedactWorkspace({ onBack, isDark, sharedFile }) {
  const [file, setFile] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  React.useEffect(() => {
    if (sharedFile) {
      setFile(sharedFile);
    }
  }, [sharedFile]);

  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (uploaded.length > 0) {
      setFile(uploaded[0]);
    }
  };

  const launchEditor = () => {
    if (file) setShowViewer(true);
  };

  return (
    <div className={`p-4 md:p-8 w-full max-w-5xl mx-auto ${isDark ? 'text-white' : 'text-gray-900'}`}>
      <button onClick={onBack} className="flex items-center gap-2 mb-8 text-blue-500 hover:text-blue-400 transition-colors font-medium">
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold mb-3 tracking-tight">Edit PDF <span className="text-orange-500">(Annotate)</span></h2>
        <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl mx-auto`}>
          White-out, black-out, auto-match background colors, or overlay replacement text — all processed 100% locally on your device.
        </p>
      </div>

      {!file ? (
        <div className={`border-2 border-dashed rounded-3xl p-8 md:p-16 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.01] shadow-lg ${
          isDark ? 'border-gray-700 bg-gray-900/50 hover:border-orange-500/50' : 'border-gray-300 bg-white hover:border-orange-400'
        }`}>
          <div className="bg-orange-500/10 p-4 rounded-full">
            <Edit3 className="w-12 h-12 text-orange-500" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-2">Import Document</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Select the PDF you want to annotate, redact, or overlay text onto.</p>
          </div>
          <label className="mt-4 bg-orange-500 hover:bg-orange-600 cursor-pointer text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-md text-lg">
            Select PDF
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              All edits are processed locally. Zero server uploads.
            </span>
          </div>
        </div>
      ) : (
        <div className={`rounded-3xl p-6 md:p-8 shadow-xl transition-colors ${isDark ? 'bg-[#2a2a2a] border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-500/20">
            <div className="bg-orange-500/20 p-2 rounded-lg flex-shrink-0">
              <FileUp className="w-6 h-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-lg truncate">{file.name}</h3>
              <button onClick={() => { setFile(null); setShowViewer(false); }} className="text-red-400 hover:text-red-500 text-xs font-semibold transition-colors mt-1">Discard File</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${isDark ? 'border-gray-700 bg-[#222]' : 'border-gray-200 bg-gray-50'}`}>
              <h4 className="font-semibold mb-2">Available Tools</h4>
              <ul className={`text-sm space-y-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li className="flex items-start gap-2"><span className="text-lg">⬜</span> <span><strong>White-Out:</strong> Draw over text to erase it with a white overlay. Optionally type text on top.</span></li>
                <li className="flex items-start gap-2"><span className="text-lg">⬛</span> <span><strong>Black-Out:</strong> Redact sensitive content with an opaque black cover. Optionally add white text.</span></li>
                <li className="flex items-start gap-2"><span className="text-lg">🎨</span> <span><strong>Auto-Match:</strong> Automatically samples the background color and covers with a matching overlay.</span></li>
                <li className="flex items-start gap-2"><span className="text-lg">✏️</span> <span><strong>Text Block:</strong> Draw a region and type replacement text that auto-wraps to fit with font detection.</span></li>
                <li className="flex items-start gap-2"><span className="text-lg">🖼️</span> <span><strong>Insert Image:</strong> Draw a region and insert a PNG or JPG. Drag to reposition, corner-handle to resize.</span></li>
              </ul>
            </div>

            <button
              onClick={launchEditor}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg transition-all text-lg"
            >
              Open Interactive Editor
            </button>
          </div>
        </div>
      )}

      {showViewer && <InteractiveRedactViewer file={file} isDark={isDark} onClose={() => setShowViewer(false)} />}
    </div>
  );
}
