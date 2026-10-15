const sanitizeHtml = require('sanitize-html');
const { parseDocument } = require('htmlparser2');

const isRichInterpretation = value => /<\/?(?:p|div|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li|strong|b|em|i|u|s|br|span)\b[^>]*>/i.test(String(value || ''));
function sanitizeInterpretation(value) {
  if (!isRichInterpretation(value)) return String(value || '');
  return sanitizeHtml(String(value), {
    allowedTags: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'span', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'colgroup', 'col'],
    allowedAttributes: { '*': ['style'], td: ['colspan', 'rowspan', 'colwidth', 'data-colwidth', 'style'], th: ['colspan', 'rowspan', 'colwidth', 'data-colwidth', 'style'], col: ['width', 'style'], ol: ['start'] },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/], width: [/^\d+(?:\.\d+)?(?:px|%)$/], 'min-width': [/^\d+(?:\.\d+)?px$/] } },
    parser: { decodeEntities: true },
  });
}
const children = node => node.children || [];
const alignment = node => node.attribs?.style?.match(/text-align:\s*(left|center|right|justify)/i)?.[1] || 'left';
function inlineRuns(node, marks = {}) {
  if (node.type === 'text') return [{ text: node.data, ...marks }];
  if (node.name === 'br') return [{ text: '\n', ...marks }];
  const next = { ...marks };
  if (['strong', 'b'].includes(node.name)) next.bold = true;
  if (['em', 'i'].includes(node.name)) next.italic = true;
  if (node.name === 'u') next.underline = true;
  if (node.name === 's') next.strike = true;
  return children(node).flatMap((child, index) => [
    ...(index && ['p', 'div'].includes(child.name) ? [{ text: '\n', ...next }] : []), ...inlineRuns(child, next)
  ]);
}
const span = value => Math.max(1, Math.min(40, parseInt(value, 10) || 1));
function richInterpretationBlocks(value) {
  const document = parseDocument(sanitizeInterpretation(value));
  const blocks = [];
  const visit = (node, list = null, index = 0) => {
    if (node.name === 'table') {
      const rows = [];
      const collectRows = parent => {
        for (const child of children(parent)) {
          if (child.name === 'tr') rows.push(children(child).filter(cell => ['th', 'td'].includes(cell.name)).map(cell => {
            const runs = inlineRuns(cell);
            return { text: runs.map(run => run.text).join(''), runs, colspan: span(cell.attribs?.colspan), rowspan: span(cell.attribs?.rowspan),
              header: cell.name === 'th', align: cell.attribs?.style?.includes('text-align') ? alignment(cell) : alignment(children(cell).find(child => child.name === 'p') || {}),
              colwidth: String(cell.attribs?.colwidth || cell.attribs?.['data-colwidth'] || '').split(',').map(Number).filter(n => n > 0) };
          }));
          else if (['thead', 'tbody', 'tfoot'].includes(child.name)) collectRows(child);
        }
      };
      collectRows(node);
      if (rows.length) blocks.push({ kind: 'table', rows: rows.map(row => row.map(cell => cell.text)), richRows: rows });
      return;
    }
    if (['ul', 'ol'].includes(node.name)) {
      let number = parseInt(node.attribs?.start, 10) || 1;
      for (const item of children(node).filter(child => child.name === 'li')) visit(item, node.name, number++);
      return;
    }
    if (['p', 'h1', 'h2', 'h3', 'h4', 'li'].includes(node.name)) {
      const inlineChildren = node.name === 'li' ? { children: children(node).filter(child => !['ul', 'ol'].includes(child.name)) } : node;
      let runs = inlineRuns(inlineChildren);
      if (list) runs = [{ text: list === 'ol' ? `${index}. ` : '- ' }, ...runs];
      const text = runs.map(run => run.text).join('');
      if (text.trim()) blocks.push({ kind: /^h[1-4]$/.test(node.name) ? 'heading' : list ? 'list' : 'paragraph', text, runs, align: alignment(node), headingLevel: /^h/.test(node.name) ? Number(node.name.slice(1)) : undefined });
      if (node.name === 'li') for (const nested of children(node).filter(child => ['ul', 'ol'].includes(child.name))) visit(nested);
      return;
    }
    if (node.type === 'text') { if (node.data.trim()) blocks.push({ kind: 'paragraph', text: node.data, runs: [{ text: node.data }] }); return; }
    children(node).forEach(child => visit(child));
  };
  visit(document);
  return blocks;
}
module.exports = { isRichInterpretation, sanitizeInterpretation, richInterpretationBlocks };
