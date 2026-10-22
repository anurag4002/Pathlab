const { parseDocument } = require('htmlparser2');
const DomUtils = require('domutils');

function findLabelDiv(node, label) {
  let found = null;
  const visit = el => {
    if (found) return;
    if (el.type === 'tag' && el.name === 'div') {
      const text = DomUtils.textContent(el).trim();
      if (!el.children.some(child => child.type === 'tag') && text === label) {
        found = el;
        return;
      }
    }
    for (const child of el.children || []) visit(child);
  };
  visit(node);
  return found;
}

function nextContentDiv(labelDiv) {
  let sibling = labelDiv.next;
  while (sibling && !(sibling.type === 'tag' && sibling.name === 'div')) sibling = sibling.next;
  return sibling;
}

// Labsmart popup HTML has a label div ("Panel name:" / "Test name:" / "Interpretation:")
// followed by a sibling content div.
function extractPopup(html, nameLabel) {
  const doc = parseDocument(html);
  const nameDiv = findLabelDiv(doc, nameLabel);
  const name = nameDiv ? DomUtils.textContent(nameDiv.next).trim() : '';
  const label = findLabelDiv(doc, 'Interpretation:');
  const content = label ? nextContentDiv(label) : null;
  return {
    name: name || '',
    html: content ? DomUtils.getInnerHTML(content).trim() : '',
    text: content ? DomUtils.textContent(content).trim() : ''
  };
}

module.exports = { extractPopup, findLabelDiv, nextContentDiv };
