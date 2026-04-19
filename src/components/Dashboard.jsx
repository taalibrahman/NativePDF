import React, { useState, useRef } from 'react';
import MergeSplitWorkspace from './MergeSplitWorkspace';
import CompressWorkspace from './CompressWorkspace';
import ExtractWorkspace from './ExtractWorkspace';
import RedactWorkspace from './RedactWorkspace';
import ScanToPdfWorkspace from './ScanToPdfWorkspace';
import {
  FolderDown,
  ShieldCheck,
  Scissors,
  Edit3,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  FileUp,
  Camera,
  X
} from 'lucide-react';

export default function Dashboard({ isDark, activeTool, setActiveTool, sharedFile, setSharedFile }) {
  const fileInputRef = useRef(null);
  const featureGridRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setSharedFile(file);
      if (window.innerWidth >= 768) {
        setTimeout(() => featureGridRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setSharedFile(file);
      if (window.innerWidth >= 768) {
        setTimeout(() => featureGridRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  if (activeTool === 'merge') {
    return <MergeSplitWorkspace isDark={isDark} onBack={() => setActiveTool(null)} sharedFile={sharedFile} />;
  }

  if (activeTool === 'compress') {
    return <CompressWorkspace isDark={isDark} onBack={() => setActiveTool(null)} sharedFile={sharedFile} />;
  }

  if (activeTool === 'extract') {
    return <ExtractWorkspace isDark={isDark} onBack={() => setActiveTool(null)} sharedFile={sharedFile} />;
  }

  if (activeTool === 'edit') {
    return <RedactWorkspace isDark={isDark} onBack={() => setActiveTool(null)} sharedFile={sharedFile} />;
  }

  if (activeTool === 'scan-to-pdf') {
    return <ScanToPdfWorkspace isDark={isDark} onBack={() => setActiveTool(null)} sharedFile={sharedFile} />;
  }

  return (
    <>
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Copy Block */}
          <div className="space-y-6">
            <h1 className={`text-5xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome to NativePDF
            </h1>
            <p className={`text-xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Fast, free, and 100% on-device PDF processing. Your files never leave your browser.
            </p>
          </div>

          {/* Right File Upload Box / File Ready Box */}
          {!sharedFile ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-6 transition-all ${isDark
                ? 'border-gray-700 bg-gray-900/50 hover:border-blue-500/50'
                : 'border-gray-300 bg-white hover:border-blue-400 border-gray-300'
                }`}
            >
              <FolderDown className={`w-20 h-20 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Drag and drop your PDF here
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Select a file
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-2 mt-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  Processed locally. Zero server uploads.
                </span>
              </div>
            </div>
          ) : (
            <div className={`border-2 rounded-2xl p-10 flex flex-col items-center justify-center gap-6 transition-all relative overflow-hidden group ${isDark
              ? 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : 'border-emerald-500/20 bg-emerald-50/50 shadow-sm'
              }`}>
              {/* Status Indicator */}
              <div className="absolute top-4 right-4 animate-pulse">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>

              <div className="relative">
                <div className={`w-20 h-24 rounded-lg flex items-center justify-center shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                  <FileText className={`w-12 h-12 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg border-2 border-emerald-50">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="text-center space-y-2 max-w-full px-4">
                <h3 className={`text-xl font-bold truncate px-2 ${isDark ? 'text-white' : 'text-gray-900'}`} title={sharedFile.name}>
                  {sharedFile.name}
                </h3>
                <p className={`text-sm ${isDark ? 'text-emerald-400/80' : 'text-emerald-600/80'} font-semibold tracking-wide uppercase`}>
                  Ready for processing
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {(sharedFile.size / 1024).toFixed(0)} KB • Local Cache
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 w-full pt-4 border-t border-emerald-500/10">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  What would you like to do?
                </p>
                <button
                  onClick={() => setSharedFile(null)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                    }`}
                >
                  <X className="w-4 h-4" /> Change File
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Grid - Hidden on mobile */}
      <section ref={featureGridRef} className="hidden md:block max-w-7xl mx-auto px-8 py-20">
        <h2 className={`text-3xl font-bold mb-12 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {sharedFile ? `Process "${sharedFile.name}" with:` : "What do you want to do?"}
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Feature Card 1: Merge & Split */}
          <div
            onClick={() => setActiveTool('merge')}
            className={`p-6 rounded-2xl transition-all cursor-pointer hover:scale-[1.02] overflow-hidden ${isDark
              ? 'bg-[#2a2a2a]'
              : 'bg-white shadow-sm'
              }`}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-full h-48 flex items-center justify-center relative">
                {/* Illustration: Two documents merging */}
                <div className="relative w-64 h-full">
                  <div className="absolute left-8 top-0 w-28 h-36 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg shadow-lg transform -rotate-12 flex items-center justify-center">
                    <div className="space-y-2 w-16">
                      <div className="h-2 bg-white/80 rounded"></div>
                      <div className="h-2 bg-white/80 rounded"></div>
                      <div className="h-2 bg-white/60 rounded w-3/4"></div>
                    </div>
                  </div>
                  <div className="absolute right-8 top-6 w-28 h-36 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg transform rotate-12 flex items-center justify-center">
                    <div className="space-y-2 w-16">
                      <div className="h-2 bg-white/80 rounded"></div>
                      <div className="h-2 bg-white/80 rounded"></div>
                      <div className="h-2 bg-white/60 rounded w-3/4"></div>
                    </div>
                  </div>
                  <Scissors className="absolute top-16 left-1/2 -translate-x-1/2 w-8 h-8 text-yellow-400 z-10" />
                </div>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Merge & Split
              </h3>
            </div>
          </div>

          {/* Feature Card 2: Compress PDF */}
          <div
            onClick={() => setActiveTool('compress')}
            className={`p-6 rounded-2xl transition-all cursor-pointer hover:scale-[1.02] ${isDark
              ? 'bg-[#2a2a2a]'
              : 'bg-white shadow-sm'
              }`}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-full h-48 flex items-center justify-center relative">
                {/* Illustration: Document with compression */}
                <div className="relative">
                  <div className="w-36 h-44 bg-white rounded-lg shadow-xl flex items-center justify-center">
                    <div className="space-y-3 w-28">
                      <div className="h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                  <div className="absolute -right-4 top-1/2 -translate-y-1/2 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    10MB
                  </div>
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2">
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">→</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -left-12 bottom-8 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    2MB
                  </div>
                </div>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Compress PDF
              </h3>
            </div>
          </div>

          {/* Feature Card 3: Extract Text / OCR */}
          <div
            onClick={() => setActiveTool('extract')}
            className={`p-6 rounded-2xl transition-all cursor-pointer hover:scale-[1.02] ${isDark
              ? 'bg-[#2a2a2a]'
              : 'bg-white shadow-sm'
              }`}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-full h-48 flex items-center justify-center relative">
                {/* Illustration: Document with scanning effect */}
                <div className="relative">
                  <div className="w-36 h-44 bg-white rounded-lg shadow-xl flex items-center justify-center overflow-hidden">
                    <div className="space-y-2 w-28">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded"></div>
                        <div className="flex-1 space-y-1">
                          <div className="h-1.5 bg-gray-300 rounded"></div>
                          <div className="h-1.5 bg-gray-300 rounded w-2/3"></div>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-200 rounded w-4/5"></div>
                      <div className="font-mono text-xs text-blue-600">Aa</div>
                    </div>
                  </div>
                  <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
                </div>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Extract Text
              </h3>
            </div>
          </div>

          {/* Feature Card 4: Edit PDF */}
          <div
            onClick={() => setActiveTool('edit')}
            className={`p-6 rounded-2xl transition-all cursor-pointer hover:scale-[1.02] ${isDark
              ? 'bg-[#2a2a2a]'
              : 'bg-white shadow-sm'
              }`}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-full h-48 flex items-center justify-center relative">
                {/* Illustration: Document being edited */}
                <div className="relative">
                  <div className="w-36 h-44 bg-white rounded-lg shadow-xl flex items-center justify-center">
                    <div className="space-y-3 w-28">
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-16 bg-gradient-to-br from-orange-400 to-rose-400 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute bottom-4 -left-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded transform rotate-12"></div>
                  </div>
                </div>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit PDF
              </h3>
            </div>
          </div>

          {/* Feature Card 5: Scan to PDF */}
          <div
            onClick={() => setActiveTool('scan-to-pdf')}
            className={`p-6 rounded-2xl transition-all cursor-pointer hover:scale-[1.02] overflow-hidden ${isDark
              ? 'bg-[#2a2a2a]'
              : 'bg-white shadow-sm'
              }`}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-full h-48 flex items-center justify-center relative">
                <div className="relative">
                  <div className="w-32 h-40 bg-white rounded-lg shadow-xl flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-cyan-500/20" />
                    <div className="space-y-2 w-24 relative z-10">
                      <div className="h-14 bg-gradient-to-br from-teal-400 to-cyan-500 rounded flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      <div className="h-2 bg-gray-300 rounded" />
                      <div className="h-2 bg-gray-300 rounded w-3/4" />
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>
                </div>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Scan to PDF
              </h3>
            </div>
          </div>


        </div>
      </section>
    </>
  );
}
