#!/usr/bin/env node
// Visual Labsmart ↔ Pathlab PDF parity.
// Renders each pair of PDFs to page PNGs, masks letterhead/footer banding,
// then scores pixel similarity (pixelmatch). Text recreate-match is separate.
//
// Requires: pathlab recreates from `npm run labsmart:recreate-match`
// Usage:    npm run labsmart:visual-match

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

const REPORTS_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart/reports');
const PATHLAB_DIR = path.join(REPORTS_DIR, 'pathlab-recreates');
const DIFF_DIR = path.join(REPORTS_DIR, 'visual-diffs');
const PDFTOPPM = process.env.PDFTOPPM_PATH
  || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftoppm.exe';
const DPI = Number(process.env.LABSMART_VISUAL_DPI || 72);
const SCALE_TO_X = Number(process.env.LABSMART_VISUAL_WIDTH || 800);
// Fraction of page height ignored at top/bottom (branding / footer / page no).
const MASK_TOP = Number(process.env.LABSMART_VISUAL_MASK_TOP || 0.12);
const MASK_BOTTOM = Number(process.env.LABSMART_VISUAL_MASK_BOTTOM || 0.08);
// Max mismatched pixels (after mask) as a fraction of compared pixels.
const MAX_DIFF = Number(process.env.LABSMART_VISUAL_MAX_DIFF || 0.20);
const PIXEL_THRESHOLD = Number(process.env.LABSMART_VISUAL_PIXEL_THRESHOLD || 0.25);
const SAVE_ALL_DIFFS = process.env.LABSMART_VISUAL_SAVE_ALL === '1';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function renderPdf(pdfPath, outPrefix) {
  ensureDir(path.dirname(outPrefix));
  const result = spawnSync(PDFTOPPM, [
    '-png',
    '-r', String(DPI),
    '-scale-to-x', String(SCALE_TO_X),
    '-scale-to-y', '-1',
    pdfPath,
    outPrefix
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`pdftoppm failed for ${pdfPath}: ${result.stderr || result.stdout || result.status}`);
  }
  const dir = path.dirname(outPrefix);
  const base = path.basename(outPrefix);
  return fs.readdirSync(dir)
    .filter(name => name.startsWith(`${base}-`) && name.endsWith('.png'))
    .sort((a, b) => {
      const na = Number((a.match(/-(\d+)\.png$/) || [])[1] || 0);
      const nb = Number((b.match(/-(\d+)\.png$/) || [])[1] || 0);
      return na - nb;
    })
    .map(name => path.join(dir, name));
}

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function resizeTo(src, width, height) {
  if (src.width === width && src.height === height) return src;
  const dst = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y * src.height / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x * src.width / width));
      const si = (src.width * sy + sx) << 2;
      const di = (width * y + x) << 2;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

/** White-out letterhead / footer bands so branding does not dominate the score. */
function maskBranding(img) {
  const out = new PNG({ width: img.width, height: img.height });
  out.data.set(img.data);
  const topEnd = Math.floor(img.height * MASK_TOP);
  const bottomStart = Math.floor(img.height * (1 - MASK_BOTTOM));
  for (let y = 0; y < img.height; y++) {
    if (y >= topEnd && y < bottomStart) continue;
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * y + x) << 2;
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function comparedPixelCount(width, height) {
  const topEnd = Math.floor(height * MASK_TOP);
  const bottomStart = Math.floor(height * (1 - MASK_BOTTOM));
  return width * Math.max(0, bottomStart - topEnd);
}

function comparePages(labPath, ourPath, diffPath) {
  let lab = maskBranding(loadPng(labPath));
  let our = maskBranding(loadPng(ourPath));
  const width = Math.max(lab.width, our.width);
  const height = Math.max(lab.height, our.height);
  lab = resizeTo(lab, width, height);
  our = resizeTo(our, width, height);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(lab.data, our.data, diff.data, width, height, {
    threshold: PIXEL_THRESHOLD,
    includeAA: true
  });
  const compared = comparedPixelCount(width, height) || (width * height);
  const ratio = mismatched / compared;
  if (diffPath && (SAVE_ALL_DIFFS || ratio > MAX_DIFF)) {
    ensureDir(path.dirname(diffPath));
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return {
    mismatched,
    compared,
    ratio: Number(ratio.toFixed(4)),
    width,
    height,
    diffPath: ratio > MAX_DIFF ? diffPath : undefined
  };
}

function cleanupDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

function main() {
  if (!fs.existsSync(PDFTOPPM)) {
    console.error('pdftoppm not found at', PDFTOPPM);
    console.error('Set PDFTOPPM_PATH to the pdftoppm executable.');
    process.exit(1);
  }
  if (!fs.existsSync(PATHLAB_DIR)) {
    console.error('Missing Pathlab recreates. Run: npm run labsmart:recreate-match');
    process.exit(1);
  }

  ensureDir(DIFF_DIR);
  const renderRoot = path.join(DIFF_DIR, '_renders');
  cleanupDir(renderRoot);
  ensureDir(renderRoot);

  const ids = fs.readdirSync(REPORTS_DIR)
    .filter(name => name.endsWith('.pdf') && /^\d+\.pdf$/.test(name))
    .map(name => name.replace(/\.pdf$/, ''))
    .filter(id => fs.existsSync(path.join(PATHLAB_DIR, `${id}.pdf`)));

  const results = [];
  for (const id of ids) {
    const labPdf = path.join(REPORTS_DIR, `${id}.pdf`);
    const ourPdf = path.join(PATHLAB_DIR, `${id}.pdf`);
    const labPrefix = path.join(renderRoot, id, 'lab');
    const ourPrefix = path.join(renderRoot, id, 'our');
    ensureDir(path.join(renderRoot, id));

    let labPages;
    let ourPages;
    try {
      labPages = renderPdf(labPdf, labPrefix);
      ourPages = renderPdf(ourPdf, ourPrefix);
    } catch (error) {
      results.push({ id, status: 'fail', reason: String(error.message || error) });
      console.error(`FAIL ${id} render:`, error.message || error);
      continue;
    }

    const shared = Math.min(labPages.length, ourPages.length);
    const pages = [];
    let worst = 0;
    let failReason = null;

    // Pathlab packing tighter (fewer pages) is OK when shared pages match.
    // Pathlab spilling onto extra pages is a real layout fail.
    if (ourPages.length > labPages.length) {
      failReason = `page count lab=${labPages.length} pathlab=${ourPages.length}`;
    }

    for (let i = 0; i < shared; i++) {
      const diffPath = path.join(DIFF_DIR, id, `page-${i + 1}-diff.png`);
      const score = comparePages(labPages[i], ourPages[i], diffPath);
      worst = Math.max(worst, score.ratio);
      const pagePass = score.ratio <= MAX_DIFF;
      pages.push({
        page: i + 1,
        status: pagePass ? 'pass' : 'fail',
        diffRatio: score.ratio,
        mismatched: score.mismatched,
        compared: score.compared,
        diffPath: score.diffPath
      });
      if (!pagePass && !failReason) failReason = `page ${i + 1} diff=${(score.ratio * 100).toFixed(1)}%`;
    }
    for (let i = shared; i < ourPages.length; i++) {
      pages.push({ page: i + 1, status: 'fail', reason: 'extra Pathlab page' });
    }

    const pass = !failReason && pages.every(page => page.status === 'pass');
    const row = {
      id,
      status: pass ? 'pass' : 'fail',
      labPages: labPages.length,
      ourPages: ourPages.length,
      worstDiffRatio: Number(worst.toFixed(4)),
      reason: failReason || undefined,
      pages
    };
    results.push(row);
    console.log(
      `${row.status.toUpperCase()} ${id} `
      + `pages lab=${row.labPages}/our=${row.ourPages} `
      + `worstDiff=${(row.worstDiffRatio * 100).toFixed(1)}%`
      + (failReason ? ` (${failReason})` : '')
    );
  }

  const summaryPath = path.join(REPORTS_DIR, 'visual-match-summary.json');
  const passed = results.filter(item => item.status === 'pass');
  const failed = results.filter(item => item.status === 'fail');
  fs.writeFileSync(summaryPath, JSON.stringify({
    matchedAt: new Date().toISOString(),
    primary: 'visual-page-diff',
    maxDiffRatio: MAX_DIFF,
    maskTop: MASK_TOP,
    maskBottom: MASK_BOTTOM,
    dpi: DPI,
    width: SCALE_TO_X,
    passed: passed.length,
    failed: failed.length,
    results
  }, null, 2));

  console.log(`\n${passed.length} passed, ${failed.length} failed / ${results.length} total`);
  console.log('summary ->', summaryPath);
  console.log('diffs   ->', DIFF_DIR);
  if (failed.length) process.exit(1);
}

main();
