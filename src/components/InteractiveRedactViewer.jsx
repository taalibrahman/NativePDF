import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Download,
  ZoomIn, ZoomOut, Maximize, GripHorizontal,
  Eraser, Square, Type, Trash2, Undo2, Pipette, ImagePlus, Move, Maximize2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Droplets, Type as TypeIcon
} from 'lucide-react';

// All 14 pdf-lib StandardFonts available for user selection
const FONT_OPTIONS = [
  { key: 'Helvetica', label: 'Helvetica' },
  { key: 'HelveticaBold', label: 'Helvetica Bold' },
  { key: 'HelveticaOblique', label: 'Helvetica Italic' },
  { key: 'HelveticaBoldOblique', label: 'Helvetica Bold Italic' },
  { key: 'TimesRoman', label: 'Times Roman' },
  { key: 'TimesRomanBold', label: 'Times Roman Bold' },
  { key: 'TimesRomanItalic', label: 'Times Roman Italic' },
  { key: 'TimesRomanBoldItalic', label: 'Times Roman Bold Italic' },
  { key: 'Courier', label: 'Courier' },
  { key: 'CourierBold', label: 'Courier Bold' },
  { key: 'CourierOblique', label: 'Courier Italic' },
  { key: 'CourierBoldOblique', label: 'Courier Bold Italic' },
];

// Font family resolver: maps base family + bold/italic flags → font key
const FONT_FAMILIES = {
  Helvetica: { base: 'Helvetica', bold: 'HelveticaBold', italic: 'HelveticaOblique', boldItalic: 'HelveticaBoldOblique' },
  TimesRoman: { base: 'TimesRoman', bold: 'TimesRomanBold', italic: 'TimesRomanItalic', boldItalic: 'TimesRomanBoldItalic' },
  Courier: { base: 'Courier', bold: 'CourierBold', italic: 'CourierOblique', boldItalic: 'CourierBoldOblique' },
};

const parseFontKey = (key) => {
  const isBold = /Bold/.test(key);
  const isItalic = /Oblique|Italic/.test(key);
  let family = 'Helvetica';
  if (/Times/.test(key)) family = 'TimesRoman';
  else if (/Courier/.test(key)) family = 'Courier';
  return { family, isBold, isItalic };
};

const resolveFont = (family, bold, italic) => {
  const f = FONT_FAMILIES[family] || FONT_FAMILIES.Helvetica;
  if (bold && italic) return f.boldItalic;
  if (bold) return f.bold;
  if (italic) return f.italic;
  return f.base;
};
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export default function InteractiveRedactViewer({ file, isDark, onClose }) {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isRendering, setIsRendering] = useState(true);
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Zoom engine
  const [zoom, setZoom] = useState(1);
  const activePointers = useRef(new Map());
  const initialPinchDistance = useRef(null);

  // Draggable toolbar
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const boundsRef = useRef(null);
  const toolbarRef = useRef(null);
  const toolsRef = useRef(null);

  // Tool modes: 'whiteout', 'blackout', 'autobg', 'text', 'image'
  const [activeTool, setActiveTool] = useState('whiteout');

  // Image insertion
  const imageInputRef = useRef(null);
  const pendingImageBox = useRef(null);
  // Image drag/resize state: { mode: 'move'|'resize', idx, startX, startY, origX, origY, origW, origH }
  const imageDragState = useRef(null);

  // Drawing state
  const [cropState, setCropState] = useState({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });

  // Per-page annotations: { [pageNum]: [{ type, x, y, width, height, text?, detectedFont?, detectedSize? }] }
  const [annotations, setAnnotations] = useState({});

  // Currently selected annotation index (unified for all types)
  const [selectedIdx, setSelectedIdx] = useState(null);
  // Index of annotation being inline-edited directly on canvas
  const [inlineEditIdx, setInlineEditIdx] = useState(null);
  const lastTapTime = useRef({});

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Watermark state
  const [watermark, setWatermark] = useState({
    text: '',
    image: null,
    opacity: 0.3,
    rotation: 45,
    pages: 'all',
    color: '#000000',
    fontSize: 50,
    scale: 1
  });
  const watermarkInputRef = useRef(null);

  const handleWatermarkImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWatermark(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Store the visual render scale so we can map coordinates
  const renderScale = useRef(1.2);

  // ─── Font Detection Engine ───
  const mapToStandardFont = (fontName) => {
    if (!fontName) return 'Helvetica';
    const lower = fontName.toLowerCase();
    // Strip common prefixes like "BCDFEE+" that PDF embeds use
    const cleaned = lower.replace(/^[A-Za-z]{6}\+/i, '');

    const isBold = cleaned.includes('bold') || cleaned.includes('bd') || cleaned.includes('-b');
    const isItalic = cleaned.includes('italic') || cleaned.includes('oblique') || cleaned.includes('-it') || cleaned.includes(',italic');

    // Times / Serif family
    if (cleaned.includes('times') || cleaned.includes('serif') || cleaned.includes('georgia') || cleaned.includes('cambria') || cleaned.includes('garamond') || cleaned.includes('palatino')) {
      if (isBold && isItalic) return 'TimesRomanBoldItalic';
      if (isBold) return 'TimesRomanBold';
      if (isItalic) return 'TimesRomanItalic';
      return 'TimesRoman';
    }
    // Courier / Mono family
    if (cleaned.includes('courier') || cleaned.includes('mono') || cleaned.includes('consol') || cleaned.includes('menlo') || cleaned.includes('lucida console')) {
      if (isBold && isItalic) return 'CourierBoldOblique';
      if (isBold) return 'CourierBold';
      if (isItalic) return 'CourierOblique';
      return 'Courier';
    }
    // Helvetica / Sans-Serif / Arial / Default
    if (isBold && isItalic) return 'HelveticaBoldOblique';
    if (isBold) return 'HelveticaBold';
    if (isItalic) return 'HelveticaOblique';
    return 'Helvetica';
  };

  // Scans the text content underneath a drawn region and returns the dominant font + size
  const detectFontInRegion = async (pageNum, regionX, regionY, regionW, regionH) => {
    if (!pdf) return { fontKey: 'Helvetica', fontSize: 12 };
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: renderScale.current });

      const hits = [];
      for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;
        const tx = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const itemX = tx[0];
        const itemY = tx[1];
        const itemFontSize = Math.abs(item.transform[3]) * renderScale.current;

        // Check overlap with a generous margin
        if (itemX >= regionX - 30 && itemX <= regionX + regionW + 30 &&
            itemY >= regionY - 30 && itemY <= regionY + regionH + 30) {
          hits.push({ fontName: item.fontName || '', fontSize: itemFontSize });
        }
      }

      if (hits.length === 0) return { fontKey: 'Helvetica', fontSize: 12 };

      // Find the most common font name using weighted scoring
      const fontCounts = {};
      let totalSize = 0;
      for (const h of hits) {
        const key = h.fontName;
        fontCounts[key] = (fontCounts[key] || 0) + 1;
        totalSize += h.fontSize;
      }
      const dominantFontName = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0][0];
      const avgSize = totalSize / hits.length;

      return {
        fontKey: mapToStandardFont(dominantFontName),
        fontSize: Math.round(avgSize / renderScale.current * 10) / 10,
        rawFontName: dominantFontName
      };
    } catch (e) {
      console.warn('Font detection failed:', e);
      return { fontKey: 'Helvetica', fontSize: 12 };
    }
  };

  // ─── Background Color Sampling ───
  const sampleBackgroundColor = (regionX, regionY, regionW, regionH) => {
    if (!canvasRef.current) return { r: 1, g: 1, b: 1, css: '#ffffff' };
    const ctx = canvasRef.current.getContext('2d');
    const x = Math.max(0, Math.round(regionX));
    const y = Math.max(0, Math.round(regionY));
    const w = Math.min(Math.round(regionW), canvasRef.current.width - x);
    const h = Math.min(Math.round(regionH), canvasRef.current.height - y);
    if (w <= 0 || h <= 0) return { r: 1, g: 1, b: 1, css: '#ffffff' };

    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;

    // Sample edges (top row, bottom row, left col, right col) to get background
    const edgePixels = [];
    for (let px = 0; px < w; px++) {
      edgePixels.push((0 * w + px) * 4);           // top row
      edgePixels.push(((h - 1) * w + px) * 4);     // bottom row
    }
    for (let py = 0; py < h; py++) {
      edgePixels.push((py * w + 0) * 4);            // left col
      edgePixels.push((py * w + (w - 1)) * 4);      // right col
    }

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (const idx of edgePixels) {
      if (idx + 2 < data.length) {
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }
    if (count === 0) return { r: 1, g: 1, b: 1, css: '#ffffff' };

    const rAvg = Math.round(rSum / count);
    const gAvg = Math.round(gSum / count);
    const bAvg = Math.round(bSum / count);

    return {
      r: rAvg / 255,
      g: gAvg / 255,
      b: bAvg / 255,
      css: `rgb(${rAvg},${gAvg},${bAvg})`
    };
  };

  // ─── PDF Loading ───
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
    return () => { active = false; };
  }, [file]);

  // ─── Render Current Page ───
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let renderTask = null;
    const renderPage = async () => {
      setIsRendering(true);
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: renderScale.current });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        if (e.name !== 'RenderingCancelledException') {
          console.error("Render Error:", e);
        }
      } finally {
        setIsRendering(false);
      }
    };
    renderPage();
    return () => { if (renderTask) renderTask.cancel(); };
  }, [pdf, currentPage]);

  // ─── Draggable Zoom Toolbar ───
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
    const handleToolbarUp = () => { dragStart.current = null; };
    window.addEventListener('pointermove', handleToolbarDrag, { passive: false });
    window.addEventListener('pointerup', handleToolbarUp);
    return () => {
      window.removeEventListener('pointermove', handleToolbarDrag);
      window.removeEventListener('pointerup', handleToolbarUp);
    };
  }, [toolbarPos]);

  const initToolbarDrag = (e) => {
    dragStart.current = {
      startX: e.clientX, startY: e.clientY,
      initX: toolbarPos.x, initY: toolbarPos.y
    };
  };

  // ─── Pointer Handlers (Draw + Pinch Zoom) ───
  const handlePointerDown = (e) => {
    if (dragStart.current) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      initialPinchDistance.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setCropState(prev => ({ ...prev, active: false }));
      return;
    }
    if (activePointers.current.size > 1) return;
    if (activeTool === 'watermark') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCropState({ active: true, startX: x, startY: y, currentX: x, currentY: y });
  };

  const handlePointerMove = (e) => {
    if (dragStart.current) return;
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePointers.current.size === 2) {
      e.preventDefault();
      const pts = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (initialPinchDistance.current) {
        const ratio = currentDist / initialPinchDistance.current;
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
    if (activePointers.current.size < 2) initialPinchDistance.current = null;
    if (!cropState.active) return;

    const x = Math.min(cropState.startX, cropState.currentX);
    const y = Math.min(cropState.startY, cropState.currentY);
    const width = Math.abs(cropState.currentX - cropState.startX);
    const height = Math.abs(cropState.currentY - cropState.startY);

    if (width > 8 && height > 8) {
      // Image tool: open file picker instead of creating annotation immediately
      if (activeTool === 'image') {
        pendingImageBox.current = { x, y, width, height };
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
          imageInputRef.current.click();
        }
        setCropState({ ...cropState, active: false });
        return;
      }

      const newAnnotation = { type: activeTool, x, y, width, height, text: '', detectedFont: 'Helvetica', detectedSize: 12, bgColor: null, imageDataUrl: null, align: 'left' };

      if (activeTool === 'autobg') {
        newAnnotation.bgColor = sampleBackgroundColor(x, y, width, height);
      }

      detectFontInRegion(currentPage, x, y, width, height).then(detected => {
        setAnnotations(prev => {
          const pageAnns = [...(prev[currentPage] || [])];
          const lastIdx = pageAnns.length - 1;
          if (lastIdx >= 0) {
            pageAnns[lastIdx] = { ...pageAnns[lastIdx], detectedFont: detected.fontKey, detectedSize: detected.fontSize, rawFontName: detected.rawFontName || '' };
          }
          return { ...prev, [currentPage]: pageAnns };
        });
      });

      setAnnotations(prev => {
        const pageAnns = prev[currentPage] || [];
        return { ...prev, [currentPage]: [...pageAnns, newAnnotation] };
      });
      if (activeTool === 'text') {
        const pageAnns = annotations[currentPage] || [];
        setSelectedIdx(pageAnns.length);
      }
    }
    setCropState({ ...cropState, active: false });
  };

  // ─── Image File Handler ───
  const handleImageSelected = (e) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile || !pendingImageBox.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const box = pendingImageBox.current;
      const newAnn = { type: 'image', x: box.x, y: box.y, width: box.width, height: box.height, text: '', detectedFont: 'Helvetica', detectedSize: 12, bgColor: null, imageDataUrl: reader.result, imageName: imgFile.name, align: 'left' };
      setAnnotations(prev => {
        const pageAnns = prev[currentPage] || [];
        return { ...prev, [currentPage]: [...pageAnns, newAnn] };
      });
      const pageAnns = annotations[currentPage] || [];
      setSelectedIdx(pageAnns.length);
      pendingImageBox.current = null;
      boundsRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    reader.readAsDataURL(imgFile);
    e.target.value = ''; // reset so same file can be re-selected
  };

  // ─── Annotation Drag/Resize Handlers (RAF-throttled for smoothness) ───
  // dragOffset holds live dx/dy/dw/dh during drag, committed to state only on pointerup
  const dragOffset = useRef({ dx: 0, dy: 0, dw: 0, dh: 0 });
  const rafId = useRef(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!imageDragState.current || !canvasRef.current) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const dx = (e.clientX - imageDragState.current.startX) * scaleX;
      const dy = (e.clientY - imageDragState.current.startY) * scaleY;
      if (imageDragState.current.mode === 'move') {
        dragOffset.current = { dx, dy, dw: 0, dh: 0 };
      } else {
        dragOffset.current = { dx: 0, dy: 0, dw: dx, dh: dy };
      }
      // Throttle re-renders to 1 per animation frame
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          forceRender(v => v + 1);
          rafId.current = null;
        });
      }
    };
    const handleDragEnd = () => {
      if (!imageDragState.current) return;
      const s = imageDragState.current;
      const o = dragOffset.current;
      // Commit final position/size to state
      setAnnotations(prev => {
        const pageAnns = [...(prev[currentPage] || [])];
        const ann = pageAnns[s.idx];
        if (!ann) return prev;
        if (s.mode === 'move') {
          pageAnns[s.idx] = { ...ann, x: s.origX + o.dx, y: s.origY + o.dy };
        } else {
          pageAnns[s.idx] = { ...ann, width: Math.max(20, s.origW + o.dw), height: Math.max(20, s.origH + o.dh) };
        }
        return { ...prev, [currentPage]: pageAnns };
      });
      imageDragState.current = null;
      dragOffset.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
    };
    window.addEventListener('pointermove', handleDragMove, { passive: false });
    window.addEventListener('pointerup', handleDragEnd);
    return () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [currentPage]);

  const startAnnotationMove = (e, idx, ann) => {
    e.stopPropagation();
    dragOffset.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
    imageDragState.current = { mode: 'move', idx, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y, origW: ann.width, origH: ann.height };
    setSelectedIdx(idx);
  };

  const startAnnotationResize = (e, idx, ann) => {
    e.stopPropagation();
    dragOffset.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
    imageDragState.current = { mode: 'resize', idx, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y, origW: ann.width, origH: ann.height };
    setSelectedIdx(idx);
  };

  // ─── Annotation Helpers ───
  const currentAnnotations = annotations[currentPage] || [];

  const updateAnnotationText = (idx, text) => {
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns[idx] = { ...pageAnns[idx], text };
      return { ...prev, [currentPage]: pageAnns };
    });
  };

  const updateAnnotationFont = (idx, fontKey) => {
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns[idx] = { ...pageAnns[idx], detectedFont: fontKey };
      return { ...prev, [currentPage]: pageAnns };
    });
  };

  const updateAnnotationSize = (idx, size) => {
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns[idx] = { ...pageAnns[idx], detectedSize: size };
      return { ...prev, [currentPage]: pageAnns };
    });
  };

  const updateAnnotationAlign = (idx, align) => {
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns[idx] = { ...pageAnns[idx], align };
      return { ...prev, [currentPage]: pageAnns };
    });
  };

  const removeAnnotation = (idx) => {
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns.splice(idx, 1);
      return { ...prev, [currentPage]: pageAnns };
    });
    setEditingTextIdx(null);
  };

  const undoLastAnnotation = () => {
    if (activeTool === 'watermark') {
      setWatermark(prev => ({ ...prev, text: '', image: null }));
      return;
    }
    setAnnotations(prev => {
      const pageAnns = [...(prev[currentPage] || [])];
      pageAnns.pop();
      return { ...prev, [currentPage]: pageAnns };
    });
    setEditingTextIdx(null);
  };

  const totalAnnotations = Object.values(annotations).reduce((sum, arr) => sum + arr.length, 0);

  // ─── PDF Export Pipeline ───
  const executeExport = async () => {
    const hasWatermark = !!(watermark.text?.trim() || watermark.image);
    if (totalAnnotations === 0 && !hasWatermark) return;
    setIsExporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);

      // Pre-embed all 14 standard fonts so we can dynamically pick the detected one
      const fontCache = {};
      const embedFont = async (key) => {
        if (!fontCache[key]) {
          fontCache[key] = await pdfDoc.embedFont(StandardFonts[key]);
        }
        return fontCache[key];
      };

      for (const [pageNumStr, anns] of Object.entries(annotations)) {
        const pageNum = parseInt(pageNumStr);
        const page = pdfDoc.getPages()[pageNum - 1];
        if (!page) continue;

        const { width: pdfW, height: pdfH } = page.getSize();
        const S = renderScale.current;

        for (const ann of anns) {
          const pdfX = ann.x / S;
          const pdfY = pdfH - (ann.y / S) - (ann.height / S);
          const pdfAnnW = ann.width / S;
          const pdfAnnH = ann.height / S;

          if (ann.type === 'whiteout') {
            page.drawRectangle({
              x: pdfX, y: pdfY, width: pdfAnnW, height: pdfAnnH,
              color: rgb(1, 1, 1),
              borderWidth: 0,
            });
          } else if (ann.type === 'blackout') {
            page.drawRectangle({
              x: pdfX, y: pdfY, width: pdfAnnW, height: pdfAnnH,
              color: rgb(0, 0, 0),
              borderWidth: 0,
            });
          } else if (ann.type === 'autobg') {
            const bg = ann.bgColor || { r: 1, g: 1, b: 1 };
            page.drawRectangle({
              x: pdfX, y: pdfY, width: pdfAnnW, height: pdfAnnH,
              color: rgb(bg.r, bg.g, bg.b),
              borderWidth: 0,
            });
          } else if (ann.type === 'text') {
            page.drawRectangle({
              x: pdfX, y: pdfY, width: pdfAnnW, height: pdfAnnH,
              color: rgb(1, 1, 1),
              borderWidth: 0,
            });
          } else if (ann.type === 'image' && ann.imageDataUrl) {
            // Embed the image into the PDF
            try {
              const imgBytes = Uint8Array.from(atob(ann.imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
              let embeddedImg;
              if (ann.imageDataUrl.includes('image/png')) {
                embeddedImg = await pdfDoc.embedPng(imgBytes);
              } else {
                embeddedImg = await pdfDoc.embedJpg(imgBytes);
              }
              page.drawImage(embeddedImg, { x: pdfX, y: pdfY, width: pdfAnnW, height: pdfAnnH });
            } catch (imgErr) {
              console.warn('Image embed failed:', imgErr);
            }
          }

          // Draw text on top for ANY annotation type that has text
          if (ann.text && ann.text.trim()) {
            const fontKey = ann.detectedFont || 'Helvetica';
            const font = await embedFont(fontKey);
            const fontSize = parseFloat(ann.detectedSize) || 12;
            const lineHeight = fontSize * 1.4;
            const textColor = ann.type === 'blackout' ? rgb(1, 1, 1) : rgb(0, 0, 0);

            const words = ann.text.split(/\s+/);
            const lines = [];
            let currentLine = '';
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const testWidth = font.widthOfTextAtSize(testLine, fontSize);
              if (testWidth > pdfAnnW - 8) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) lines.push(currentLine);

            for (let i = 0; i < lines.length; i++) {
              const lineY = pdfY + pdfAnnH - fontSize - (i * lineHeight) - 4;
              if (lineY < pdfY) break;
              const lineW = font.widthOfTextAtSize(lines[i], fontSize);
              let lineX = pdfX + 4;
              if (ann.align === 'center') lineX = pdfX + (pdfAnnW - lineW) / 2;
              else if (ann.align === 'right') lineX = pdfX + pdfAnnW - lineW - 4;
              page.drawText(lines[i], {
                x: lineX,
                y: lineY,
                size: fontSize,
                font: font,
                color: textColor,
              });
            }
          }
        }
      }

      // ─── Watermark Pipeline ───
      if (watermark.text?.trim() || watermark.image) {
        const pagesToWatermark = watermark.pages === 'all' 
          ? pdfDoc.getPages() 
          : [pdfDoc.getPages()[currentPage - 1]];
        
        const watermarkFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const { r, g, b } = watermark.color.startsWith('#') 
          ? { 
              r: parseInt(watermark.color.slice(1,3), 16)/255, 
              g: parseInt(watermark.color.slice(3,5), 16)/255, 
              b: parseInt(watermark.color.slice(5,7), 16)/255 
            }
          : { r: 0, g: 0, b: 0 };

        let wmImage = null;
        if (watermark.image) {
           const imgBytes = Uint8Array.from(atob(watermark.image.split(',')[1]), c => c.charCodeAt(0));
           if (watermark.image.includes('image/png')) wmImage = await pdfDoc.embedPng(imgBytes);
           else wmImage = await pdfDoc.embedJpg(imgBytes);
        }

        for (const page of pagesToWatermark) {
          if (!page) continue;
          const { width, height } = page.getSize();
          const centerX = width / 2;
          const centerY = height / 2;
          const angleRad = watermark.rotation * Math.PI / 180;
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);
          
          const sc = watermark.scale || 1;
          
          if (wmImage) {
             const aspect = wmImage.width / wmImage.height;
             const imgW = width * 0.5 * sc;
             const imgH = imgW / aspect;
             
             const cxLocal = imgW / 2;
             const cyLocal = imgH / 2;
             const dx = cxLocal * cosA - cyLocal * sinA;
             const dy = cxLocal * sinA + cyLocal * cosA;
             
             page.drawImage(wmImage, {
                x: centerX - dx,
                y: centerY - dy,
                width: imgW,
                height: imgH,
                opacity: watermark.opacity,
                rotate: degrees(watermark.rotation),
             });
          }
          if (watermark.text?.trim()) {
            const fs = watermark.fontSize * sc;
            const textW = watermarkFont.widthOfTextAtSize(watermark.text, fs);
            const cxLocal = textW / 2;
            const cyLocal = fs / 3;
            const dx = cxLocal * cosA - cyLocal * sinA;
            const dy = cxLocal * sinA + cyLocal * cosA;

            page.drawText(watermark.text, {
              x: centerX - dx,
              y: centerY - dy,
              size: fs,
              font: watermarkFont,
              color: rgb(r, g, b),
              opacity: watermark.opacity,
              rotate: degrees(watermark.rotation),
            });
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '_edited.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error("Export Error:", e);
      alert("Failed to export edited PDF: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Derived Display Values ───
  // Use percentage-based positioning so overlays stay aligned regardless of browser zoom
  const canvasW = canvasRef.current ? canvasRef.current.width : 1;
  const canvasH = canvasRef.current ? canvasRef.current.height : 1;
  const toPctX = (v) => `${(v / canvasW) * 100}%`;
  const toPctY = (v) => `${(v / canvasH) * 100}%`;

  const drawingBox = cropState.active ? {
    x: Math.min(cropState.startX, cropState.currentX),
    y: Math.min(cropState.startY, cropState.currentY),
    width: Math.abs(cropState.currentX - cropState.startX),
    height: Math.abs(cropState.currentY - cropState.startY)
  } : null;

  const toolColors = {
    whiteout: { border: 'border-gray-400', bg: 'bg-white', fill: '#ffffff' },
    blackout: { border: 'border-gray-900', bg: 'bg-black', fill: '#000000' },
    autobg: { border: 'border-amber-500', bg: 'bg-amber-500/10', fill: '#d4a574' },
    text: { border: 'border-blue-500', bg: 'bg-blue-500/10', fill: 'transparent' },
    image: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', fill: 'transparent' }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#111111] text-white' : 'bg-gray-100 text-gray-900'}`}>

      {/* ─── Header ─── */}
      <div className={`flex items-center justify-between px-3 md:px-6 py-3 border-b ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="font-bold text-sm md:text-lg truncate">{file.name}</h2>
            <p className={`text-xs hidden md:block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Annotation & Redaction Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          <button
            disabled={currentPage <= 1 || isRendering}
            onClick={() => { setCurrentPage(p => p - 1); setSelectedIdx(null); }}
            className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium font-monospace w-20 md:w-24 text-center text-sm">
            Pg {currentPage}/{numPages || '-'}
          </span>
          <button
            disabled={currentPage >= numPages || isRendering}
            onClick={() => { setCurrentPage(p => p + 1); setSelectedIdx(null); }}
            className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── Main Body ─── */}
      <div ref={scrollContainerRef} className="flex flex-1 overflow-y-auto overflow-x-hidden lg:overflow-hidden flex-col lg:flex-row pb-24 lg:pb-0 relative scroll-smooth">

        {/* ─── Left: Canvas Viewer ─── */}
        <div ref={boundsRef} className="w-full h-[75vh] lg:h-auto lg:flex-1 relative bg-[#1f2022] overflow-hidden flex flex-col flex-shrink-0">
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

              {/* Watermark Preview Overlay */}
              {(watermark.text?.trim() || watermark.image) && (watermark.pages === 'all' || watermark.pages === 'current') && (
                <div 
                   className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-40"
                   style={{ opacity: watermark.opacity }}
                >
                   <div 
                      style={{ 
                          transform: `rotate(${-watermark.rotation}deg) scale(${watermark.scale || 1})`,
                          color: watermark.color,
                          fontSize: `${watermark.fontSize}px`,
                          fontWeight: 'bold',
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                      }}
                   >
                     {watermark.image && (
                        <img 
                          src={watermark.image} 
                          alt="watermark preview" 
                          style={{ maxWidth: '300px', maxHeight: '300px', objectFit: 'contain' }} 
                        />
                     )}
                     {watermark.text?.trim() && <div>{watermark.text}</div>}
                   </div>
                </div>
              )}

              {/* Render committed annotations for the current page */}
              {currentAnnotations.map((ann, idx) => {
                const isSelected = selectedIdx === idx;
                const isImage = ann.type === 'image';
                const isDragging = imageDragState.current?.idx === idx;
                const o = isDragging ? dragOffset.current : { dx: 0, dy: 0, dw: 0, dh: 0 };
                const annX = ann.x + o.dx;
                const annY = ann.y + o.dy;
                const annW = Math.max(20, ann.width + o.dw);
                const annH = Math.max(20, ann.height + o.dh);

                // Compute CSS font metrics from the detected font for accurate preview
                const fontKey = ann.detectedFont || 'Helvetica';
                let fontFamily = 'Arial, Helvetica, sans-serif';
                let fontWeight = 'normal';
                let fontStyle = 'normal';
                if (fontKey.includes('Times')) { fontFamily = '"Times New Roman", Times, serif'; }
                else if (fontKey.includes('Courier')) { fontFamily = '"Courier New", Courier, monospace'; }
                if (fontKey.includes('Bold')) fontWeight = 'bold';
                if (fontKey.includes('Italic') || fontKey.includes('Oblique')) fontStyle = 'italic';
                // Scale font: detectedSize is PDF points, renderScale converts to canvas pixels,
                // then cssScale converts canvas pixels to actual CSS display pixels
                const cssScale = canvasRef.current ? canvasRef.current.clientHeight / canvasRef.current.height : 1;
                const cssFontSize = (ann.detectedSize || 12) * renderScale.current * cssScale;

                return (
                  <div
                    key={idx}
                    className={`absolute cursor-pointer ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    } ${isDragging ? '' : 'transition-all'}`}
                    style={{
                      left: toPctX(annX),
                      top: toPctY(annY),
                      width: toPctX(annW),
                      height: toPctY(annH),
                      backgroundColor: isImage ? 'transparent'
                        : ann.type === 'whiteout' ? 'rgba(255,255,255,0.75)'
                        : ann.type === 'blackout' ? 'rgba(0,0,0,0.7)'
                        : ann.type === 'autobg'
                          ? (ann.bgColor ? `${ann.bgColor.css.replace('rgb', 'rgba').replace(')', ',0.85)')}` : 'rgba(200,200,200,0.75)')
                          : 'rgba(59,130,246,0.06)',
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onPointerDown={(e) => {
                      if (isSelected) {
                        startAnnotationMove(e, idx, ann);
                      } else {
                        e.stopPropagation();
                        setSelectedIdx(isSelected ? null : idx);
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (!isImage) {
                        e.stopPropagation();
                        setSelectedIdx(idx);
                        setInlineEditIdx(idx);
                      }
                    }}
                    onPointerUp={(e) => {
                      // Mobile double-tap detection (two taps within 350ms)
                      if (!isImage) {
                        const now = Date.now();
                        const last = lastTapTime.current[idx] || 0;
                        if (now - last < 350) {
                          e.stopPropagation();
                          setSelectedIdx(idx);
                          setInlineEditIdx(idx);
                        }
                        lastTapTime.current[idx] = now;
                      }
                    }}
                  >
                    {isImage && ann.imageDataUrl && (
                      <img src={ann.imageDataUrl} alt="" className="w-full h-full object-fill pointer-events-none" draggable={false} />
                    )}
                     {/* Inline editable textarea — shown when double-tapped/clicked */}
                     {!isImage && inlineEditIdx === idx ? (
                       <textarea
                         autoFocus
                         className="w-full h-full bg-transparent resize-none border-none outline-none p-1"
                         style={{
                           fontSize: `${cssFontSize}px`,
                           fontFamily,
                           fontWeight,
                           fontStyle,
                           lineHeight: 1.35,
                           color: ann.type === 'blackout' ? '#fff' : '#000',
                           textAlign: ann.align || 'left',
                           caretColor: ann.type === 'blackout' ? '#fff' : '#000',
                         }}
                         value={ann.text || ''}
                         onChange={(e) => updateAnnotationText(idx, e.target.value)}
                         onBlur={() => setInlineEditIdx(null)}
                         onClick={(e) => e.stopPropagation()}
                         onPointerDown={(e) => e.stopPropagation()}
                       />
                     ) : (
                       ann.text && !isImage && (
                         <div className="w-full h-full overflow-hidden" style={{ padding: `${2 * cssScale}px ${4 * cssScale}px` }}>
                           <p
                             className="leading-snug break-words whitespace-pre-wrap pointer-events-none"
                             style={{
                               fontSize: `${cssFontSize}px`,
                               fontFamily,
                               fontWeight,
                               fontStyle,
                               lineHeight: 1.35,
                               color: ann.type === 'blackout' ? '#fff' : '#000',
                               textAlign: ann.align || 'left',
                             }}
                           >
                             {ann.text}
                           </p>
                         </div>
                       )
                     )}
                     {/* Resize handle for selected annotation */}
                    {isSelected && (
                      <>
                        <div
                          className="absolute -top-3 -right-3 w-7 h-7 bg-red-500 rounded-full cursor-pointer flex items-center justify-center shadow-lg border-2 border-white z-30"
                          onClick={(e) => { e.stopPropagation(); removeAnnotation(idx); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </div>
                        <div
                          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-tl cursor-nwse-resize touch-none z-20"
                          onPointerDown={(e) => startAnnotationResize(e, idx, ann)}
                        >
                          <Maximize2 className="w-3 h-3 text-white m-0.5 pointer-events-none" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Ghost drawing box */}
              {drawingBox && (
                <div
                  className={`absolute border-2 border-dashed pointer-events-none ${toolColors[activeTool].border}`}
                  style={{
                    left: toPctX(drawingBox.x),
                    top: toPctY(drawingBox.y),
                    width: toPctX(drawingBox.width),
                    height: toPctY(drawingBox.height),
                    backgroundColor: activeTool === 'whiteout' ? 'rgba(255,255,255,0.7)' : activeTool === 'blackout' ? 'rgba(0,0,0,0.5)' : activeTool === 'autobg' ? 'rgba(180,180,180,0.5)' : activeTool === 'image' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                  }}
                />
              )}
            </div>
          </div>

          {/* Floating Zoom Toolbar */}
          <div
            ref={toolbarRef}
            className={`absolute z-[40] flex flex-col md:flex-row gap-1 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden ${isDark ? 'bg-[#2a2a2a]' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-1 touch-none`}
            style={{
              bottom: `calc(1rem + ${toolbarPos.y}px)`,
              right: `calc(1rem + ${toolbarPos.x}px)`
            }}
          >
            <div title="Drag Toolbar" onPointerDown={initToolbarDrag} className="flex items-center justify-center p-2 cursor-grab active:cursor-grabbing rounded hover:bg-gray-500/10 touch-none text-gray-400">
              <GripHorizontal className="w-5 h-5 pointer-events-none" />
            </div>
            <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><ZoomOut className="w-5 h-5" /></button>
            <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <button onClick={() => setZoom(1)} className={`p-2 transition-colors rounded-lg ${zoom === 1 ? 'opacity-50' : ''} ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><Maximize className="w-5 h-5" /></button>
            <div className={`w-full md:w-px h-px md:h-6 mx-1 my-1 md:my-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <button onClick={() => setZoom(z => Math.min(3.5, z + 0.25))} className={`p-2 transition-colors rounded-lg ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}><ZoomIn className="w-5 h-5" /></button>
          </div>
        </div>

        {/* ─── Right: Tool Panel ─── */}
        <div ref={toolsRef} className={`w-full lg:w-[400px] xl:w-[500px] border-t lg:border-t-0 lg:border-l flex flex-col ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>

          {/* Tool Selector */}
          <div className="p-4 md:p-6 border-b border-gray-500/20">
            <h3 
              onClick={() => toolsRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="font-bold text-lg mb-4 flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-5 h-5 text-orange-500" /> Editing Tools
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => { setActiveTool('whiteout'); boundsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'whiteout'
                    ? 'border-gray-400 bg-gray-100 text-gray-900 shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Eraser className="w-5 h-5" />
                White-Out
              </button>
              <button
                onClick={() => { setActiveTool('blackout'); boundsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'blackout'
                    ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Square className="w-5 h-5" />
                Black-Out
              </button>
              <button
                onClick={() => { setActiveTool('autobg'); boundsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'autobg'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Pipette className="w-5 h-5" />
                Auto-Match
              </button>
              <button
                onClick={() => { setActiveTool('text'); boundsRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'text'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Type className="w-5 h-5" />
                Add Text
              </button>
              <button
                onClick={() => {
                  setActiveTool('image');
                  boundsRef.current?.scrollIntoView({ behavior: 'smooth' });
                  // Default placement: center of current canvas with a 200x200 box
                  const cw = canvasRef.current?.width || 600;
                  const ch = canvasRef.current?.height || 800;
                  pendingImageBox.current = { x: cw * 0.25, y: ch * 0.25, width: cw * 0.5, height: ch * 0.5 };
                  if (imageInputRef.current) {
                    imageInputRef.current.value = '';
                    setTimeout(() => imageInputRef.current?.click(), 50);
                  }
                }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'image'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <ImagePlus className="w-5 h-5" />
                Insert Image
              </button>
              <button
                onClick={() => {
                  setActiveTool('watermark');
                  setTimeout(() => document.getElementById('watermark-settings-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                  activeTool === 'watermark'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-md'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Droplets className="w-5 h-5" />
                Watermark
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={undoLastAnnotation}
                disabled={currentAnnotations.length === 0 && !(activeTool === 'watermark' && (watermark.text || watermark.image))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
            </div>
          </div>

          {/* Annotation List + Text Editor + Watermark Editor */}
          <div className={`flex-1 p-4 md:p-6 overflow-y-auto ${isDark ? 'bg-[#151515]' : 'bg-gray-50'}`}>
            {activeTool === 'watermark' ? (
              <div id="watermark-settings-panel" className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-2">
                   <Droplets className="w-5 h-5 text-purple-500" />
                   <h4 className="font-bold text-lg">Watermark PDF</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>TEXT CONTENT (Optional)</label>
                    <input 
                      type="text"
                      className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-purple-500 outline-none ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                      placeholder="e.g. CONFIDENTIAL"
                      value={watermark.text}
                      onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>IMAGE WATERMARK</label>
                    {watermark.image ? (
                        <div className="relative">
                            <img src={watermark.image} alt="watermark" className="w-full h-24 object-contain rounded-xl border border-gray-300 bg-black/5" />
                            <button onClick={() => setWatermark({...watermark, image: null})} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md shadow"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    ) : (
                        <button onClick={() => watermarkInputRef.current?.click()} className={`w-full py-3 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-300 text-gray-500 hover:bg-gray-100'}`}>
                           <ImagePlus className="w-5 h-5" /> Choose Image
                        </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>OPACITY ({Math.round(watermark.opacity * 100)}%)</label>
                      <input 
                        type="range" min="0.05" max="1" step="0.05"
                        className="w-full accent-purple-500"
                        value={watermark.opacity}
                        onChange={(e) => setWatermark({ ...watermark, opacity: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ROTATION ({watermark.rotation}°)</label>
                      <input 
                         type="range" min="0" max="360" step="15"
                         className="w-full accent-purple-500"
                         value={watermark.rotation}
                         onChange={(e) => setWatermark({ ...watermark, rotation: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>SCALE ({(watermark.scale || 1).toFixed(1)}x)</label>
                    <input 
                       type="range" min="0.1" max="5.0" step="0.1"
                       className="w-full accent-purple-500"
                       value={watermark.scale || 1}
                       onChange={(e) => setWatermark({ ...watermark, scale: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PAGE RANGE</label>
                    <div className="flex gap-2">
                       {['all', 'current'].map(p => (
                         <button
                           key={p}
                           onClick={() => setWatermark({ ...watermark, pages: p })}
                           className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                             watermark.pages === p 
                               ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                               : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                           }`}
                         >
                           {p === 'all' ? 'Entire PDF' : 'Current Page'}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : currentAnnotations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40 text-center gap-4">
                <Eraser className="w-12 h-12" />
                <p className="font-medium text-sm w-56">Draw a box over any area of the PDF to White-out, Black-out, or add replacement text.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Page {currentPage} — {currentAnnotations.length} edit{currentAnnotations.length !== 1 ? 's' : ''}
                </p>

                {currentAnnotations.map((ann, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isDark ? 'bg-[#222] border-gray-700' : 'bg-white border-gray-200'
                    } ${
                      selectedIdx === idx ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        ann.type === 'whiteout' ? 'text-gray-400' : ann.type === 'blackout' ? (isDark ? 'text-gray-300' : 'text-gray-800') : ann.type === 'autobg' ? 'text-amber-500' : ann.type === 'image' ? 'text-emerald-500' : 'text-blue-500'
                      }`}>
                        {ann.type === 'whiteout' ? '⬜ White-Out' : ann.type === 'blackout' ? '⬛ Black-Out' : ann.type === 'autobg' ? '🎨 Auto-Match' : ann.type === 'image' ? '🖼️ Image' : '✏️ Text Block'}
                      </span>
                      <button
                        onClick={() => removeAnnotation(idx)}
                        className="p-1 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {ann.type === 'text' && (
                      <>
                        <textarea
                          className={`w-full mt-1 p-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                          }`}
                          rows={3}
                          placeholder="Type replacement text here..."
                          value={ann.text}
                          onChange={(e) => updateAnnotationText(idx, e.target.value)}
                          onFocus={() => setSelectedIdx(idx)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <div className="flex gap-2 mt-2">
                          <select
                            value={ann.detectedFont || 'Helvetica'}
                            onChange={(e) => { e.stopPropagation(); updateAnnotationFont(idx, e.target.value); }}
                            className={`flex-1 text-xs p-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                            }`}
                          >
                            {FONT_OPTIONS.map(f => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="6" max="72" step="0.5"
                            value={ann.detectedSize !== undefined ? ann.detectedSize : 12}
                            onChange={(e) => { e.stopPropagation(); updateAnnotationSize(idx, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-16 text-xs p-1.5 rounded-lg border text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                            }`}
                          />
                          <span className={`text-xs self-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>pt</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {(() => { const { family, isBold, isItalic } = parseFontKey(ann.detectedFont || 'Helvetica'); return (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateAnnotationFont(idx, resolveFont(family, !isBold, isItalic)); }}
                                className={`flex items-center justify-center p-1.5 rounded-lg border text-xs font-bold transition-all ${
                                  isBold
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                    : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                <Bold className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateAnnotationFont(idx, resolveFont(family, isBold, !isItalic)); }}
                                className={`flex items-center justify-center p-1.5 rounded-lg border text-xs transition-all ${
                                  isItalic
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                    : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                <Italic className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ); })()}
                          {['left', 'center', 'right'].map(a => (
                            <button
                              key={a}
                              onClick={(e) => { e.stopPropagation(); updateAnnotationAlign(idx, a); }}
                              className={`flex-1 flex items-center justify-center p-1.5 rounded-lg border text-xs transition-all ${
                                (ann.align || 'left') === a
                                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                  : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {a === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                              {a === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                              {a === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>

                        {ann.rawFontName && (
                          <div className={`text-[10px] mt-1.5 px-2 py-1 rounded-md inline-block ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            🔤 Source: {ann.rawFontName}
                          </div>
                        )}
                      </>
                    )}

                    {/* Optional text overlay for whiteout, blackout, autobg */}
                    {(ann.type === 'whiteout' || ann.type === 'blackout' || ann.type === 'autobg') && (
                      <>
                        <textarea
                          className={`w-full mt-2 p-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                          }`}
                          rows={2}
                          placeholder="Optional: type text on top of overlay..."
                          value={ann.text}
                          onChange={(e) => updateAnnotationText(idx, e.target.value)}
                          onFocus={() => setSelectedIdx(idx)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {ann.text && (
                          <>
                            <div className="flex gap-2 mt-2">
                              <select
                                value={ann.detectedFont || 'Helvetica'}
                                onChange={(e) => { e.stopPropagation(); updateAnnotationFont(idx, e.target.value); }}
                                className={`flex-1 text-xs p-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                                }`}
                              >
                                {FONT_OPTIONS.map(f => (
                                  <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                              </select>
                              <input
                                type="number" min="6" max="72" step="0.5"
                                value={ann.detectedSize !== undefined ? ann.detectedSize : 12}
                                onChange={(e) => { e.stopPropagation(); updateAnnotationSize(idx, e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-16 text-xs p-1.5 rounded-lg border text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'
                                }`}
                              />
                              <span className={`text-xs self-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>pt</span>
                            </div>
                            <div className="flex gap-1 mt-2">
                              {(() => { const { family, isBold, isItalic } = parseFontKey(ann.detectedFont || 'Helvetica'); return (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateAnnotationFont(idx, resolveFont(family, !isBold, isItalic)); }}
                                    className={`flex items-center justify-center p-1.5 rounded-lg border text-xs font-bold transition-all ${
                                      isBold
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                        : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                    }`}
                                  >
                                    <Bold className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateAnnotationFont(idx, resolveFont(family, isBold, !isItalic)); }}
                                    className={`flex items-center justify-center p-1.5 rounded-lg border text-xs transition-all ${
                                      isItalic
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                        : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                    }`}
                                  >
                                    <Italic className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ); })()}
                              {['left', 'center', 'right'].map(a => (
                                <button
                                  key={a}
                                  onClick={(e) => { e.stopPropagation(); updateAnnotationAlign(idx, a); }}
                                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg border text-xs transition-all ${
                                    (ann.align || 'left') === a
                                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                      : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-500' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                  }`}
                                >
                                  {a === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                                  {a === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                                  {a === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {ann.type === 'autobg' && ann.bgColor && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-5 h-5 rounded border border-gray-400" style={{ backgroundColor: ann.bgColor.css }}></div>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Sampled: {ann.bgColor.css}</span>
                      </div>
                    )}

                    {ann.type === 'image' && ann.imageDataUrl && (
                      <div className="mt-2">
                        <img src={ann.imageDataUrl} alt={ann.imageName || 'image'} className="w-full h-20 object-contain rounded-lg border border-gray-300" />
                        <p className={`text-[10px] mt-1 truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{ann.imageName || 'Inserted image'}</p>
                        <p className={`text-[10px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          <Move className="w-3 h-3 inline" /> Drag to move · <Maximize2 className="w-3 h-3 inline" /> Corner to resize
                        </p>
                      </div>
                    )}

                    <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      Region: {Math.round(ann.x)}×{Math.round(ann.y)} → {Math.round(ann.width)}×{Math.round(ann.height)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Button */}
          <div className={`p-4 md:p-6 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            {(() => {
              const hasWatermark = !!(watermark.text?.trim() || watermark.image);
              const canExport = totalAnnotations > 0 || hasWatermark;
              return (
                <button
                  onClick={executeExport}
                  disabled={!canExport || isExporting}
                  className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-white ${!canExport ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {isExporting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Exporting PDF...</>
                  ) : (
                    <><Download className="w-5 h-5" /> Export Edited PDF ({totalAnnotations} edit{totalAnnotations !== 1 ? 's' : ''}{hasWatermark ? ' + Watermark' : ''})</>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
      {/* Hidden image file input — use sr-only pattern instead of display:none for reliable .click() */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none', top: -9999, left: -9999 }}
        onChange={handleImageSelected}
        tabIndex={-1}
      />
      <input
        ref={watermarkInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none', top: -9999, left: -9999 }}
        onChange={handleWatermarkImage}
        tabIndex={-1}
      />
    </div>
  );
}
