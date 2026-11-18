import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './PdfCanvasPreview.css';

// The real report PDF drawn with pdf.js, with the server's layout zones laid
// over it: hover outlines a part, click opens its settings, an image dropped
// on an image part replaces it, and on the pad print the top and bottom gap
// lines can be dragged.

let pdfjsPromise;
const loadPdfjs = () => {
  pdfjsPromise ||= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    .then(([lib, worker]) => { lib.GlobalWorkerOptions.workerSrc = worker.default; return lib; });
  return pdfjsPromise;
};

export const CM = 28.35; // points per centimetre
export const toCm = (pt) => (Number(pt) / CM).toFixed(1);
const snapPt = (pt) => Math.round(Math.round(pt / CM * 10) / 10 * CM);
// Prefer the most specific part under the pointer; the watermark sits behind
// the results, so it only wins for dropped images.
const weight = (zone, dropping) => zone.w * zone.h * (!dropping && zone.kind === 'watermark' ? 8 : 1);

function zoneAt(zones, page, x, y, accept, dropping) {
  return zones
    .filter((z) => z.page === page && accept(z.kind) && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)
    .sort((a, b) => weight(a, dropping) - weight(b, dropping))[0] || null;
}

function GapLine({ which, valuePt, minPt, maxPt, scale, pageHeight, onChange, hint }) {
  const [dragPt, setDragPt] = useState(null);
  const shown = dragPt ?? valuePt;
  const y = which === 'top' ? shown : pageHeight - shown;
  const label = which === 'top' ? 'Report starts here' : 'Report ends here';
  const fromPointer = (e) => {
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const ptY = (e.clientY - rect.top) / scale;
    const raw = which === 'top' ? ptY : pageHeight - ptY;
    return Math.min(maxPt, Math.max(minPt, snapPt(raw)));
  };
  return (
    <div className={`pcp-gap pcp-gap-${which}${dragPt !== null ? ' is-dragging' : ''}`} style={{ top: y * scale }}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDragPt(fromPointer(e)); }}
      onPointerMove={(e) => { if (dragPt !== null) setDragPt(fromPointer(e)); }}
      onPointerUp={(e) => { if (dragPt === null) return; const v = fromPointer(e); setDragPt(null); if (v !== valuePt) onChange(v); }}
      onClick={(e) => e.stopPropagation()}
      role="slider" aria-label={which === 'top' ? 'Top gap on the pad' : 'Bottom gap on the pad'}
      aria-valuemin={Number(toCm(minPt))} aria-valuemax={Number(toCm(maxPt))} aria-valuenow={Number(toCm(shown))} aria-valuetext={`${toCm(shown)} cm`} tabIndex={0}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (!step) return;
        e.preventDefault();
        const delta = (which === 'top' ? step : -step) * CM / 10;
        onChange(Math.min(maxPt, Math.max(minPt, snapPt(valuePt + delta))));
      }}>
      <span className="pcp-gap-label">{label} · {toCm(shown)} cm <em>drag to move</em></span>
      {hint && dragPt === null && <span className="pcp-gap-hint" onPointerDown={(e) => e.stopPropagation()}>{hint}</span>}
    </div>
  );
}

export default function PdfCanvasPreview({
  blob, layout, busy, emptyText, labelFor, dropKinds = [], onDropImage, renderPopover, gaps
}) {
  const scroller = useRef(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState([]);
  const [renderError, setRenderError] = useState('');
  const [hover, setHover] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [open, setOpen] = useState(null); // { kind, page }
  const popoverRef = useRef(null);
  const zones = layout?.zones || [];

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, Math.floor(el.clientWidth - 24))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw every page at the column width, crisp on high-density screens.
  useEffect(() => {
    if (!blob || !width) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const lib = await loadPdfjs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const out = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const png = await new Promise((resolve) => canvas.toBlob(resolve));
          out.push({ url: URL.createObjectURL(png), w: base.width, h: base.height });
        }
        pdf.destroy();
        if (cancelled) { out.forEach((p) => URL.revokeObjectURL(p.url)); return; }
        setPages((old) => { old.forEach((p) => URL.revokeObjectURL(p.url)); return out; });
        setRenderError('');
      } catch (error) {
        if (!cancelled) setRenderError('The preview could not be drawn. Use Open PDF to see it.');
      }
    }, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [blob, width]);
  useEffect(() => () => setPages((old) => { old.forEach((p) => URL.revokeObjectURL(p.url)); return []; }), []);

  // Escape or a click elsewhere closes the settings popover.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    const onDown = (e) => {
      if (popoverRef.current?.contains(e.target) || e.target.closest?.('.pcp-overlay') || e.target.closest?.('.modal, [role="dialog"]')) return;
      setOpen(null);
    };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  // Bring an opened popover into view inside the scrolling preview.
  useEffect(() => {
    if (open) requestAnimationFrame(() => popoverRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [open]);

  const pointPt = (e, page, scale) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale, page];
  };
  const interactive = (kind) => Boolean(labelFor(kind));
  const droppable = (kind) => dropKinds.includes(kind);

  return (
    <div className={`pcp${busy ? ' is-busy' : ''}`} ref={scroller}>
      {busy && <div className="pcp-progress" aria-hidden="true" />}
      {!pages.length && <div className="pcp-empty">{renderError || emptyText}</div>}
      {pages.map((page, index) => {
        const scale = width / page.w;
        const cssH = page.h * scale;
        const rect = (z) => ({ left: z.x * scale, top: z.y * scale, width: z.w * scale, height: z.h * scale });
        const hovered = !dropTarget && hover?.page === index ? hover.zone : null;
        const dropped = dropTarget?.page === index ? dropTarget.zone : null;
        const openZone = open?.page === index ? zones.find((z) => z.page === index && z.kind === open.kind) : null;
        return (
          <div className="pcp-page" key={index} style={{ width, height: cssH }}>
            <img src={page.url} alt={index === 0 ? 'Report preview with sample data' : `Report preview page ${index + 1}`} width={width} height={cssH} draggable={false} />
            <div
              className={`pcp-overlay${hovered ? ' has-hover' : ''}`}
              onMouseMove={(e) => { const [x, y] = pointPt(e, index, scale); const z = zoneAt(zones, index, x, y, interactive, false); setHover(z ? { page: index, zone: z } : null); }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => { const [x, y] = pointPt(e, index, scale); const z = zoneAt(zones, index, x, y, interactive, false); setOpen(z ? { page: index, kind: z.kind } : null); }}
              onDragOver={(e) => {
                const [x, y] = pointPt(e, index, scale);
                const z = zoneAt(zones, index, x, y, droppable, true);
                if (!z) { if (dropTarget) setDropTarget(null); return; }
                e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
                if (dropTarget?.zone !== z) setDropTarget({ page: index, zone: z });
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const [x, y] = pointPt(e, index, scale);
                const target = zoneAt(zones, index, x, y, droppable, true);
                const file = e.dataTransfer.files?.[0];
                if (target && file) onDropImage(target.kind, file);
              }}
            >
              {hovered && (
                <div className={`pcp-zone is-hover${rect(hovered).top < 22 ? ' is-inside' : ''}`} style={rect(hovered)}>
                  <span className="pcp-zone-label">{labelFor(hovered.kind)}</span>
                </div>
              )}
              {dropped && (
                <div className="pcp-zone is-drop" style={rect(dropped)}>
                  <span className="pcp-zone-drop">Drop to replace the {labelFor(dropped.kind, true)}</span>
                </div>
              )}
              {openZone && !hovered && <div className="pcp-zone is-open" style={rect(openZone)} />}
              {gaps && index === 0 && (
                <>
                  <GapLine which="top" valuePt={gaps.top} minPt={gaps.minTop} maxPt={gaps.maxTop} scale={scale} pageHeight={page.h} onChange={(v) => gaps.onChange('top', v)} hint={gaps.topHint} />
                  <GapLine which="bottom" valuePt={gaps.bottom} minPt={gaps.minBottom} maxPt={gaps.maxBottom} scale={scale} pageHeight={page.h} onChange={(v) => gaps.onChange('bottom', v)} />
                </>
              )}
            </div>
            {openZone && (() => {
              const r = rect(openZone);
              // Below the part if it fits, else above it, else over its top edge.
              const tall = 400;
              const left = Math.max(8, Math.min(r.left, width - Math.min(340, width - 16) - 8));
              const style = r.top + r.height + 6 + tall <= cssH ? { left, top: r.top + r.height + 6 }
                : r.top - 6 - tall >= 0 ? { left, bottom: cssH - r.top + 6 }
                  : { left, top: Math.max(8, Math.min(r.top + 8, cssH - tall)) };
              return (
                <div className="pcp-popover" ref={popoverRef} style={style} role="dialog" aria-label={`${labelFor(openZone.kind, true)} settings`}>
                  <div className="pcp-popover-head">
                    <strong>{labelFor(openZone.kind, true)}</strong>
                    <button type="button" className="pcp-popover-close" aria-label="Close" onClick={() => setOpen(null)}><X size={16} /></button>
                  </div>
                  <div className="pcp-popover-body">{renderPopover(openZone.kind)}</div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
