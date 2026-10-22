// Parse pdftotext -layout output from a Labsmart print PDF into result rows
// and interpretation / notes blocks.

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function matchQualitative(trimmed) {
  return trimmed.match(
    /^([A-Za-z][A-Za-z0-9 .\/\-',()]{1,70})\s+(NIL|NEGATIVE|POSITIVE|REACTIVE|NON[-\s]?REACTIVE|ABSENT|PRESENT)\s*$/i
  );
}

function matchNumeric(trimmed) {
  return trimmed.match(
    /^([A-Za-z][A-Za-z0-9 .\/\-',()]{1,70}?)\s+(?:([HLC])\s+)?([<>]?\d+(?:,\d{3})*(?:\.\d+)?)\s+([A-Za-zµ/%.\-0-9]+)\s*(.*?)$/i
  );
}

function isResultLike(trimmed) {
  const lowerWords = (trimmed.match(/\b[a-z]{3,}\b/g) || []).length;
  if (lowerWords >= 4) return false;
  if (matchQualitative(trimmed)) return true;
  const numeric = matchNumeric(trimmed);
  if (!numeric) return false;
  const testName = clean(numeric[1]);
  if (/^(TEST|VALUE|UNIT|REFERENCE|HIGH|LOW|PARAMETER)$/i.test(testName)) return false;
  if (testName.length > 55) return false;
  return true;
}

function parseLabsmartReportText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const patientLine = lines.find(line => /^(Miss\.|Mrs\.|Mr\.|Master\.|Baby\.|Ms\.)/i.test(line.trim())) || '';
  const patient = clean(patientLine);
  const reg = (text.match(/Reg\.?\s*no\.?\s*:?\s*(\d+)/i) || [])[1] || '';
  const ageSex = (text.match(/Age\s*\/\s*Sex\s*:?\s*([^\n]+)/i) || [])[1] || '';
  const referred = (text.match(/Referred by\s*:?\s*([^\n]+)/i) || [])[1] || '';

  const results = [];
  const interpretations = [];
  let section = '';
  let inInterpretation = false;
  let interpretationLines = [];
  const flushInterpretation = () => {
    const body = interpretationLines.join('\n').trim();
    if (body.length > 40) interpretations.push({ section, text: body });
    interpretationLines = [];
  };
  const interpretationStart = /^(Possible causes|Clinical Notes|LFT Interpretation|Test Significance|Physiologic|Physiological|Creatinine is a|Increased in|Decreased in|Causes of Increased|Causes of Decreased|HbsAg is the first|Anti HCV card|HIV Interpretation|Notes\b)/i;

  const pushResult = (testName, flag, value, unit, referenceRange) => {
    results.push({
      section,
      testName,
      flag: flag || '',
      value,
      unit: unit || '',
      referenceRange: referenceRange || undefined
    });
  };

  const tryParseResult = (trimmed) => {
    const qualitativeOnly = matchQualitative(trimmed);
    if (qualitativeOnly) {
      const testName = clean(qualitativeOnly[1]);
      if (!/^(TEST|VALUE|UNIT|REFERENCE|HIV \(CARD TEST\))$/i.test(testName)) {
        pushResult(testName, '', qualitativeOnly[2].toUpperCase(), '', undefined);
      }
      return true;
    }
    const match = matchNumeric(trimmed);
    if (!match) return false;
    const testName = clean(match[1]).replace(/\s+/g, ' ');
    if (/^(TEST|VALUE|UNIT|REFERENCE|HIGH|LOW|PARAMETER)$/i.test(testName)) return false;
    if (testName.length > 55) return false;
    pushResult(
      testName,
      match[2] || '',
      String(match[3]).replace(/,/g, ''),
      clean(match[4] || ''),
      clean(match[5] || '') || undefined
    );
    return true;
  };

  for (const raw of lines) {
    const line = raw.replace(/\u000c/g, '');
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(~~~|End of report|Powered by)/i.test(trimmed)) {
      if (inInterpretation) flushInterpretation();
      inInterpretation = false;
      continue;
    }

    // A new department / panel heading resumes result parsing.
    if (/^(HAEMATOLOGY|BIOCHEMISTRY|SEROLOGY|CLINICAL|PATHOLOGY|IMMUNOLOGY|MICROBIOLOGY)\b/i.test(trimmed)
      && trimmed === trimmed.toUpperCase() && trimmed.length < 60) {
      if (inInterpretation) flushInterpretation();
      section = trimmed;
      inInterpretation = false;
      continue;
    }
    if (/^(COMPLETE BLOOD COUNT|LIVER FUNCTION|KIDNEY FUNCTION|BLOOD SUGAR|THYROID|IRON STUDIES|VIRAL MARKER|WIDAL)/i.test(trimmed)
      && trimmed === trimmed.toUpperCase()) {
      if (inInterpretation) flushInterpretation();
      section = trimmed;
      inInterpretation = false;
      continue;
    }

    // Result rows always win over interpretation mode (Labsmart often prints the
    // next analyte immediately after a notes box with no blank panel heading).
    if (isResultLike(trimmed)) {
      if (inInterpretation) flushInterpretation();
      inInterpretation = false;
      tryParseResult(trimmed);
      continue;
    }

    // Interpretation / notes boxes are not result rows.
    if (interpretationStart.test(trimmed)
      || (/interpretation/i.test(trimmed) && trimmed.length < 80 && !/TEST|VALUE/i.test(trimmed))) {
      if (inInterpretation) flushInterpretation();
      inInterpretation = true;
      interpretationLines.push(trimmed);
      continue;
    }

    if (inInterpretation) {
      interpretationLines.push(trimmed);
      continue;
    }
    if (/^TEST\b/.test(trimmed) && /VALUE/i.test(trimmed)) continue;
  }

  if (inInterpretation) flushInterpretation();

  return {
    patient,
    registrationNumber: reg,
    ageSex: clean(ageSex),
    referredBy: clean(referred),
    results,
    interpretations
  };
}

module.exports = { parseLabsmartReportText };
