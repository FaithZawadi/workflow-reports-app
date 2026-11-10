// Shared invoice money math: subtotal from items, retention withheld (a % of
// subtotal), net, VAT on the net, and the amount due.
export function computeInvoiceTotals(items, vatRate, retentionRate) {
  const subtotal = (Array.isArray(items) ? items : []).reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    0
  );
  const retentionAmount = (subtotal * (Number(retentionRate) || 0)) / 100;
  const netAmount = subtotal - retentionAmount;
  const vatAmount = (netAmount * (Number(vatRate) || 0)) / 100;
  const grandTotal = netAmount + vatAmount;
  const round = (n) => Math.round(n * 100) / 100;
  return {
    subtotal: round(subtotal),
    retentionAmount: round(retentionAmount),
    netAmount: round(netAmount),
    vatAmount: round(vatAmount),
    grandTotal: round(grandTotal),
  };
}
