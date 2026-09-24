/**
 * Safe helpers for deep-linking to the Billing Ledger (`/cases/bills?search=`).
 *
 * Root cause of the `?search=undefined` bug: several call sites built the URL
 * with `` `/cases/bills?search=${tx.bill?.billNumber}` `` where `bill` can be
 * a raw ObjectId string (unpopulated transaction), null (expense / deleted
 * bill), or an object without `billNumber`. Template interpolation then
 * produced the literal string "undefined", which BillsPage dutifully put in
 * the search box. These helpers make that impossible.
 */

/** Extract a bill number from a populated bill object, a bill-number string, or null. */
export const getBillNumber = (bill) => {
  if (!bill) return '';
  if (typeof bill === 'string') return '';
  return bill.billNumber || bill.number || '';
};

/**
 * Build a safe `/cases/bills` URL. Returns the plain ledger path when no bill
 * number is available instead of ever emitting `search=undefined`.
 */
export const buildBillsSearchUrl = (bill) => {
  const num = typeof bill === 'string' ? bill : getBillNumber(bill);
  if (num && num !== 'undefined' && num !== 'null') {
    return `/cases/bills?search=${encodeURIComponent(num)}`;
  }
  return '/cases/bills';
};

/**
 * Sanitize a `search` query param read back on BillsPage. Returns '' for
 * missing / literal-"undefined" / literal-"null" values.
 */
export const sanitizeBillSearchParam = (value) => {
  if (value == null) return '';
  const v = String(value).trim();
  if (!v || v === 'undefined' || v === 'null') return '';
  return v;
};

export default { getBillNumber, buildBillsSearchUrl, sanitizeBillSearchParam };
