import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ScanText, Loader2, Copy, Check, MousePointer2, ZoomIn, ZoomOut, Maximize, GripHorizontal } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

export default function InteractiveExtractViewer({ file, isDark, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  
  const [isRendering, setIsRendering] = useState(true);
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  
  const [zoom, setZoom] = useState(1);
  const activePointers = useRef(new Map());
  const initialPinchDistance = useRef(null);
  
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const boundsRef = useRef(null);
  const toolbarRef = useRef(null);

  const [cropState, setCropState] = useState({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [box, setBox] = useState(null); // { x, y, width, height }
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [copied, setCopied] = useState(false);
  
  const tesseractWorker = useRef(null);

  // Initialize PDF Document
  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const loadedPdf = await loadingTask.promise;
        if (!active) return;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (e) {
        console.error("PDF Load Error:", e);
      }
    };
    loadPdf();
    
    // Load Tesseract Native Logic silently in background
    const loadTesseract = async () => {
      tesseractWorker.current = await createWorker('eng');
    };
    loadTesseract();

    return () => {
      active = false;
      if (tesseractWorker.current) tesseractWorker.current.terminate();
    };
  }, [file]);

  // Render Current Page manually cleanly natively
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    
    let renderTask = null;
    const renderPage = async () => {
      setIsRendering(true);
      try {
        const page = await pdf.getPage(currentPage);
        
        // We render it visually just large enough to read layout dimensions
        // Note: The hidden OCR rendering happens later at extreme resolution.
        const viewport = page.getViewport({ scale: 1.2 }); 
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch(e) {
         if (e.name !== 'RenderingCancelledException') {
            console.error("Render Error:", e);
         }
      } finally {
        setIsRendering(false);
      }
    };
    
    renderPage();
    
    return () => {
       if (renderTask) renderTask.cancel();
    };
  }, [pdf, currentPage]);


  // Custom Drag Toolbar Mechanics mathematically cleanly natively 
  useEffect(() => {
    const handleToolbarDrag = (e) => {
      if (!dragStart.current || !boundsRef.current || !toolbarRef.current) return;
      e.preventDefault();
      
      const dx = dragStart.current.startX - e.clientX;
      const dy = dragStart.current.startY - e.clientY;
      
      let newX = dragStart.current.initX + dx;
      let newY = dragStart.current.initY + dy;
      
      const boundsRect = boundsRef.current.getBoundingClientRect();
      const tbRect = toolbarRef.current.getBoundingClientRect();
      
      const maxX = Math.max(0, boundsRect.width - tbRect.width - 32);
      const maxY = Math.max(0, boundsRect.height - tbRect.height - 32);
      
      setToolbarPos({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleToolbarUp = () => {
      dragStart.current = null;
    };

    window.addEventListener('pointermove', handleToolbarDrag, { passive: false });
    window.addEventListener('pointerup', handleToolbarUp);
    return () => {
      window.removeEventListener('pointermove', handleToolbarDrag);
      window.removeEventListener('pointerup', handleToolbarUp);
    };
  }, [toolbarPos]);

  const initToolbarDrag = (e) => {
    dragStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: toolbarPos.x,
      initY: toolbarPos.y
    };
  };

  // Mobile Optimized Universal Pointer Handlers cleanly
  const handlePointerDown = (e) => {
    if (dragStart.current) return;

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // Determine bounds organically if two fingers are injected manually
    if (activePointers.current.size === 2) {
       const pts = Array.from(activePointers.current.values());
       initialPinchDistance.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
       setCropState(prev => ({ ...prev, active: false }));
       setBox(null);
       return;
    }
    
    if (activePointers.current.size > 1) return;

    // Single click/touch drawing boundary
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCropState({ active: true, startX: x, startY: y, currentX: x, currentY: y });
    setBox(null);
  };

  const handlePointerMove = (e) => {
    if (dragStart.current) return;

    if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Mathematical Pinch Zoom execution limits natively
    if (activePointers.current.size === 2) {
        e.preventDefault();
        const pts = Array.from(activePointers.current.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (initialPinchDistance.current) {
            const ratio = currentDist / initialPinchDistance.current;
            // Prevent absurd structural blowups
            setZoom(prev => Math.max(0.5, Math.min(3.5, prev * ratio)));
            initialPinchDistance.current = currentDist;
        }
        return;
    }

    if (!cropState.active || activePointers.current.size > 1) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setCropState({ ...cropState, currentX: x, currentY: y });
  };

  const handlePointerUp = (e) => {
    if (dragStart.current) return;

    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
        initialPinchDistance.current = null;
    }

    if (!cropState.active) return;
    
    const x = Math.min(cropState.startX, cropState.currentX);
    const y = Math.min(cropState.startY, cropState.currentY);
    const width = Math.abs(cropState.currentX - cropState.startX);
    const height = Math.abs(cropState.currentY - cropState.startY);

    if (width > 5 && height > 5) {
      setBox({ x, y, width, height });
      
      // Auto-redirect to execute block on mobile
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          scrollContainerRef.current?.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
    setCropState({ ...cropState, active: false });
  };


  // Extreme Precision Execution Bounds natively
  const executeCroppedOCR = async () => {
     if (!box || !pdf || !tesseractWorker.current) return;
     setIsExtracting(true);
     setExtractedText("");

     try {
       // 1. We must spin up an INVISIBLE mathematically huge canvas logic bound at scale: 3.0
       // This guarantees Tesseract sees physically flawless pixel structures natively!
       const page = await pdf.getPage(currentPage);
       const highResScale = 3.0; // Overkill accuracy parameter
       const highResViewport = page.getViewport({ scale: highResScale });
       
       const canvas = document.createElement('canvas');
       const ctx = canvas.getContext('2d');
       canvas.width = highResViewport.width;
       canvas.height = highResViewport.height;

       ctx.fillStyle = '#ffffff';
       ctx.fillRect(0, 0, canvas.width, canvas.height);

       await page.render({ canvasContext: ctx, viewport: highResViewport }).promise;

       // 2. We extract specific coordinates!
       // Our visual canvas was scale: 1.2. The new canvas is scale: 3.0!
       // Calculate scaling ratios manually:
       const ratio = highResScale / 1.2; 
       
       const cropX = box.x * ratio;
       const cropY = box.y * ratio;
       const cropW = box.width * ratio;
       const cropH = box.height * ratio;

       // 3. We create a dedicated final Canvas buffer natively mapped exactly to the region!
       const padding = 20; // OCR absolutely requires white margin whitespace padding structurally natively!
       const cropCanvas = document.createElement('canvas');
       cropCanvas.width = cropW + (padding * 2);
       cropCanvas.height = cropH + (padding * 2);
       const cropCtx = cropCanvas.getContext('2d');

       // Build pristine white padding block boundary correctly
       cropCtx.fillStyle = '#ffffff';
       cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

       // ACCURACY FIX: Brutal binarization blocks background noise natively mathematically. Brightness clears bad camera shadows.
       cropCtx.filter = 'grayscale(100%) contrast(300%) brightness(120%)';
       
       cropCtx.drawImage(
         canvas, 
         cropX, cropY, cropW, cropH, // Source Math bounds
         padding, padding, cropW, cropH        // Destination mathematically bounded seamlessly structurally
       );

       // 4. Pass perfectly optimized high-density block directly into native execution model!
       const { data: { text } } = await tesseractWorker.current.recognize(cropCanvas);
       
       setExtractedText(text.trim() || 'No legible text was found logically inside this block.');

       // Garbage map collection
       canvas.width = 0; canvas.height = 0;
       cropCanvas.width = 0; cropCanvas.height = 0;
       
     } catch(e) {
        console.error("Deep Scan OCR Error:", e);
        alert("Failed to OCR region: " + e.message);
     } finally {
        setIsExtracting(false);
     }
  };

  const currentBox = box || (cropState.active ? {
    x: Math.min(cropState.startX, cropState.currentX),
    y: Math.min(cropState.startY, cropState.currentY),
    width: Math.abs(cropState.currentX - cropState.startX),
    height: Math.abs(cropState.currentY - cropState.startY)
  } : null);

  const displayScaleX = canvasRef.current ? (canvasRef.current.clientWidth / canvasRef.current.width) : 1;
  const displayScaleY = canvasRef.current ? (canvasRef.current.clientHeight / canvasRef.current.height) : 1;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#111111] text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header Pipeline Layout */}
      <div className={`flex items-center justify-between px-3 md:px-6 py-3 border-b ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
             <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="font-bold text-sm md:text-lg truncate">{file.name}</h2>
            <p className={`text-xs hidden md:block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Interactive Manual Scanning Active</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          <button 
             disabled={currentPage <= 1 || isRendering} 
             onClick={() => {setCurrentPage(p => p - 1); setBox(null);}} 
             className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/20"
          >
            <ChevronLeft className="w-5 h-5"/>
          </button>
          <span className="font-medium font-monospace w-20 md:w-24 text-center text-sm">
             Pg {currentPage}/{numPages || '-'}
          </span>
          <button 
             disabled={currentPage >= numPages || isRendering} 
             onClick={() => {setCurrentPage(p => p + 1); setBox(null);}} 
             className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/20"
          >
            <ChevronRight className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* Primary Interaction Boundary */}
      <div ref={scrollContainerRef} className="flex flex-1 overflow-y-auto overflow-x-hidden lg:overflow-hidden flex-col lg:flex-row pb-24 lg:pb-0 relative scroll-smooth">
         
         {/* Left Bounds: Canvas Workspace Tool */}
         <div ref={boundsRef} className={`w-full h-[75vh] lg:h-[75vh] lg:flex-1 relative bg-[#1f2022] overflow-hidden flex flex-col flex-shrink-0`}>
             
            {/* Infinite Panning Sandbox limits natively */}
            <div className="flex-1 overflow-auto w-full h-full p-1 md:p-8 flex items-start justify-center">
               <div 
                  className="relative shadow-2xl rounded-sm ring-1 ring-black/10 select-none touch-none bg-white transition-all duration-75 inline-block mx-auto mb-10" 
                  style={{ 
                    display: isRendering && !canvasRef.current ? 'none' : 'block',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    touchAction: 'none'
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onPointerCancel={handlePointerUp}
               >
                  <canvas ref={canvasRef} className="max-w-full max-h-[70vh] md:max-w-none md:max-h-[75vh] object-contain cursor-crosshair block" />
                  
                  {currentBox && (
                    <div 
                       className="absolute border-2 border-blue-500 border-dashed bg-blue-500/20 pointer-events-none"
                       style={{
                          left: Math.max(0, currentBox.x * displayScaleX),
                          top: Math.max(0, currentBox.y * displayScaleY),
                          width: currentBox.width * displayScaleX,
                          height: currentBox.height * displayScaleY
                       }}
                    />
                  )}
               </div>
            </div>

            {/* Floating Zoom Toolbar safely bound to Workspace Corner physically */}
            <div 
               ref={toolbarRef}
               className={`absolute z-[40] flex flex-col md:flex-row gap-1 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden ${isDark ? 'bg-[#2a2a2a]' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-1 overflow-hidden touch-none`}
               style={{
                  bottom: `calc(1rem + ${toolbarPos.y}px)`,
                  right: `calc(1rem + ${toolbarPos.x}px)`
               }}
            >
                <div title="Drag Toolbar" onPointerDown={initToolbarDrag} className={`flex items-center justify-center p-2 cursor-grab active:cursor-grabbing rounded hover:bg-gray-500/10 touch-none ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
                   <GripHorizontal className="w-5 h-5 mx-auto pointer-events-none"/>
                </div>
                <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><ZoomOut className="w-5 h-5"/></button>
                <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                <button onClick={() => setZoom(1)} className={`p-2 transition-colors rounded-lg ${zoom === 1 ? 'opacity-50' : ''} ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><Maximize className="w-5 h-5"/></button>
                <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                <button onClick={() => setZoom(z => Math.min(3.5, z + 0.25))} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><ZoomIn className="w-5 h-5"/></button>
            </div>
         </div>

         {/* Right Bounds: Extraction Logic Output Screen */}
         <div className={`w-full lg:w-[400px] xl:w-[500px] border-t lg:border-t-0 lg:border-l flex flex-col ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="p-6 border-b border-gray-500/20">
               <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                 <ScanText className="w-5 h-5 text-blue-500" /> Regional Output
               </h3>
               <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-6`}>
                 Visually draw a physical box directly over any specific paragraph natively inside the PDF viewer manually to instantly deeply scan it structurally offline.
               </p>
               
               <button 
                 onClick={async () => {
                   await executeCroppedOCR();
                   if (scrollContainerRef.current) {
                      setTimeout(() => {
                         scrollContainerRef.current.scrollTo({
                           top: scrollContainerRef.current.scrollHeight,
                           behavior: 'smooth'
                         });
                      }, 100);
                   }
                 }}
                 disabled={!box || isExtracting}
                 className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-white ${!box ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
               >
                 {isExtracting ? (
                   <><Loader2 className="w-5 h-5 animate-spin" /> Deep Binarization Scanning...</>
                 ) : (
                   <><MousePointer2 className="w-5 h-5" /> Execute Selection Box</>
                 )}
               </button>
            </div>
            
            <div className={`flex-1 p-6 overflow-y-auto ${isDark ? 'bg-[#151515]' : 'bg-gray-50'}`}>
               {!extractedText ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-40 text-center gap-4">
                   <ScanText className="w-12 h-12" />
                   <p className="font-medium text-sm w-48">Awaiting explicit manual region selection structure boundaries physically to extract securely.</p>
                 </div>
               ) : (
                 <div className="relative">
                   <pre className={`whitespace-pre-wrap font-sans text-sm leading-relaxed p-4 rounded-xl border shadow-inner ${isDark ? 'bg-[#222222] border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}`}>
                     {extractedText}
                   </pre>
                   <button 
                     onClick={() => { navigator.clipboard.writeText(extractedText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                     className="absolute top-2 right-2 p-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-colors"
                     title="Copy Results"
                   >
                     {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   </button>
                 </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
}
