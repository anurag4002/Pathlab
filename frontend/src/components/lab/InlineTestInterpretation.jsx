import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Button, Input, Select } from '../common';
import InterpretationText from './InterpretationText';
import { updateTestInterpretation } from '../../services/reportService';
import { getInterpretations, getTests, createInterpretation } from '../../services/testService';
import useAuth from '../../hooks/useAuth';
import { hasInterpretation, interpretationPlainText, toInterpretationHtml } from '../../utils/interpretationContent';
const RichInterpretationEditor = lazy(() => import('./RichInterpretationEditor'));

export default function InlineTestInterpretation(props) {
  const entry = props.testEntry;
  return <TestInterpretationEditor key={`${props.reportId}:${entry.resultKey || entry.testId || entry.testName}:${entry.interpretation || ''}:${!!entry.interpretationCustomized}`} {...props} />;
}

function TestInterpretationEditor({ reportId, testEntry, readOnly = false }) {
  const { user } = useAuth();
  const name = testEntry.testName || 'Test';
  const key = testEntry.resultKey || testEntry.testId || `name:${name}`;
  const catalog = testEntry.catalogInterpretation ?? testEntry.interpretation ?? '';
  const [saved, setSaved] = useState(testEntry.interpretation || '');
  const [customized, setCustomized] = useState(!!testEntry.interpretationCustomized);
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState(null);
  const [selected, setSelected] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const matchingLibrary = useMemo(() => {
    const words = librarySearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (library || []).filter(item => {
      const content = `${item.label} ${interpretationPlainText(item.text)}`.toLowerCase();
      return words.every(word => content.includes(word));
    });
  }, [library, librarySearch]);
  const [message, setMessage] = useState(null);
  const startEdit = () => { setDraft(toInterpretationHtml(saved)); setEditing(true); setMessage(null); };
  const copyFromLibrary = async () => {
    if (!editing) startEdit();
    if (library) return;
    setBusy(true); setMessage(null);
    try {
      const [templates, tests] = await Promise.all([getInterpretations(), getTests()]);
      setLibrary([
        ...(templates.data || []).filter(item => item.status === 'Active').map(item => ({ value: item._id, label: `${item.test?.name || 'General'} - ${item.resultCondition}`, text: item.interpretationText })),
        ...(tests.data || []).filter(test => test.interpretation?.trim()).map(test => ({ value: `catalog:${test._id}`, label: `${test.name} - Catalog`, text: test.interpretation }))
      ]);
    } catch (error) { setMessage({ error: true, text: error.response?.data?.message || 'Could not load the interpretation library.' }); }
    finally { setBusy(false); }
  };
  const save = async (reset = false) => {
    setBusy(true); setMessage(null);
    try {
      await updateTestInterpretation(reportId, key, draft, reset);
      const text = reset ? catalog : draft;
      setSaved(text); setDraft(text); setCustomized(!reset); setEditing(false);
      setMessage({ error: false, text: `Interpretation saved for ${name}.` });
    } catch (error) { setMessage({ error: true, text: error.response?.data?.message || 'Could not save this interpretation.' }); }
    finally { setBusy(false); }
  };
  const saveToLibrary = async () => {
    setBusy(true); setMessage(null);
    try {
      await createInterpretation({ test: testEntry.testId || null, resultCondition: name,
        interpretationText: draft, normalAbnormalGuidance: 'General', status: 'Active' });
      setLibrary(null);
      setMessage({ error: false, text: 'Complete interpretation saved to the reusable library.' });
    } catch (error) { setMessage({ error: true, text: error.response?.data?.message || 'Could not save to the library.' }); }
    finally { setBusy(false); }
  };
  if (!hasInterpretation(saved) && !hasInterpretation(catalog) && !editing) return null;
  return <div className="re-inline-interpretation" aria-label={`Interpretation for ${name}`}>
    {!editing ? <div className="re-interpretation-toolbar">
      {saved && <InterpretationText text={saved} title={`Interpretation${customized ? ' (edited for this report)' : ''}`} />}
      {!hasInterpretation(saved) && <span className="form-helper">Interpretation omitted for this report</span>}
      {!readOnly && <Button variant="secondary" size="sm" disabled={busy} aria-label={`Edit interpretation for ${name}`} onClick={startEdit}>Edit interpretation</Button>}
    </div> : <fieldset disabled={busy || readOnly} className="re-inline-interpretation-form">
      <legend>{name} — Interpretation</legend>
      <Suspense fallback={<p>Loading editor…</p>}>
        <RichInterpretationEditor label={`Interpretation text for ${name}`} disabled={busy || readOnly} value={draft} onChange={value => { setDraft(value); setMessage(null); }} />
      </Suspense>
      <p className="form-helper">Applies to this test in this report. Leave empty to omit its interpretation.</p>
      {library && <div className="re-inline-library">
        <Input id={`interpretation-search-${reportId}-${key}`} label="Search reusable interpretations" type="search"
          placeholder="Search test, title or interpretation text…" value={librarySearch}
          onChange={event => { setLibrarySearch(event.target.value); setSelected(''); }} />
        <Select id={`interpretation-library-${reportId}-${key}`} label="Reusable interpretation" placeholder="Choose interpretation" value={selected}
          onChange={event => setSelected(event.target.value)} options={matchingLibrary} />
        {matchingLibrary.length === 0 && <p className="form-helper" role="status">No interpretations match your search.</p>}
        <Button variant="secondary" size="sm" disabled={!selected} onClick={() => setDraft(toInterpretationHtml(library.find(item => item.value === selected)?.text || ''))}>Copy full text</Button>
        <Button variant="secondary" size="sm" disabled={!selected} onClick={() => setDraft([draft, library.find(item => item.value === selected)?.text].filter(Boolean).map(toInterpretationHtml).join(''))}>Append text</Button>
      </div>}
      <div className="re-interpretation-toolbar">
        <Button size="sm" onClick={() => save()} loading={busy} aria-label={`Save interpretation for ${name}`}>Save interpretation</Button>
        <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setMessage(null); }}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={copyFromLibrary}>Copy from library</Button>
        <Button variant="secondary" size="sm" onClick={() => save(true)}>Use catalog interpretation</Button>
        {user?.role === 'Admin' && <Button variant="secondary" size="sm" disabled={!draft.trim()} onClick={saveToLibrary}>Save full text to library</Button>}
      </div>
    </fieldset>}
    {message && <p className="form-helper" role={message.error ? 'alert' : 'status'} style={{ color: message.error ? '#b91c1c' : '#166534' }}>{message.text}</p>}
  </div>;
}
