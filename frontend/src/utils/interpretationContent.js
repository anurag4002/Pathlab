import DOMPurify from 'dompurify';

const richTag = /<\/?(?:p|div|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li|strong|b|em|i|u|s|br|span)\b[^>]*>/i;
const heading = /^(physiologic(?:al)? basis|clinical significance|interpretation|increased in|decreased in|causes of (?:increased|decreased) .+|notes?|comments?|method|principle|reference(?: interval| range)?|clinical (?:utility|use)|limitations?|specimen|precautions?)\s*:?$/i;
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const sanitizeInterpretationHtml = value => {
  const fragment = DOMPurify.sanitize(String(value || ''), {
  ALLOWED_TAGS: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'span', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'colgroup', 'col'],
  ALLOWED_ATTR: ['style', 'colspan', 'rowspan', 'colwidth', 'data-colwidth', 'width', 'start'],
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('[style]').forEach(node => {
    const align = node.style.textAlign;
    const width = node.style.width;
    const minWidth = node.style.minWidth;
    node.removeAttribute('style');
    if (/^(left|center|right|justify)$/.test(align)) node.style.textAlign = align;
    if (/^\d+(?:\.\d+)?(?:px|%)$/.test(width)) node.style.width = width;
    if (/^\d+(?:\.\d+)?px$/.test(minWidth)) node.style.minWidth = minWidth;
  });
  const container = document.createElement('div'); container.append(fragment);
  return container.innerHTML;
};

export function toInterpretationHtml(value) {
  const text = String(value || '');
  if (richTag.test(text)) return sanitizeInterpretationHtml(text);
  const blocks = [];
  let paragraph = [], rows = [], list = [], ordered = false;
  const flushParagraph = () => { if (paragraph.length) blocks.push(`<p>${escape(paragraph.join(' '))}</p>`); paragraph = []; };
  const flushRows = () => {
    if (rows.length) blocks.push(`<table><tbody>${rows.map((row, index) => `<tr>${row.map(cell => `<${index ? 'td' : 'th'}><p>${escape(cell)}</p></${index ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table>`);
    rows = [];
  };
  const flushList = () => { if (list.length) blocks.push(`<${ordered ? 'ol' : 'ul'}>${list.map(line => `<li><p>${escape(line)}</p></li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); list = []; };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (raw.includes('\t')) { flushParagraph(); flushList(); rows.push(raw.split('\t').map(cell => cell.trim())); continue; }
    flushRows();
    if (!line) { flushParagraph(); flushList(); continue; }
    const item = line.match(/^(?:[-•]\s+|\d+[.)]\s*)(.+)$/);
    if (item) {
      flushParagraph();
      const numbered = /^\d/.test(line);
      if (list.length && numbered !== ordered) flushList();
      ordered = numbered; list.push(item[1]); continue;
    }
    flushList();
    if (heading.test(line) || (line.length <= 90 && /:$/.test(line))) {
      flushParagraph(); blocks.push(`<h3>${escape(line.replace(/:\s*$/, ''))}</h3>`);
    } else {
      const inline = line.match(/^((?:increased|decreased|high|low|elevated|raised)(?: levels?)?(?: causes?| values?)?(?: in)?|notes?|comments?|method|specimen)\s*:\s*(.+)$/i);
      if (inline) { flushParagraph(); blocks.push(`<h3>${escape(inline[1])}</h3>`); paragraph.push(inline[2]); }
      else paragraph.push(line);
    }
  }
  flushParagraph(); flushRows(); flushList();
  return blocks.join('') || '<p></p>';
}

export function hasInterpretation(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160);/gi, ' ').trim().length > 0;
}

export function interpretationPlainText(value) {
  const doc = new DOMParser().parseFromString(toInterpretationHtml(value), 'text/html');
  doc.querySelectorAll('tr').forEach(row => {
    const cells = [...row.children].map(cell => cell.textContent.trim());
    row.replaceWith(doc.createTextNode(`${cells.join('\t')}\n`));
  });
  doc.querySelectorAll('p,h1,h2,h3,h4,li,br').forEach(node => node.append(doc.createTextNode('\n')));
  return doc.body.textContent.trim();
}

export async function copyInterpretation(value) {
  const html = toInterpretationHtml(value), plain = interpretationPlainText(value);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      return;
    } catch { /* Text-only clipboard fallback retains all the wording. */ }
  }
  await navigator.clipboard.writeText(plain);
}
