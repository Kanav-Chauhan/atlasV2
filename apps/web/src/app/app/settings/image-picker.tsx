"use client";

import { useEffect, useRef, useState } from "react";

// Choose a picture, frame it, get a small square image back.
// "cover": drag + zoom inside a round guide (profile pictures; the square around it is kept).
// "contain": the whole image fits the square, nothing is cut (company logos).
// The browser draws the result on a 512 px canvas (WebP, PNG where WebP can't be encoded), so a big
// phone photo becomes a ~30 KB upload; the server checks it again and stores a 256 px copy.

const VIEW = 240;
const OUT = 512;
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_PICK_MB = 10;

export function pickError(file: File): string | null {
  if (!TYPES.includes(file.type)) return "Choose a PNG, JPEG or WebP picture.";
  if (file.size > MAX_PICK_MB * 1024 * 1024) return `Choose a picture under ${MAX_PICK_MB} MB.`;
  return null;
}

const openModal = (d: HTMLDialogElement | null) => { if (d && !d.open) d.showModal(); };

export function ImagePicker({ file, mode, title, onCancel, onDone }: {
  file: File; mode: "cover" | "contain"; title: string;
  onCancel: () => void; onDone: (blob: Blob, name: string) => Promise<void>;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      if (im.naturalWidth < 16 || im.naturalHeight < 16) setErr("This picture is too small (16 pixels at least).");
      else {
        const b0 = (mode === "cover" ? Math.max : Math.min)(VIEW / im.naturalWidth, VIEW / im.naturalHeight);
        setPos({ x: (VIEW - im.naturalWidth * b0) / 2, y: (VIEW - im.naturalHeight * b0) / 2 }); // centred
        setImg(im);
      }
    };
    im.onerror = () => setErr("This picture could not be opened. Try a PNG or JPEG.");
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);

  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  const base = mode === "cover" ? Math.max(VIEW / w, VIEW / h) : Math.min(VIEW / w, VIEW / h);
  const scale = base * (mode === "cover" ? zoom : 1);
  const dw = w * scale;
  const dh = h * scale;
  const clamp = (x: number, y: number) =>
    mode === "cover"
      ? { x: Math.min(0, Math.max(VIEW - dw, x)), y: Math.min(0, Math.max(VIEW - dh, y)) }
      : { x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 };
  // Keep the picture covering the frame (cover) or centred (contain).
  const at = img ? clamp(pos.x, pos.y) : { x: 0, y: 0 };

  function setZoomCentred(z: number) {
    const cx = (VIEW / 2 - at.x) / scale;
    const cy = (VIEW / 2 - at.y) / scale;
    const s2 = base * z;
    setZoom(z);
    setPos({ x: VIEW / 2 - cx * s2, y: VIEW / 2 - cy * s2 });
  }

  function onKey(e: React.KeyboardEvent) {
    if (mode !== "cover") return;
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (m) { e.preventDefault(); setPos(clamp(at.x + m[0], at.y + m[1])); }
    if (e.key === "+" || e.key === "=") setZoomCentred(Math.min(4, zoom + 0.1));
    if (e.key === "-") setZoomCentred(Math.max(1, zoom - 0.1));
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setErr("");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setErr("Your browser can't prepare the picture."); setBusy(false); return; }
    ctx.imageSmoothingQuality = "high";
    const k = OUT / VIEW;
    ctx.drawImage(img, at.x * k, at.y * k, dw * k, dh * k);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    if (!blob) { setErr("Your browser can't prepare the picture."); setBusy(false); return; }
    try {
      await onDone(blob, blob.type === "image/webp" ? "picture.webp" : "picture.png");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={openModal} className="dialog picker" aria-labelledby="pick-title" onClose={onCancel}>
      <div className="grid gap-4">
        <h2 id="pick-title" className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">
          {mode === "cover" ? "Drag to move the picture, use the slider to zoom. Arrow keys work too." : "The whole logo is kept. A square or round logo looks best."}
        </p>
        <div
          className="picker-view" data-mode={mode} tabIndex={mode === "cover" ? 0 : -1} onKeyDown={onKey}
          role={mode === "cover" ? "application" : undefined} aria-label={mode === "cover" ? "Picture frame. Arrow keys move, plus and minus zoom." : undefined}
          onPointerDown={(e) => {
            if (mode !== "cover" || !img) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setPos(clamp(d.px + e.clientX - d.x, d.py + e.clientY - d.y));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview (object URL)
            <img src={img.src} alt="" draggable={false} style={{ width: dw, height: dh, transform: `translate(${at.x}px, ${at.y}px)` }} />
          )}
          {!img && !err && <span className="picker-wait">Opening</span>}
          {mode === "cover" && <span className="picker-ring" aria-hidden="true" />}
        </div>
        {mode === "cover" && (
          <label className="picker-zoom text-sm font-medium">
            Zoom
            <input type="range" min={1} max={4} step={0.01} value={zoom} disabled={!img} onChange={(e) => setZoomCentred(Number(e.target.value))} />
          </label>
        )}
        {err && <p className="text-sm text-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!img || busy}>{busy ? "Saving" : "Save picture"}</button>
        </div>
      </div>
    </dialog>
  );
}
