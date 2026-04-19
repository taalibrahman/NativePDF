import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import {
  ArrowLeft, Camera, ImagePlus, Trash2, ChevronUp, ChevronDown,
  Download, Crop, X, Check, Loader2, Pencil, GripVertical
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// ─── ImageCropper ─────────────────────────────────────────────────────────────
function ImageCropper({ src, onDone, onCancel }) {
  const [crop, setCrop]         = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const dragRef                 = useRef(null);
  const imgRef                  = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const toNorm = useCallback((clientX, clientY) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { nx: 0, ny: 0 };
    return {
      nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height)),
    };
  }, []);

  const HR = 0.07;
  const getHandle = useCallback((nx, ny) => {
    const { x, y, w, h } = crop;
    const near = (ax, ay) => Math.hypot(nx - ax, ny - ay) < HR;
    if (near(x, y))         return 'tl';
    if (near(x+w, y))       return 'tr';
    if (near(x, y+h))       return 'bl';
    if (near(x+w, y+h))     return 'br';
    if (nx > x && nx < x+w && ny > y && ny < y+h) return 'move';
    return null;
  }, [crop]);

  const onStart = useCallback((e) => {
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    const { nx, ny } = toNorm(pt.clientX, pt.clientY);
    const h = getHandle(nx, ny);
    if (h) dragRef.current = { h, sx: nx, sy: ny, sc: { ...crop } };
  }, [crop, getHandle, toNorm]);

  const onMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    const { nx, ny } = toNorm(pt.clientX, pt.clientY);
    const dx = nx - dragRef.current.sx, dy = ny - dragRef.current.sy;
    const sc = dragRef.current.sc, MIN = 0.05;
    let { x, y, w, h } = sc;
    switch (dragRef.current.h) {
      case 'move': x = Math.max(0, Math.min(1-w, sc.x+dx)); y = Math.max(0, Math.min(1-h, sc.y+dy)); break;
      case 'tl':   x = Math.max(0, Math.min(sc.x+sc.w-MIN, sc.x+dx)); y = Math.max(0, Math.min(sc.y+sc.h-MIN, sc.y+dy)); w = sc.x+sc.w-x; h = sc.y+sc.h-y; break;
      case 'tr':   y = Math.max(0, Math.min(sc.y+sc.h-MIN, sc.y+dy)); w = Math.max(MIN, Math.min(1-sc.x, sc.w+dx)); h = sc.y+sc.h-y; break;
      case 'bl':   x = Math.max(0, Math.min(sc.x+sc.w-MIN, sc.x+dx)); w = sc.x+sc.w-x; h = Math.max(MIN, Math.min(1-sc.y, sc.h+dy)); break;
      case 'br':   w = Math.max(MIN, Math.min(1-sc.x, sc.w+dx)); h = Math.max(MIN, Math.min(1-sc.y, sc.h+dy)); break;
      default: break;
    }
    setCrop({ x, y, w, h });
  }, [toNorm]);

  const onEnd = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [onMove, onEnd]);

  const applyCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const out = document.createElement('canvas');
    out.width  = Math.max(1, Math.round(crop.w * iw));
    out.height = Math.max(1, Math.round(crop.h * ih));
    out.getContext('2d').drawImage(img, crop.x*iw, crop.y*ih, crop.w*iw, crop.h*ih, 0, 0, out.width, out.height);
    onDone(out.toDataURL('image/jpeg', 0.85));
  };

  const sx = crop.x*100, sy = crop.y*100, sw = crop.w*100, sh = crop.h*100;
  const R  = 3.8;
  const thirds = [1, 2].map(n => ({
    v: { x1: sx+sw*n/3, y1: sy, x2: sx+sw*n/3, y2: sy+sh },
    h: { x1: sx, y1: sy+sh*n/3, x2: sx+sw, y2: sy+sh*n/3 },
  }));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button onClick={onCancel} className="p-2 text-gray-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
        <h3 className="text-white font-semibold text-sm">Crop & Resize</h3>
        <button onClick={applyCrop} className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <Check className="w-4 h-4" /> Apply
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-3">
        <div className="relative select-none touch-none" onMouseDown={onStart} onTouchStart={onStart}>
          <img ref={imgRef} src={src} alt="crop" draggable={false} onLoad={() => setImgLoaded(true)}
            className="block max-w-full max-h-[calc(100vh-130px)] object-contain" style={{ userSelect: 'none' }} />
          {imgLoaded && (
            <svg className="absolute inset-0 w-full h-full touch-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="0"    y="0"     width="100" height={sy}        fill="rgba(0,0,0,0.55)" />
              <rect x="0"    y={sy+sh} width="100" height={100-sy-sh} fill="rgba(0,0,0,0.55)" />
              <rect x="0"    y={sy}    width={sx}   height={sh}        fill="rgba(0,0,0,0.55)" />
              <rect x={sx+sw} y={sy}  width={100-sx-sw} height={sh}   fill="rgba(0,0,0,0.55)" />
              <rect x={sx} y={sy} width={sw} height={sh} fill="none" stroke="#14b8a6" strokeWidth="0.6" />
              {thirds.map((t, i) => (
                <g key={i}>
                  <line x1={t.v.x1} y1={t.v.y1} x2={t.v.x2} y2={t.v.y2} stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" />
                  <line x1={t.h.x1} y1={t.h.y1} x2={t.h.x2} y2={t.h.y2} stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" />
                </g>
              ))}
              {[[sx,sy],[sx+sw,sy],[sx,sy+sh],[sx+sw,sy+sh]].map(([cx,cy],i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={R*2}   fill="rgba(0,0,0,0.35)" />
                  <circle cx={cx} cy={cy} r={R}      fill="#14b8a6" />
                  <circle cx={cx} cy={cy} r={R*0.4}  fill="white" />
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-gray-600 pb-3 flex-shrink-0">Drag corners to crop · Drag inside to move</p>
    </div>
  );
}

// ─── ScanToPdfWorkspace ───────────────────────────────────────────────────────
export default function ScanToPdfWorkspace({ isDark, onBack, sharedFile }) {
  const [pages,            setPages]           = useState([]);
  const [cropTarget,       setCropTarget]      = useState(null);
  const [isExporting,      setIsExporting]     = useState(false);
  const [isLoadingPdf,     setIsLoadingPdf]    = useState(false);
  const [pdfLoadProgress,  setPdfLoadProgress] = useState(0);
  const [pdfName,          setPdfName]         = useState('scan');
  const [isEditingName,    setIsEditingName]   = useState(false);
  // Drag-and-drop state
  const [dragOverId,       setDragOverId]      = useState(null);

  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const nameInputRef   = useRef(null);
  const dragIdRef      = useRef(null);
  const hasRenderedRef = useRef(null);

  // ── Render PDF → images ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sharedFile || hasRenderedRef.current === sharedFile) return;
    hasRenderedRef.current = sharedFile;

    const baseName = sharedFile.name.replace(/\.pdf$/i, '').trim();
    if (baseName) setPdfName(baseName);

    const renderPdf = async () => {
      setPages([]); // Clear any previous pages
      setIsLoadingPdf(true);
      setPdfLoadProgress(0);
      try {
        const buf = await sharedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp   = page.getViewport({ scale: 2.0 });
          const c    = document.createElement('canvas');
          c.width = vp.width; c.height = vp.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          const dataUrl = c.toDataURL('image/jpeg', 0.88);
          // Only store id + dataUrl — NO label (page number derived from live idx)
          setPages(prev => [...prev, { 
            id: `pdf-${i}-${Math.random().toString(36).substr(2, 9)}`, 
            dataUrl 
          }]);
          setPdfLoadProgress(Math.round((i / pdf.numPages) * 100));
        }
      } catch (err) {
        alert('Could not load PDF pages: ' + err.message);
      } finally {
        setIsLoadingPdf(false);
      }
    };
    renderPdf();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add images ─────────────────────────────────────────────────────────────
  const addImages = useCallback((arr) => {
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setPages(prev => [...prev, { 
          id: `img-${Math.random().toString(36).substr(2, 9)}`, 
          dataUrl: ev.target.result 
        }]);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileInput = useCallback((e) => {
    const arr = Array.from(e.target.files || []);
    e.target.value = '';
    if (arr.length) addImages(arr);
  }, [addImages]);

  // ── DnD handlers (HTML5) ───────────────────────────────────────────────────
  const onDragStart = (e, id) => {
    dragIdRef.current = id;
    setDragOverId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, targetId) => {
    e.preventDefault();
    if (!dragIdRef.current || dragIdRef.current === targetId) return;

    setPages(prev => {
      const fromIdx = prev.findIndex(p => p.id === dragIdRef.current);
      const toIdx   = prev.findIndex(p => p.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;

      const arr = [...prev];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
  };

  const onDragEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
  };

  // ── Touch Bridge (for mobile DnD) ──────────────────────────────────────────
  const onTouchStart = (e, id) => {
    // Only start drag if touching the handle OR if we want whole card dragging
    // We'll allow whole card dragging for simplicity if not on a button
    if (e.target.closest('button')) return;
    
    dragIdRef.current = id;
    setDragOverId(id);
    // Disable scrolling while dragging
    document.body.style.overflow = 'hidden';
  };

  const onTouchMove = (e) => {
    if (!dragIdRef.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = el?.closest('[data-page-id]');
    const targetId = card?.getAttribute('data-page-id');
    
    if (targetId && targetId !== dragIdRef.current) {
      setPages(prev => {
        const fromIdx = prev.findIndex(p => p.id === dragIdRef.current);
        const toIdx   = prev.findIndex(p => p.id === targetId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
        const arr = [...prev];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return arr;
      });
    }
  };

  const onTouchEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
    document.body.style.overflow = '';
  };

  // Ensure scroll is restored if the component unmounts unexpectedly
  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Up/Down (touch fallback) ───────────────────────────────────────────────
  const moveUp   = (id) => setPages(prev => {
    const i = prev.findIndex(p => p.id === id);
    if (i <= 0) return prev;
    const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a;
  });
  const moveDown = (id) => setPages(prev => {
    const i = prev.findIndex(p => p.id === id);
    if (i < 0 || i >= prev.length - 1) return prev;
    const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a;
  });
  const removePage  = (id) => {
    if (dragIdRef.current === id) onDragEnd();
    setPages(prev => prev.filter(p => p.id !== id));
  };
  const openCrop    = (page) => {
    setCropTarget({ id: page.id, dataUrl: page.dataUrl });
    window.history.pushState({ modal: 'cropper' }, '');
  };
  const applyCrop   = (url) => {
    setPages(prev => prev.map(p => p.id === cropTarget.id ? { ...p, dataUrl: url } : p));
    setCropTarget(null);
    if (window.history.state?.modal === 'cropper') window.history.back();
  };

  useEffect(() => {
    const handlePopModal = (e) => {
      if (cropTarget && !e.state?.modal) {
        setCropTarget(null);
        document.body.style.overflow = '';
      }
    };
    window.addEventListener('popstate', handlePopModal);
    return () => window.removeEventListener('popstate', handlePopModal);
  }, [cropTarget]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportPdf = async () => {
    if (!pages.length) return;
    setIsExporting(true);
    try {
      const doc = await PDFDocument.create();
      for (const page of pages) {
        const img = await new Promise(res => { const el = new Image(); el.onload = () => res(el); el.src = page.dataUrl; });
        const cv  = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext('2d').drawImage(img, 0, 0);
        const bytes = Uint8Array.from(atob(cv.toDataURL('image/jpeg', 0.82).split(',')[1]), c => c.charCodeAt(0));
        const emb   = await doc.embedJpg(bytes);
        const pg    = doc.addPage([emb.width, emb.height]);
        pg.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
      }
      const bytes = await doc.save();
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = Object.assign(document.createElement('a'), { href: url, download: `${pdfName.trim() || 'scan'}.pdf` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { alert('Export failed: ' + err.message); }
    finally { setIsExporting(false); }
  };


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {cropTarget && (
        <ImageCropper 
          src={cropTarget.dataUrl} 
          onDone={applyCrop} 
          onCancel={() => { 
            setCropTarget(null); 
            if (window.history.state?.modal === 'cropper') window.history.back(); 
          }} 
        />
      )}

      {/* sr-only inputs — not display:none so iOS Safari .click() works */}
      <input ref={fileInputRef}   type="file" accept="image/*" multiple         className="sr-only" tabIndex={-1} onChange={handleFileInput} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={handleFileInput} />

      <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#111111] text-white' : 'bg-gray-100 text-gray-900'}`}>

        {/* ─── Header ─── */}
        <div className={`flex items-center gap-3 px-3 md:px-6 py-2 border-b flex-shrink-0 ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
          <button onClick={onBack} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Editable name */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                autoFocus
                type="text"
                value={pdfName}
                onChange={(e) => setPdfName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false); }}
                className={`font-bold text-sm md:text-base w-full max-w-[240px] bg-transparent border-b-2 border-teal-500 outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                placeholder="scan"
              />
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span className={`font-bold text-sm md:text-base truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {pdfName || 'scan'}.pdf
                </span>
                <button
                  onClick={() => { setIsEditingName(true); setTimeout(() => nameInputRef.current?.select(), 30); }}
                  className={`flex-shrink-0 p-1 rounded-md border transition-all ${isDark ? 'border-gray-700 text-gray-400 hover:text-teal-400' : 'border-gray-200 text-gray-400 hover:text-teal-600'}`}
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className={`text-[10px] md:text-xs mt-0.5 leading-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {isLoadingPdf
                ? `Rendering pages… ${pdfLoadProgress}%`
                : `${pages.length} page${pages.length !== 1 ? 's' : ''} · Drag to reorder`}
            </p>
          </div>

          <button
            onClick={exportPdf}
            disabled={pages.length === 0 || isExporting || isLoadingPdf}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-md flex-shrink-0"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export PDF</span>
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">

          {/* Loading progress bar */}
          {isLoadingPdf && (
            <div className={`mb-5 p-4 rounded-2xl ${isDark ? 'bg-[#1e1e1e]' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Rendering PDF pages as images…
                </span>
                <span className="ml-auto text-xs text-teal-500 font-mono">{pdfLoadProgress}%</span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${pdfLoadProgress}%` }} />
              </div>
            </div>
          )}

          {pages.length === 0 && !isLoadingPdf ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
              <div className={`w-28 h-28 rounded-3xl flex items-center justify-center ${isDark ? 'bg-[#2a2a2a]' : 'bg-white shadow-md'}`}>
                <Camera className="w-14 h-14 text-teal-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">No Pages Yet</h3>
                <p className={`text-sm max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Scan a document with your camera, or upload existing photos.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-3 rounded-xl font-semibold shadow-md transition-all">
                  <Camera className="w-5 h-5" /> Use Camera
                </button>
                <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all ${isDark ? 'bg-[#2a2a2a] text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'}`}>
                  <ImagePlus className="w-5 h-5" /> Upload Images
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Grid layout ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 max-w-6xl mx-auto">
                {pages.map((page, idx) => {
                  const isDragOver = dragOverId === page.id;
                  const isDragging = dragIdRef.current === page.id;
                  return (
                    <div
                      key={page.id}
                      data-page-id={page.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, page.id)}
                      onDragOver={(e)  => onDragOver(e, page.id)}
                      onDragEnd={onDragEnd}
                      className={`relative rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing transition-all duration-300 ease-in-out
                        ${isDark ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}
                        ${isDragging   ? 'opacity-20 scale-90 grayscale' : 'opacity-100 scale-100'}
                        hover:shadow-xl hover:-translate-y-1 transform-gpu`}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-900">
                        <img
                          src={page.dataUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />

                        {/* Desktop-only Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all duration-300 hidden md:flex items-center justify-center gap-3 opacity-0 hover:opacity-100 z-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); openCrop(page); }}
                            className="bg-teal-500 text-white p-2.5 rounded-2xl shadow-xl transition-all hover:bg-teal-600 hover:scale-110 active:scale-95"
                            title="Crop Image"
                          >
                            <Crop className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                            className="bg-red-500 text-white p-2.5 rounded-2xl shadow-xl transition-all hover:bg-red-600 hover:scale-110 active:scale-95"
                            title="Remove Page"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Mobile Action Buttons (Floating) */}
                        <div className="md:hidden contents">
                           <button 
                            onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                            className="absolute top-1.5 right-1.5 z-20 bg-red-500/90 text-white p-1.5 rounded-lg shadow-lg active:scale-90"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                           <button 
                            onClick={(e) => { e.stopPropagation(); openCrop(page); }}
                            className="absolute bottom-1.5 right-1.5 z-20 bg-teal-500/90 text-white p-1.5 rounded-lg shadow-lg active:scale-90"
                           >
                             <Crop className="w-3.5 h-3.5" />
                           </button>
                           <div className="absolute bottom-1.5 left-1.5 z-20 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/10">
                             {idx + 1}
                           </div>
                        </div>

                        {/* Drag handle icon - Mobile Trigger */}
                        <div 
                          className={`absolute top-1.5 left-1.5 z-30 p-1.5 rounded-lg bg-black/40 backdrop-blur-md opacity-80 ${isDark ? 'text-white' : 'text-gray-100'} touch-none`}
                          onTouchStart={(e) => onTouchStart(e, page.id)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* "Add More" card in the grid */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all aspect-[3/4]
                    ${isDark ? 'border-gray-700 text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                >
                  <ImagePlus className="w-7 h-7" />
                  <span className="text-xs font-medium text-center px-2">Add Images</span>
                </div>

                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all aspect-[3/4]
                    ${isDark ? 'border-gray-700 text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                >
                  <Camera className="w-7 h-7" />
                  <span className="text-xs font-medium text-center px-2">Scan More</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile sticky export */}
        {pages.length > 0 && (
          <div className={`md:hidden border-t px-4 py-3 flex-shrink-0 ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
            <button
              onClick={exportPdf}
              disabled={isExporting || isLoadingPdf}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white rounded-2xl text-sm font-bold shadow-md transition-all"
            >
              {isLoadingPdf ? <><Loader2 className="w-5 h-5 animate-spin" /> Rendering… {pdfLoadProgress}%</>
                : isExporting ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating PDF…</>
                : <><Download className="w-5 h-5" /> Export {pages.length}-Page PDF</>}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
