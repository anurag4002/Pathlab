import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Button, Input, LoadingSpinner, EmptyState, ConfirmDialog } from '../../components/common';
import { toast } from '../../components/common/Toast/toast';
import { getLabProfile, updateLabProfile, previewReportWithLayout } from '../../services/setupService';
import { SELECT_FORMAT_FIELDS, formatFieldKey, validateDocumentFormats } from '../../components/lab/documentFormatFields';
import LetterheadImages, { useLetterheadImageActions, imageForZone } from '../../components/lab/LetterheadImages';
import PdfCanvasPreview, { CM, toCm } from '../../components/lab/PdfCanvasPreview';
import './ReportTemplate.css';

// Report template: the real report (or bill) PDF, editable where it prints.
// Hover a part of the page to see what it is, click it for its settings, drop
// an image on the header, footer, signatures or watermark to replace it, and
// on the pad print drag the lines where the report starts and ends. The left
// panel lists every setting too. Settings preview live and are kept by
// "Save template"; images are saved as soon as they are uploaded.

const PREVIEW_DELAY_MS = 400;
// Paper the lab's pre-printed pad needs clear (same as the PDF renderer).
const PAD_TOP_MIN = 134;
const PAD_BOTTOM_MIN = 172;
const TOP_MAX = 480;
const MARGIN = [12, 54];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Where the report starts / stops on the pad print (formattedPdfService rules).
const padTop = (format, headerSpace) => {
  const m = Number(format.pageMargin) || 0;
  const space = Number(headerSpace);
  return Math.max(m, Number.isFinite(space) ? space : 90, m + (Number(format.headerHeight) || 0), PAD_TOP_MIN);
};
const padBottom = (format) => Math.max((Number(format.footerHeight) || 0) + 10 + (Number(format.pageMargin) || 0), PAD_BOTTOM_MIN);

// Report blocks stored on the lab profile: key, label, one-line meaning.
const TOGGLES = {
  showLetterheadByDefault: ['Letterhead on downloads', 'On: downloaded and printed reports carry the letterhead art. Off: they are for printing on the pre-printed pad.'],
  showWatermark: ['Watermark logo', 'Faded logo behind the results.'],
  showPageNumber: ['Page numbers', '"Page 1 of 2" at the bottom right.'],
  showFooterByDefault: ['Footer', 'Footer image at the bottom of the page.'],
  showQR: ['QR code', 'Scan-to-download code at the top right.'],
  showBarcode: ['Barcode', 'Barcode of the case number.'],
  showTatDates: ['Sample and report dates', 'Registered, Collected, Received and Reported lines.'],
  showReferredBy: ['Referred by', "The referring doctor's name."],
  showDepartmentHeading: ['Department heading', 'E.g. BIOCHEMISTRY above each section.'],
  showFlagColumn: ['High / low flags', 'H / L marks next to abnormal values.'],
  showInterpretation: ['Interpretation', 'Test notes under the table.'],
  showEndOfReport: ['End-of-report line', 'The line printed after the last result.'],
  printSignatures: ['Signatures', 'Sign-off signatures of whoever signed. Off by default: the pad footer already has printed signatures.']
};
const TOGGLE_KEYS = Object.keys(TOGGLES);
const OFF_BY_DEFAULT = new Set(['printSignatures']);
const pickToggles = (profile) => Object.fromEntries(TOGGLE_KEYS.map((key) => [key, profile?.[key] ?? !OFF_BY_DEFAULT.has(key)]));

const HELP = {
  name: 'Only to tell formats apart. Not printed.',
  sideMargin: 'White space at the left and right of the report.',
  topGap: 'When printing on the pre-printed pad, the report starts below this line so it does not print over the pad\'s header. Minimum 4.7 cm so the pad\'s header stays clear.',
  bottomGap: 'On the pad, the report stops above this line so it does not print over the pad\'s footer and signatures. Minimum 6.1 cm.',
  fontSize: 'Size of the result rows (test name, value, unit, range): 8 is small, 12 is large.',
  rowPadding: 'Space above and below each result row: 2 is tight, 8 is airy.',
  fontFamily: 'Font of all report text.',
  tableStyle: 'Outlined = boxed with a grey header row. Plain = no box. Banded = colored header and shaded alternate rows.',
  flagPlacement: 'Where H / L marks appear: before the value, or in the last column.',
  patientLayout: 'Three columns (name / barcode and dates / QR) or one below the other.',
  accentColor: 'Color of lines, table borders and the banded table header.',
  reportTitle: 'Printed above the results, e.g. LABORATORY REPORT. Leave empty for none.',
  billTitle: 'Printed at the top of bills, e.g. INVOICE.',
  endOfReportText: 'Line printed after the last result.',
  useReferenceBranding: "On: use the letterhead pad's header, logo and footer when you haven't uploaded your own. Off: print the lab name and address as text instead."
};
const LABELS = {
  name: 'Format name', sideMargin: 'Side margin', topGap: 'Top gap on the pad', bottomGap: 'Bottom gap on the pad',
  fontSize: 'Text size', rowPadding: 'Row spacing', accentColor: 'Accent color', reportTitle: 'Report title', billTitle: 'Bill title',
  endOfReportText: 'End of report text', useReferenceBranding: "Letterhead pad's images", images: 'New image',
  ...Object.fromEntries(SELECT_FORMAT_FIELDS.map(([k, l]) => [k, l])),
  ...Object.fromEntries(TOGGLE_KEYS.map((k) => [k, TOGGLES[k][0]]))
};

// Parts of the page: hover label, short name, settings shown when clicked.
const ZONES = {
  header: ['Letterhead header — drop an image or click to change', 'Letterhead header', ['img:letterhead', 'topGap', 'useReferenceBranding']],
  headerSpace: ['Top gap on the pad — drag the line or click', 'Top gap on the pad', ['fit', 'topGap']],
  watermark: ['Watermark — drop a logo or click to change', 'Watermark', ['img:logo', 'showWatermark']],
  patient: ['Patient details — click to change', 'Patient details', ['patientLayout', 'showReferredBy', 'showBarcode', 'showTatDates', 'showQR']],
  barcode: ['Barcode — click to change', 'Barcode', ['showBarcode', 'patientLayout']],
  dates: ['Sample and report dates — click to change', 'Dates', ['showTatDates', 'patientLayout']],
  qr: ['QR code — click to change', 'QR code', ['showQR', 'patientLayout']],
  results: ['Results — click to change text and table', 'Results', ['fontFamily', 'fontSize', 'rowPadding', 'tableStyle', 'flagPlacement', 'accentColor', 'title', 'showDepartmentHeading', 'showFlagColumn', 'showInterpretation', 'showEndOfReport', 'endOfReportText', 'sideMargin', 'showWatermark', 'img:logo']],
  footer: ['Footer — drop an image or click to change', 'Footer', ['img:footer', 'showFooterByDefault', 'bottomGap']],
  signatures: ['Signatures — drop an image or click to change', 'Signatures', ['img:signatures', 'printSignatures']],
  footerSpace: ['Bottom gap on the pad — drag the line or click', 'Bottom gap on the pad', ['fit', 'bottomGap']],
  pageNumber: ['Page number — click to change', 'Page number', ['showPageNumber']]
};

const errorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message || fallback; } catch { return fallback; }
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (error?.response?.status === 403) return 'Only an Admin can change the report template.';
  return error?.message && !error.response ? 'Could not reach the server. Check the connection and try again.' : fallback;
};
const same = (a, b) => String(a ?? '') === String(b ?? '');

// A centimetre field: live while the typed value is allowed, explains the limit otherwise.
function CmField({ id, label, value, min, max, minText, help, onCommit }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? toCm(value);
  const typed = Number(draft);
  const problem = draft !== null && (draft === '' || !Number.isFinite(typed) ? 'Enter a number of centimetres.'
    : typed * CM < min - 1 ? minText : typed * CM > max + 1 ? `At most ${toCm(max)} cm.` : '');
  return (
    <Input id={id} label={label} type="number" step="0.1" min={toCm(min)} max={toCm(max)} inputMode="decimal"
      value={shown} error={problem || undefined} helperText={help}
      onChange={(e) => {
        const text = e.target.value; setDraft(text);
        const cm = Number(text);
        if (text !== '' && Number.isFinite(cm) && cm * CM >= min - 1 && cm * CM <= max + 1) onCommit(clamp(Math.round(cm * CM), min, max));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export default function ReportTemplate() {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formats, setFormats] = useState([]);
  const [reportFormatId, setReportFormatId] = useState('');
  const [billFormatId, setBillFormatId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [toggles, setToggles] = useState({});
  const [headerSpace, setHeaderSpace] = useState(90);
  const [letterhead, setLetterhead] = useState(true);
  const [kind, setKind] = useState('report');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdf, setPdf] = useState({ blob: null, layout: null, url: '' });
  const [rendering, setRendering] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [imagesVersion, setImagesVersion] = useState(0);
  const [lastChange, setLastChange] = useState(null);
  const [padNote, setPadNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const requestSeq = useRef(0);
  const lastToast = useRef('');

  const reset = (data) => {
    const list = data.documentFormats?.length ? data.documentFormats : [];
    const has = (id) => id && list.some((f) => f.id === id);
    setFormats(list);
    const reportId = has(data.reportFormatId) ? data.reportFormatId : list[0]?.id || '';
    setReportFormatId(reportId);
    setBillFormatId(has(data.billFormatId) ? data.billFormatId : list[0]?.id || '');
    setSelectedId(reportId);
    setToggles(pickToggles(data));
    setHeaderSpace(data.letterheadTopMargin ?? 90);
    setDirty(false);
    setLastChange(null);
  };

  const load = async () => {
    setLoadError('');
    try {
      const response = await getLabProfile();
      const data = response?.data?.profile ?? response?.data;
      if (!data || typeof data !== 'object') throw new Error('The lab profile could not be loaded.');
      setProfile(data);
      setLetterhead(data.showLetterheadByDefault ?? true);
      reset(data);
    } catch (error) {
      setLoadError(await errorMessage(error, 'The lab profile could not be loaded.'));
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const images = useLetterheadImageActions((next, item) => {
    setProfile((current) => ({ ...current, ...next }));
    setImagesVersion((v) => v + 1);
    setLastChange({ key: 'images', label: `New ${item.title.toLowerCase()} image`, saved: true });
  });

  const selected = formats.find((f) => f.id === selectedId) || formats[0];
  const fieldErrors = useMemo(() => validateDocumentFormats(formats), [formats]);
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const padPrint = kind === 'report' && !letterhead;

  const topGap = selected ? padTop(selected, headerSpace) : PAD_TOP_MIN;
  const bottomGap = selected ? padBottom(selected) : PAD_BOTTOM_MIN;
  const margin = Number(selected?.pageMargin) || MARGIN[0];

  // Settings that differ from the saved template (the dots next to labels).
  const changedKeys = useMemo(() => {
    if (!profile || !selected) return new Set();
    const saved = (profile.documentFormats || []).find((f) => f.id === selected.id);
    const savedToggles = pickToggles(profile);
    const out = new Set(TOGGLE_KEYS.filter((k) => toggles[k] !== savedToggles[k]));
    if (!saved) return out;
    for (const k of ['name', 'fontSize', 'rowPadding', 'fontFamily', 'tableStyle', 'flagPlacement', 'patientLayout', 'accentColor', 'reportTitle', 'billTitle', 'endOfReportText', 'useReferenceBranding']) {
      if (!same(selected[k], saved[k])) out.add(k);
    }
    if (!same(selected.pageMargin, saved.pageMargin)) out.add('sideMargin');
    if (topGap !== padTop(saved, profile.letterheadTopMargin ?? 90)) out.add('topGap');
    if (bottomGap !== padBottom(saved)) out.add('bottomGap');
    return out;
  }, [profile, selected, toggles, topGap, bottomGap]);

  // Re-render the real PDF (debounced) whenever a setting changes.
  const previewBody = useMemo(() => (selected ? {
    documentFormats: formats, reportFormatId: selected.id, billFormatId: selected.id, kind,
    letterhead, showLetterheadByDefault: letterhead, letterheadTopMargin: Number(headerSpace), ...toggles
  } : null), [formats, selected, kind, letterhead, toggles, headerSpace, imagesVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!previewBody || hasErrors) return undefined;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const { blob, layout } = await previewReportWithLayout(previewBody);
        if (seq !== requestSeq.current) return;
        setPdf((old) => { if (old.url) URL.revokeObjectURL(old.url); return { blob, layout, url: URL.createObjectURL(blob) }; });
        setPreviewError(''); lastToast.current = '';
      } catch (error) {
        if (seq !== requestSeq.current) return;
        const message = await errorMessage(error, 'Could not update the preview.');
        setPreviewError(message);
        // One toast per distinct problem, not one per keystroke.
        if (lastToast.current !== message) { toast.error(message); lastToast.current = message; }
      } finally {
        if (seq === requestSeq.current) setRendering(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [previewBody, hasErrors]);
  useEffect(() => () => { if (pdf.url) URL.revokeObjectURL(pdf.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSelected = (patch) => {
    setFormats((list) => list.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)));
    setDirty(true);
  };
  const change = (key, value) => { updateSelected({ [key]: value }); setLastChange({ key, value }); };
  const setToggle = (key, value) => { setToggles((t) => ({ ...t, [key]: value })); setDirty(true); setLastChange({ key, value }); };

  // Margin and the two pad gaps are stored as page margin, header height,
  // header space and footer height; keep the gaps where the user put them.
  const applyGaps = ({ top = topGap, bottom = bottomGap, side = margin }, key) => {
    updateSelected({
      pageMargin: side,
      headerHeight: clamp(Math.round(top - side), 60, 480),
      footerHeight: clamp(Math.round(bottom - 10 - side), 30, 330)
    });
    setHeaderSpace(Math.round(top));
    if (key) setLastChange({ key, value: key === 'topGap' ? top : key === 'bottomGap' ? bottom : side, cm: true });
    // The gaps only matter on the pad print: show it.
    if ((key === 'topGap' || key === 'bottomGap' || key === 'fit') && kind === 'report' && letterhead) {
      setLetterhead(false);
      setPadNote('The gaps only change printing on the pre-printed pad — switched the preview to it.');
    }
  };
  const fitToPad = () => { applyGaps({ top: PAD_TOP_MIN, bottom: PAD_BOTTOM_MIN }, 'fit'); setLastChange({ key: 'fit', label: 'Fitted to the letterhead pad' }); };

  const createCopy = () => {
    const copy = { ...selected, id: `format-${crypto.randomUUID()}`, name: `${selected.name} copy` };
    setFormats((list) => [...list, copy]); setSelectedId(copy.id); setDirty(true);
    setLastChange({ key: 'name', label: `New format "${copy.name}"` });
  };
  const removeSelected = () => {
    const remaining = formats.filter((f) => f.id !== selected.id);
    setFormats(remaining);
    if (reportFormatId === selected.id) setReportFormatId(remaining[0].id);
    if (billFormatId === selected.id) setBillFormatId(remaining[0].id);
    setSelectedId(remaining[0].id); setDirty(true); setConfirmDelete(false);
  };

  const save = async () => {
    if (hasErrors) { toast.error(Object.values(fieldErrors)[0]); return; }
    setSaving(true);
    try {
      const response = await updateLabProfile({ documentFormats: formats, reportFormatId, billFormatId, letterheadTopMargin: Number(headerSpace), ...toggles });
      if (!response?.success) throw new Error(response?.message || 'The report template could not be saved.');
      const data = response.data?.profile ?? response.data;
      const keep = selected.id;
      setProfile(data);
      reset({ ...data, documentFormats: data.documentFormats?.length ? data.documentFormats : formats });
      setSelectedId(keep);
      toast.success('Report template saved. New reports and bills will use it.');
    } catch (error) {
      toast.error(await errorMessage(error, 'The report template could not be saved.'));
    } finally { setSaving(false); }
  };

  if (loadError) {
    return (
      <div className="report-template">
        <PageHeader title="Report Template" />
        <EmptyState title="Report template unavailable" message={loadError} action={<Button onClick={load}>Try again</Button>} />
      </div>
    );
  }
  if (!profile || !selected) return <div className="report-template"><PageHeader title="Report Template" /><LoadingSpinner /></div>;

  const label = (key, text = LABELS[key]) => (
    <>{text}{changedKeys.has(key) && <span className="rt-dot" title="Changed, not saved yet" aria-label="changed, not saved" />}</>
  );
  const formatError = (key) => fieldErrors[formatFieldKey(selected.id, key)];

  // One setting, rendered the same in the left panel and in a popover.
  const field = (key, where) => {
    const id = `${where}-${key}`;
    if (key.startsWith('img:')) return <LetterheadImages key={id} profile={profile} actions={images} only={[key.slice(4)]} />;
    if (key === 'fit') {
      return (
        <div key={id} className="rt-fit">
          <Button type="button" size="sm" variant="secondary" onClick={fitToPad}>Fit to our letterhead pad</Button>
          <small className="rt-help">Top gap 4.7 cm and bottom gap 6.1 cm: the smallest gaps that keep the pad's printing clear.</small>
        </div>
      );
    }
    if (key === 'title') return field(kind === 'bill' ? 'billTitle' : 'reportTitle', where);
    if (TOGGLES[key]) {
      return (
        <label className="report-template-check" key={id}>
          <input type="checkbox" checked={!!toggles[key]} onChange={(e) => setToggle(key, e.target.checked)} />
          <span>{label(key)}<small className="rt-help">{TOGGLES[key][1]}</small></span>
        </label>
      );
    }
    if (key === 'sideMargin') {
      return <CmField key={id} id={id} label={label('sideMargin')} value={margin} min={MARGIN[0]} max={MARGIN[1]}
        minText={`At least ${toCm(MARGIN[0])} cm.`} help={HELP.sideMargin} onCommit={(pt) => applyGaps({ side: pt }, 'sideMargin')} />;
    }
    if (key === 'topGap') {
      return <CmField key={id} id={id} label={label('topGap')} value={topGap} min={PAD_TOP_MIN} max={TOP_MAX}
        minText="Minimum 4.7 cm so the pad's header stays clear." help={HELP.topGap} onCommit={(pt) => applyGaps({ top: pt }, 'topGap')} />;
    }
    if (key === 'bottomGap') {
      return <CmField key={id} id={id} label={label('bottomGap')} value={bottomGap} min={PAD_BOTTOM_MIN} max={330 + 10 + margin}
        minText="Minimum 6.1 cm so the pad's footer stays clear." help={HELP.bottomGap} onCommit={(pt) => applyGaps({ bottom: pt }, 'bottomGap')} />;
    }
    if (key === 'fontSize' || key === 'rowPadding') {
      const [min, max] = key === 'fontSize' ? [8, 12] : [2, 8];
      return <Input key={id} id={id} label={label(key)} type="number" min={min} max={max} step="1" value={selected[key]}
        error={formatError(key) ? `Use a number from ${min} to ${max}.` : undefined} helperText={HELP[key]}
        onChange={(e) => change(key, e.target.value === '' ? '' : Number(e.target.value))} />;
    }
    const select = SELECT_FORMAT_FIELDS.find(([k]) => k === key);
    if (select) {
      return (
        <label className="form-group" key={id}>{label(key)}
          <select className="form-control" value={selected[key]} onChange={(e) => change(key, e.target.value)}>
            {select[2].map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <small className="rt-help">{HELP[key]}</small>
        </label>
      );
    }
    if (key === 'accentColor') return <Input key={id} id={id} label={label(key)} type="color" value={selected.accentColor} helperText={HELP[key]} onChange={(e) => change(key, e.target.value)} />;
    if (key === 'useReferenceBranding') {
      return (
        <label className="report-template-check" key={id}>
          <input type="checkbox" checked={!!selected.useReferenceBranding} onChange={(e) => change(key, e.target.checked)} />
          <span>{label(key, "Use the letterhead pad's images")}<small className="rt-help">{HELP[key]}</small></span>
        </label>
      );
    }
    // Text: name, titles, end of report text.
    return <Input key={id} id={id} label={label(key)} value={selected[key] ?? ''} maxLength={120} required={key === 'name'}
      error={formatError(key)} helperText={formatError(key) ? undefined : HELP[key]} onChange={(e) => change(key, e.target.value)} />;
  };

  const zoneLabel = (zoneKind, short) => {
    const z = ZONES[zoneKind];
    if (!z) return null;
    if (kind === 'bill' && (zoneKind === 'headerSpace' || zoneKind === 'footerSpace')) return null;
    return short ? z[1] : z[0];
  };
  const popoverFor = (zoneKind) => {
    const keys = ZONES[zoneKind][2].filter((k) => padPrint || !['topGap', 'bottomGap', 'fit'].includes(k));
    return (
      <>
        {!padPrint && ['header', 'footer'].includes(zoneKind) && kind === 'report' && (
          <p className="rt-help rt-pop-note">The gaps for the pre-printed pad are set on the "Without letterhead" preview.</p>
        )}
        {keys.map((k) => field(k, `pop-${zoneKind}`))}
      </>
    );
  };

  const describeChange = () => {
    if (!lastChange) return '';
    if (lastChange.label) return `${lastChange.label}${lastChange.saved ? ' (saved)' : ' (unsaved)'}`;
    const { key, value, cm } = lastChange;
    let text = value;
    if (cm) text = `${toCm(value)} cm`;
    else if (typeof value === 'boolean') text = value ? 'on' : 'off';
    else {
      const select = SELECT_FORMAT_FIELDS.find(([k]) => k === key);
      if (select) text = (select[2].find(([v]) => v === value)?.[1] || value).split(':')[0];
      else if (typeof value === 'string' && key !== 'accentColor') text = value ? `"${value}"` : '(empty)';
    }
    return `${LABELS[key] || key} ${text} (unsaved)`;
  };
  const status = hasErrors ? 'Fix the highlighted field to update the preview'
    : rendering ? 'Updating preview…'
      : previewError ? 'Preview not updated'
        : lastChange ? `Showing: ${describeChange()}`
          : dirty ? 'Unsaved changes shown' : 'Saved template shown';

  return (
    <div className="report-template">
      <PageHeader
        title="Report Template"
        subtitle="Point at any part of the report to change it. Drop an image on the header, footer, signatures or watermark to replace it."
        action={(
          <div className="report-template-actions">
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => reset(profile)}>Discard changes</Button>
            <Button loading={saving} disabled={!dirty} onClick={save}>Save template</Button>
          </div>
        )}
      />
      <div className="report-template-layout">
        <form className="report-template-fields" noValidate aria-label="All report template settings" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <fieldset>
            <legend>Format</legend>
            <label className="form-group">Format to edit
              <select className="form-control" value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{[f.id === reportFormatId && 'reports', f.id === billFormatId && 'bills'].filter(Boolean).length ? ` (used for ${[f.id === reportFormatId && 'reports', f.id === billFormatId && 'bills'].filter(Boolean).join(' and ')})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {field('name', 'panel')}
            <label className="report-template-check">
              <input type="checkbox" checked={reportFormatId === selected.id} disabled={reportFormatId === selected.id}
                onChange={() => { setReportFormatId(selected.id); setDirty(true); }} />
              <span>Use this format for reports</span>
            </label>
            <label className="report-template-check">
              <input type="checkbox" checked={billFormatId === selected.id} disabled={billFormatId === selected.id}
                onChange={() => { setBillFormatId(selected.id); setDirty(true); }} />
              <span>Use this format for bills</span>
            </label>
            <div className="rt-format-actions">
              <Button type="button" size="sm" variant="secondary" disabled={formats.length >= 20} onClick={createCopy}>Copy as a new format</Button>
              <Button type="button" size="sm" variant="ghost" disabled={formats.length <= 1} onClick={() => setConfirmDelete(true)}>Delete this format</Button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Images</legend>
            <p className="report-template-note report-template-note-top">Or drop an image straight on the page preview. Saved as soon as it is uploaded.</p>
            <LetterheadImages profile={profile} actions={images} />
          </fieldset>

          <fieldset>
            <legend>Margins and pad gaps</legend>
            {field('sideMargin', 'panel')}
            <p className="rt-pad-note">Only for printing on the pad:</p>
            {field('fit', 'panel')}
            {field('topGap', 'panel')}
            {field('bottomGap', 'panel')}
          </fieldset>

          <fieldset>
            <legend>Results and text</legend>
            {['fontFamily', 'fontSize', 'rowPadding', 'tableStyle', 'flagPlacement', 'patientLayout', 'accentColor', 'reportTitle', 'billTitle', 'endOfReportText', 'useReferenceBranding'].map((k) => field(k, 'panel'))}
          </fieldset>

          <fieldset>
            <legend>Show on reports</legend>
            {TOGGLE_KEYS.map((k) => field(k, 'panel'))}
            <p className="report-template-note">Lab name and contact details are on <Link to="/setup/profile">Lab profile</Link>.</p>
          </fieldset>
        </form>

        <section className="report-template-preview" aria-label="Preview">
          <div className="report-template-preview-bar">
            <div className="report-template-segment" role="group" aria-label="Document">
              <button type="button" aria-pressed={kind === 'report'} className={kind === 'report' ? 'is-on' : ''} onClick={() => setKind('report')}>Report</button>
              <button type="button" aria-pressed={kind === 'bill'} className={kind === 'bill' ? 'is-on' : ''} onClick={() => setKind('bill')}>Bill</button>
            </div>
            {kind === 'report' && (
              <div className="report-template-segment" role="group" aria-label="Paper">
                <button type="button" aria-pressed={letterhead} className={letterhead ? 'is-on' : ''} onClick={() => { setLetterhead(true); setPadNote(''); }}>With letterhead</button>
                <button type="button" aria-pressed={!letterhead} className={!letterhead ? 'is-on' : ''} onClick={() => { setLetterhead(false); setPadNote(''); }}>Without letterhead (pad)</button>
              </div>
            )}
            <span className="report-template-status" role="status" aria-live="polite">{status}</span>
            {pdf.url && <a className="report-template-open" href={pdf.url} target="_blank" rel="noreferrer">Open PDF</a>}
          </div>
          {padNote && (
            <div className="report-template-callout is-info" role="status">
              {padNote} <button type="button" className="report-template-link" onClick={() => setPadNote('')}>OK</button>
            </div>
          )}
          {(hasErrors || previewError) && (
            <div className="report-template-callout" role="alert">
              <strong>Preview not updated.</strong> {hasErrors ? Object.values(fieldErrors)[0] : previewError}
            </div>
          )}
          <PdfCanvasPreview
            blob={pdf.blob}
            layout={pdf.layout}
            busy={rendering || Boolean(images.busy)}
            emptyText={previewError ? 'The preview could not be made.' : 'Making the preview…'}
            labelFor={zoneLabel}
            dropKinds={['header', 'footer', 'signatures', 'watermark']}
            onDropImage={(zoneKind, file) => { const item = imageForZone(zoneKind); if (item) images.pick(item, file); }}
            renderPopover={popoverFor}
            gaps={padPrint ? {
              top: topGap, bottom: bottomGap, minTop: PAD_TOP_MIN, maxTop: TOP_MAX, minBottom: PAD_BOTTOM_MIN, maxBottom: 330 + 10 + margin,
              onChange: (which, pt) => applyGaps(which === 'top' ? { top: pt } : { bottom: pt }, which === 'top' ? 'topGap' : 'bottomGap'),
              topHint: topGap > PAD_TOP_MIN + CM
                ? <>The report starts lower than the pad needs — <button type="button" className="report-template-link" onClick={fitToPad}>Fit to pad?</button></>
                : null
            } : null}
          />
          <p className="report-template-note">
            {kind === 'report' && !letterhead ? 'Drag the orange lines to set where the report starts and ends on the pad. ' : ''}
            Sample patient and results only. Settings are kept when you press Save template; images are saved as soon as you upload them.
          </p>
        </section>
      </div>
      {images.dialog}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeSelected}
        title={`Delete the format "${selected.name}"?`}
        message="Reports and bills that use it will use the first remaining format. Nothing changes until you press Save template."
        confirmText="Delete format"
      />
    </div>
  );
}
