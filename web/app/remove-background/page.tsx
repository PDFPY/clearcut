"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BgMode = "transparent" | "color" | "blur" | "image";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

async function fileToBitmap(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function urlToBitmap(url: string): Promise<ImageBitmap> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  return await createImageBitmap(img);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export default function RemoveBackgroundPage() {
  // ---- inputs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  // ---- viewport
  const viewportWrapRef = useRef<HTMLDivElement | null>(null);
  const viewportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ---- offscreen at ORIGINAL resolution
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editCutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ---- state
  const [busy, setBusy] = useState(false);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [hasCutout, setHasCutout] = useState(false);

  // ---- background
  const [bgMode, setBgMode] = useState<BgMode>("transparent");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [blurPx, setBlurPx] = useState(14);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);

  // ---- view
  const [fullscreen, setFullscreen] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastClientRef = useRef({ x: 0, y: 0 });

  // ---- manual trace tool
  const [traceOn, setTraceOn] = useState(false);
  const [traceClosed, setTraceClosed] = useState(false);
  const [tracePoints, setTracePoints] = useState<Array<{ x: number; y: number }>>([]);

  const ensureCanvases = useCallback(() => {
    if (!originalCanvasRef.current) originalCanvasRef.current = document.createElement("canvas");
    if (!baseCutoutCanvasRef.current) baseCutoutCanvasRef.current = document.createElement("canvas");
    if (!editCutoutCanvasRef.current) editCutoutCanvasRef.current = document.createElement("canvas");
  }, []);

  const clearAllCanvases = useCallback(() => {
    ensureCanvases();
    for (const c of [originalCanvasRef.current!, baseCutoutCanvasRef.current!, editCutoutCanvasRef.current!]) {
      c.width = 1;
      c.height = 1;
      c.getContext("2d")?.clearRect(0, 0, 1, 1);
    }
  }, [ensureCanvases]);

  const renderViewport = useCallback(async () => {
    const wrap = viewportWrapRef.current;
    const canvas = viewportCanvasRef.current;
    if (!wrap || !canvas) return;

    ensureCanvases();
    const oc = originalCanvasRef.current!;
    const bc = baseCutoutCanvasRef.current!;

    const rect = wrap.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const vw = Math.max(1, Math.floor(rect.width));
    const vh = Math.max(1, Math.floor(rect.height));

    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    if (!hasImage) return;

    const imgW = oc.width;
    const imgH = oc.height;

    const baseScale = Math.min(vw / imgW, vh / imgH);
    const scale = baseScale * zoom;

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const pan = panRef.current;
    const dx = (vw - drawW) / 2 + pan.x;
    const dy = (vh - drawH) / 2 + pan.y;

    // background underlay
    if (bgMode === "color") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, vw, vh);
    } else if (bgMode === "blur") {
      ctx.save();
      ctx.filter = `blur(${clamp(blurPx, 0, 60)}px)`;
      ctx.drawImage(oc, dx, dy, drawW, drawH);
      ctx.restore();
    } else if (bgMode === "image") {
      if (bgImageUrl) {
        const img = new Image();
        img.src = bgImageUrl;
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;
        const s = Math.max(vw / iw, vh / ih);
        const w = iw * s;
        const h = ih * s;
        const x = (vw - w) / 2;
        const y = (vh - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      } else {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    // draw main image (original or cutout)
    if (hasCutout) ctx.drawImage(bc, dx, dy, drawW, drawH);
    else ctx.drawImage(oc, dx, dy, drawW, drawH);

    // trace overlay
    if (tracePoints.length > 0) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(239,68,68,0.95)";
      ctx.fillStyle = "rgba(239,68,68,0.12)";

      const toView = (p: { x: number; y: number }) => ({ x: dx + p.x * scale, y: dy + p.y * scale });

      ctx.beginPath();
      const p0 = toView(tracePoints[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < tracePoints.length; i++) {
        const pi = toView(tracePoints[i]);
        ctx.lineTo(pi.x, pi.y);
      }
      if (traceClosed) ctx.closePath();

      if (traceClosed) ctx.fill();
      ctx.stroke();

      for (let i = 0; i < tracePoints.length; i++) {
        const p = toView(tracePoints[i]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239,68,68,0.9)";
        ctx.fill();
      }

      if (tracePoints.length >= 3 && !traceClosed) {
        const spt = toView(tracePoints[0]);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(spt.x + 10, spt.y - 22, 160, 18);
        ctx.fillStyle = "white";
        ctx.font = "12px system-ui";
        ctx.fillText("Click start point to close", spt.x + 14, spt.y - 9);
      }

      ctx.restore();
    }
  }, [bgColor, bgImageUrl, bgMode, blurPx, ensureCanvases, hasCutout, hasImage, traceClosed, tracePoints, zoom]);

  const onPickFile = useCallback(() => fileInputRef.current?.click(), []);
  const onPickBg = useCallback(() => bgInputRef.current?.click(), []);

  const removeImage = useCallback(() => {
    setBusy(false);
    setOriginalFile(null);
    setHasImage(false);
    setHasCutout(false);

    setTraceOn(false);
    setTraceClosed(false);
    setTracePoints([]);

    setBgMode("transparent");
    setBgColor("#ffffff");
    setBlurPx(14);
    if (bgImageUrl) URL.revokeObjectURL(bgImageUrl);
    setBgImageUrl(null);

    setPanMode(false);
    setZoom(1);
    panRef.current = { x: 0, y: 0 };

    clearAllCanvases();
    requestAnimationFrame(() => renderViewport());
  }, [bgImageUrl, clearAllCanvases, renderViewport]);

  const resetImage = useCallback(() => {
    if (!hasImage) return;

    ensureCanvases();
    const oc = originalCanvasRef.current!;
    const bc = baseCutoutCanvasRef.current!;
    const ec = editCutoutCanvasRef.current!;
    const w = oc.width;
    const h = oc.height;

    bc.getContext("2d")!.clearRect(0, 0, w, h);
    ec.getContext("2d")!.clearRect(0, 0, w, h);
    setHasCutout(false);

    setTraceOn(false);
    setTraceClosed(false);
    setTracePoints([]);

    setPanMode(false);
    setZoom(1);
    panRef.current = { x: 0, y: 0 };

    requestAnimationFrame(() => renderViewport());
  }, [ensureCanvases, hasImage, renderViewport]);

  const loadOriginalFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      setBusy(true);
      try {
        ensureCanvases();

        const bmp = await fileToBitmap(file);
        const w = bmp.width;
        const h = bmp.height;

        const oc = originalCanvasRef.current!;
        oc.width = w;
        oc.height = h;
        oc.getContext("2d")!.clearRect(0, 0, w, h);
        oc.getContext("2d")!.drawImage(bmp, 0, 0);

        const bc = baseCutoutCanvasRef.current!;
        bc.width = w;
        bc.height = h;
        bc.getContext("2d")!.clearRect(0, 0, w, h);

        const ec = editCutoutCanvasRef.current!;
        ec.width = w;
        ec.height = h;
        ec.getContext("2d")!.clearRect(0, 0, w, h);

        setOriginalFile(file);
        setHasImage(true);
        setHasCutout(false);

        setZoom(1);
        panRef.current = { x: 0, y: 0 };
        setPanMode(false);

        setTraceOn(false);
        setTraceClosed(false);
        setTracePoints([]);

        requestAnimationFrame(() => renderViewport());
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [ensureCanvases, renderViewport]
  );

  const onFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.currentTarget;
      const f = inputEl.files?.[0] ?? null;
      inputEl.value = "";
      if (!f) return;
      await loadOriginalFile(f);
    },
    [loadOriginalFile]
  );

  const onBgInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.currentTarget;
      const f = inputEl.files?.[0] ?? null;
      inputEl.value = "";
      if (!f) return;

      if (bgImageUrl) URL.revokeObjectURL(bgImageUrl);
      const url = URL.createObjectURL(f);
      setBgImageUrl(url);
      setBgMode("image");
      requestAnimationFrame(() => renderViewport());
    },
    [bgImageUrl, renderViewport]
  );

  // paste upload
  useEffect(() => {
    const onPaste = async (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            await loadOriginalFile(f);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadOriginalFile]);

  // drag-drop upload
  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files?.[0];
      if (f) await loadOriginalFile(f);
    },
    [loadOriginalFile]
  );

  // AI remove background
  const removeBackgroundAI = useCallback(async () => {
    if (!originalFile) return;

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", originalFile);

      const res = await fetch("/api/remove-bg", { method: "POST", body: form });
      if (!res.ok) {
        console.error("Remove bg failed:", res.status, await res.text().catch(() => ""));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const bmp = await urlToBitmap(url);
      URL.revokeObjectURL(url);

      ensureCanvases();
      const bc = baseCutoutCanvasRef.current!;
      const ec = editCutoutCanvasRef.current!;
      bc.getContext("2d")!.clearRect(0, 0, bc.width, bc.height);
      ec.getContext("2d")!.clearRect(0, 0, ec.width, ec.height);

      bc.getContext("2d")!.drawImage(bmp, 0, 0, bc.width, bc.height);
      ec.getContext("2d")!.drawImage(bmp, 0, 0, ec.width, ec.height);

      setHasCutout(true);
      requestAnimationFrame(() => renderViewport());
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [ensureCanvases, originalFile, renderViewport]);

  const viewportToImageXY = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = viewportWrapRef.current;
      if (!wrap) return null;

      ensureCanvases();
      const oc = originalCanvasRef.current!;
      if (!hasImage) return null;

      const rect = wrap.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;

      const imgW = oc.width;
      const imgH = oc.height;

      const baseScale = Math.min(vw / imgW, vh / imgH);
      const scale = baseScale * zoom;

      const drawW = imgW * scale;
      const drawH = imgH * scale;

      const pan = panRef.current;
      const dx = (vw - drawW) / 2 + pan.x;
      const dy = (vh - drawH) / 2 + pan.y;

      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const ix = (mx - dx) / scale;
      const iy = (my - dy) / scale;

      if (ix < 0 || iy < 0 || ix > imgW || iy > imgH) return null;
      return { x: ix, y: iy };
    },
    [ensureCanvases, hasImage, zoom]
  );

  const clearTrace = useCallback(() => {
    setTraceClosed(false);
    setTracePoints([]);
    requestAnimationFrame(() => renderViewport());
  }, [renderViewport]);

  const closeTrace = useCallback(() => {
    if (tracePoints.length >= 3) setTraceClosed(true);
  }, [tracePoints.length]);

  const applyTraceKeepInside = useCallback(() => {
    if (tracePoints.length < 3 || !traceClosed) return;

    ensureCanvases();
    const oc = originalCanvasRef.current!;
    const bc = baseCutoutCanvasRef.current!;
    const ec = editCutoutCanvasRef.current!;
    const w = oc.width;
    const h = oc.height;

    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    mctx.clearRect(0, 0, w, h);

    mctx.fillStyle = "rgba(255,255,255,1)";
    mctx.beginPath();
    mctx.moveTo(tracePoints[0].x, tracePoints[0].y);
    for (let i = 1; i < tracePoints.length; i++) mctx.lineTo(tracePoints[i].x, tracePoints[i].y);
    mctx.closePath();
    mctx.fill();

    ec.getContext("2d")!.clearRect(0, 0, w, h);

    if (hasCutout) {
      ec.getContext("2d")!.drawImage(bc, 0, 0);
      const ectx = ec.getContext("2d")!;
      ectx.globalCompositeOperation = "destination-in";
      ectx.drawImage(mask, 0, 0);
      ectx.globalCompositeOperation = "source-over";
    } else {
      ec.getContext("2d")!.drawImage(oc, 0, 0);
      const ectx = ec.getContext("2d")!;
      ectx.globalCompositeOperation = "destination-in";
      ectx.drawImage(mask, 0, 0);
      ectx.globalCompositeOperation = "source-over";

      bc.getContext("2d")!.clearRect(0, 0, w, h);
      bc.getContext("2d")!.drawImage(ec, 0, 0);
      setHasCutout(true);
    }

    bc.getContext("2d")!.clearRect(0, 0, w, h);
    bc.getContext("2d")!.drawImage(ec, 0, 0);

    setTraceOn(false);
    setTraceClosed(false);
    setTracePoints([]);

    requestAnimationFrame(() => renderViewport());
  }, [ensureCanvases, hasCutout, renderViewport, traceClosed, tracePoints]);

  useEffect(() => {
    requestAnimationFrame(() => renderViewport());
  }, [renderViewport]);

  useEffect(() => {
    const el = viewportWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(() => renderViewport()));
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderViewport]);

  // pointer handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!hasImage) return;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      if (traceOn) {
        const p = viewportToImageXY(e.clientX, e.clientY);
        if (!p) return;

        if (tracePoints.length >= 3 && !traceClosed) {
          const s = tracePoints[0];
          const dist = Math.hypot(p.x - s.x, p.y - s.y);
          if (dist <= 12) {
            setTraceClosed(true);
            requestAnimationFrame(() => renderViewport());
            return;
          }
        }

        if (!traceClosed) {
          setTracePoints((prev) => [...prev, { x: p.x, y: p.y }]);
          requestAnimationFrame(() => renderViewport());
        }
        return;
      }

      if (panMode) {
        draggingRef.current = true;
        lastClientRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [hasImage, panMode, renderViewport, traceClosed, traceOn, tracePoints, viewportToImageXY]
  );
	  const applyTraceClearInside = useCallback(() => {
    if (tracePoints.length < 3 || !traceClosed) return;

    ensureCanvases();
    const oc = originalCanvasRef.current!;
    const bc = baseCutoutCanvasRef.current!;
    const ec = editCutoutCanvasRef.current!;
    const w = oc.width;
    const h = oc.height;

    // mask canvas (white polygon)
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    mctx.clearRect(0, 0, w, h);

    mctx.fillStyle = "rgba(255,255,255,1)";
    mctx.beginPath();
    mctx.moveTo(tracePoints[0].x, tracePoints[0].y);
    for (let i = 1; i < tracePoints.length; i++) mctx.lineTo(tracePoints[i].x, tracePoints[i].y);
    mctx.closePath();
    mctx.fill();

    // Clear inside polygon => remove that area from the image
    ec.getContext("2d")!.clearRect(0, 0, w, h);

    if (hasCutout) {
      // start from base cutout and punch a hole inside polygon
      ec.getContext("2d")!.drawImage(bc, 0, 0);
      const ectx = ec.getContext("2d")!;
      ectx.globalCompositeOperation = "destination-out";
      ectx.drawImage(mask, 0, 0);
      ectx.globalCompositeOperation = "source-over";
    } else {
      // start from original and punch a hole inside polygon
      ec.getContext("2d")!.drawImage(oc, 0, 0);
      const ectx = ec.getContext("2d")!;
      ectx.globalCompositeOperation = "destination-out";
      ectx.drawImage(mask, 0, 0);
      ectx.globalCompositeOperation = "source-over";
      setHasCutout(true);
    }

    // keep base in sync so export matches
    bc.getContext("2d")!.clearRect(0, 0, w, h);
    bc.getContext("2d")!.drawImage(ec, 0, 0);

    // clear overlay + exit trace
    setTraceOn(false);
    setTraceClosed(false);
    setTracePoints([]);

    requestAnimationFrame(() => renderViewport());
  }, [ensureCanvases, hasCutout, renderViewport, traceClosed, tracePoints]);
	
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!hasImage) return;

      if (panMode && draggingRef.current) {
        const lp = lastClientRef.current;
        const dx = e.clientX - lp.x;
        const dy = e.clientY - lp.y;
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
        lastClientRef.current = { x: e.clientX, y: e.clientY };
        requestAnimationFrame(() => renderViewport());
      }
    },
    [hasImage, panMode, renderViewport]
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (traceOn && tracePoints.length >= 3) setTraceClosed(true);
  }, [traceOn, tracePoints.length]);

  // view controls
  const fitView = useCallback(() => {
    setZoom(1);
    panRef.current = { x: 0, y: 0 };
    requestAnimationFrame(() => renderViewport());
  }, [renderViewport]);

  const zoomIn = useCallback(() => {
    setZoom((z) => clamp(Number((z * 1.15).toFixed(3)), 1, 6));
    requestAnimationFrame(() => renderViewport());
  }, [renderViewport]);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const nz = clamp(Number((z / 1.15).toFixed(3)), 1, 6);
      if (nz === 1) panRef.current = { x: 0, y: 0 };
      return nz;
    });
    requestAnimationFrame(() => renderViewport());
  }, [renderViewport]);

  // download at ORIGINAL resolution
  const downloadPNG = useCallback(async () => {
    if (!hasImage) return;

    ensureCanvases();
    const oc = originalCanvasRef.current!;
    const bc = baseCutoutCanvasRef.current!;
    const w = oc.width;
    const h = oc.height;

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    if (bgMode === "color") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    } else if (bgMode === "blur") {
      ctx.save();
      ctx.filter = `blur(${clamp(blurPx, 0, 60)}px)`;
      ctx.drawImage(oc, 0, 0);
      ctx.restore();
    } else if (bgMode === "image") {
      if (bgImageUrl) {
        const bmp = await urlToBitmap(bgImageUrl);
        const iw = bmp.width;
        const ih = bmp.height;
        const s = Math.max(w / iw, h / ih);
        const dw = iw * s;
        const dh = ih * s;
        const x = (w - dw) / 2;
        const y = (h - dh) / 2;
        ctx.drawImage(bmp, x, y, dw, dh);
      } else {
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (hasCutout) ctx.drawImage(bc, 0, 0);
    else ctx.drawImage(oc, 0, 0);

    out.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, "clearcut.png");
    }, "image/png");
  }, [bgColor, bgImageUrl, bgMode, blurPx, ensureCanvases, hasCutout, hasImage]);

  const editorHint = useMemo(() => {
    if (!hasImage) return "Drag & drop, paste (Ctrl+V), or click Upload.";
    if (!hasCutout) return "Run Remove background (AI) OR use Manual trace to keep only a selected area.";
    return "Adjust background then export.";
  }, [hasCutout, hasImage]);

  const EditorCanvas = (
    <div
      ref={viewportWrapRef}
      className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[radial-gradient(70%_60%_at_50%_35%,rgba(255,255,255,0.06),rgba(255,255,255,0)_70%)]"
      // BIGGER editor by default
      style={{ height: fullscreen ? "80vh" : 760 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={onDrop}
    >
      <canvas
        ref={viewportCanvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />

      {!hasImage && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 backdrop-blur">
            <div className="text-base font-semibold text-white">Upload an image</div>
            <div className="mt-1 text-sm text-neutral-400">{editorHint}</div>
            <button
              type="button"
              onClick={onPickFile}
              className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-neutral-200"
            >
              Upload image
            </button>
            <div className="mt-2 text-xs text-neutral-500">Tip: JPG/PNG/WebP work best.</div>
          </div>
        </div>
      )}

      {hasImage && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-neutral-300 backdrop-blur">
          {traceOn
            ? traceClosed
              ? "Trace closed. Click Apply trace to keep inside."
              : "Trace mode: click points around what to keep. Double-click to close."
            : panMode
            ? "Pan mode: drag to move view."
            : "Tip: Turn on Trace or Pan to edit."}
        </div>
      )}
    </div>
  );

  // --- Ads (same as before)
  const LeftAd = (
    <div className="hidden xl:block">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="text-xs font-semibold tracking-wide text-neutral-500">SPONSORED</div>
        <div className="mt-3 h-[760px] rounded-xl border border-neutral-800 bg-neutral-950/40" />
        <div className="mt-2 text-xs text-neutral-600">Ad slot</div>
      </div>
    </div>
  );

  const RightAd = (
    <div className="hidden xl:block">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="text-xs font-semibold tracking-wide text-neutral-500">SPONSORED</div>
        <div className="mt-3 h-[760px] rounded-xl border border-neutral-800 bg-neutral-950/40" />
        <div className="mt-2 text-xs text-neutral-600">Ad slot</div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* subtle glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,255,255,0.08),rgba(255,255,255,0)_70%)]" />

      {/* HERO (removed the redundant two buttons you X’d out) */}
      <div className="relative mx-auto mb-10 w-full max-w-3xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-xs text-neutral-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Free tool • No signup
        </div>

        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Remove backgrounds <span className="text-neutral-300">fast, clean, and sharp.</span>
        </h1>

        <p className="mt-3 text-sm text-neutral-400">
          Upload, paste (Ctrl+V), or drag & drop. Use AI for best edges, or Manual trace for “keep this area only.”
          Export a high-quality PNG at original resolution.
        </p>

        <div className="mt-3 text-xs text-neutral-500">Tip: You can also paste with Ctrl+V.</div>
      </div>

      {/* LAYOUT: BIG EDITOR + TOOLS UNDER IT */}
      <div
        className="
          grid grid-cols-1 gap-6
          xl:grid-cols-[minmax(240px,1fr)_minmax(0,980px)_minmax(240px,1fr)]
          2xl:grid-cols-[minmax(260px,1fr)_minmax(0,1100px)_minmax(260px,1fr)]
        "
      >
        {LeftAd}

        {/* Main column (Editor then Tools BELOW) */}
        <div className="space-y-6">
          {/* Editor card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">Editor</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                  onClick={() => setFullscreen(true)}
                  disabled={!hasImage}
                >
                  Full screen
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                  onClick={resetImage}
                  disabled={!hasImage || busy}
                >
                  Reset image
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                  onClick={removeImage}
                  disabled={!hasImage || busy}
                >
                  Remove image
                </button>
              </div>
            </div>

            {EditorCanvas}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileInputChange} />
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={onBgInputChange} />

            <div className="mt-3 text-xs text-neutral-500">{editorHint}</div>
          </div>

          {/* Tools card (UNDER editor now) */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Tools</div>
              <button
                type="button"
                className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                onClick={() => {
                  setBgMode("transparent");
                  setBgColor("#ffffff");
                  setBlurPx(14);
                  if (bgImageUrl) URL.revokeObjectURL(bgImageUrl);
                  setBgImageUrl(null);

                  setPanMode(false);
                  setZoom(1);
                  panRef.current = { x: 0, y: 0 };

                  setTraceOn(false);
                  setTraceClosed(false);
                  setTracePoints([]);

                  requestAnimationFrame(() => renderViewport());
                }}
                disabled={!hasImage}
              >
                Reset tools
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
                onClick={removeBackgroundAI}
                disabled={!hasImage || busy}
              >
                {busy ? "Working…" : "Remove background (AI)"}
              </button>

              <button
                type="button"
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
                onClick={downloadPNG}
                disabled={!hasImage || busy}
              >
                Download PNG
              </button>
            </div>

            {/* View + Trace + Background in a clean 3-column on wide screens */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* View */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">View</div>
                  <div className="text-xs text-neutral-400">{Math.round(zoom * 100)}%</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      panMode
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={() => {
                      setPanMode((v) => !v);
                      setTraceOn(false);
                    }}
                    disabled={!hasImage}
                  >
                    Pan mode
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                    onClick={fitView}
                    disabled={!hasImage}
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                    onClick={zoomOut}
                    disabled={!hasImage}
                  >
                    Zoom −
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                    onClick={zoomIn}
                    disabled={!hasImage}
                  >
                    Zoom +
                  </button>
                </div>
                <div className="mt-2 text-xs text-neutral-500">Tip: Turn on Pan mode to drag.</div>
              </div>

              {/* Manual Trace */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Manual trace</div>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-1.5 text-sm ${
                      traceOn
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={() => {
                      setTraceOn((v) => !v);
                      setPanMode(false);
                    }}
                    disabled={!hasImage}
                  >
                    {traceOn ? "On" : "Off"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                    onClick={clearTrace}
                    disabled={!traceOn || tracePoints.length === 0}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                    onClick={closeTrace}
                    disabled={!traceOn || tracePoints.length < 3 || traceClosed}
                  >
                    Close shape
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
  		<button
    		type="button"
    		className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
    		onClick={applyTraceKeepInside}
    		disabled={tracePoints.length < 3 || !traceClosed}
  		>
   		 Keep inside
  		</button>

  		<button
   		 type="button"
    		className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-50 disabled:opacity-50"
    		onClick={applyTraceClearInside}  // <-- make sure this function exists
   		 disabled={tracePoints.length < 3 || !traceClosed}
  		>
   		 Clear inside
  		</button>
		</div>


                <div className="mt-2 text-xs text-neutral-500">
                  Click points around what you want to keep. Double-click or “Close shape”, then Apply.
                </div>
              </div>

              {/* Background */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="text-xs font-semibold tracking-wide text-neutral-500">BACKGROUND</div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      bgMode === "transparent"
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={() => setBgMode("transparent")}
                    disabled={!hasImage}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      bgMode === "color"
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={() => setBgMode("color")}
                    disabled={!hasImage}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      bgMode === "blur"
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={() => setBgMode("blur")}
                    disabled={!hasImage}
                  >
                    Blur original
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      bgMode === "image"
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:bg-neutral-900"
                    }`}
                    onClick={onPickBg}
                    disabled={!hasImage}
                  >
                    Add bg image
                  </button>
                </div>

                {bgMode === "color" && hasImage && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="text-sm text-neutral-200">Background color</div>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                )}

                {bgMode === "blur" && hasImage && (
                  <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-neutral-200">Blur amount</div>
                      <div className="text-xs text-neutral-400">{blurPx}px</div>
                    </div>
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={0}
                      max={40}
                      value={blurPx}
                      onChange={(e) => setBlurPx(parseInt(e.target.value, 10))}
                    />
                  </div>
                )}

                <div className="mt-3 text-xs text-neutral-500">Tip: Ads should stay in the side slots.</div>
              </div>
            </div>
          </div>
        </div>

        {RightAd}
      </div>

      {/* Fullscreen */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-[1400px] rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Full screen editor</div>
              <button
                type="button"
                className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
                onClick={() => setFullscreen(false)}
              >
                Close
              </button>
            </div>
            {EditorCanvas}
            <div className="mt-3 text-xs text-neutral-500">{editorHint}</div>
          </div>
        </div>
      )}
    </div>
  );
}
