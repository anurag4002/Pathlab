export function getBillPaperSize() {
  try { return localStorage.getItem('ppl_bill_paper_size') === 'A5' ? 'A5' : 'A4'; }
  catch { return 'A4'; }
}
export function saveBillPaperSize(value) {
  const paper = value === 'A5' ? 'A5' : 'A4';
  try { localStorage.setItem('ppl_bill_paper_size', paper); } catch { /* session preference only */ }
  return paper;
}
