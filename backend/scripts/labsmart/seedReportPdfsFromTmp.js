#!/usr/bin/env node
// Copies previously scraped Labsmart print PDFs from tmp/ into fixtures.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart/reports');
const PDFTOTEXT = process.env.PDFTOTEXT_PATH
  || 'C:\\Users\\Pratyush Mishra\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe';

const MAP = [
  { id: '30690438', slug: 'cbc', pdf: 'tmp/labsmart-cbc-print.pdf' },
  { id: '30693124', slug: 'kft', pdf: 'tmp/labsmart-kft-print.pdf' },
  { id: '30688430', slug: 'cbc-kft', pdf: 'tmp/labsmart-cbc-kft-print.pdf' },
  { id: '30684127', slug: 'multi', pdf: 'tmp/labsmart-multi-print.pdf' }
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const reports = [];
  for (const item of MAP) {
    const src = path.join(ROOT, item.pdf);
    if (!fs.existsSync(src)) {
      console.warn('missing', item.pdf);
      continue;
    }
    const pdfPath = path.join(OUT_DIR, `${item.id}.pdf`);
    const txtPath = path.join(OUT_DIR, `${item.id}.txt`);
    fs.copyFileSync(src, pdfPath);
    if (fs.existsSync(PDFTOTEXT)) {
      spawnSync(PDFTOTEXT, ['-layout', pdfPath, txtPath], { encoding: 'utf8' });
    }
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
    const meta = {
      id: item.id,
      slug: item.slug,
      source: item.pdf,
      bytes: fs.statSync(pdfPath).size,
      textChars: text.length,
      seededAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(OUT_DIR, `${item.id}.meta.json`), JSON.stringify(meta, null, 2));
    reports.push(meta);
    console.log('seeded', item.id, item.slug, meta.bytes);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({
    scrapedAt: new Date().toISOString(),
    source: 'seeded-from-tmp',
    count: reports.length,
    reports
  }, null, 2));
  console.log(`done ${reports.length} -> ${OUT_DIR}`);
}

main();
