import { COMPANY } from "@/lib/company";

// Map the app's records into the data shapes the HTML document templates expect
// (see the design system README §3). Figures are pre-formatted with thousands
// separators; the templates print them as-is.

export const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtDate(d, withTime) {
  if (!d) return "—";
  try {
    const s = new Date(d).toLocaleString("en-GB", {
      timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    });
    return withTime ? s.replace(",", " ·") + " EAT" : s;
  } catch { return String(d); }
}

// Strip a data-URL prefix — the templates wrap raw base64 themselves.
export const rawB64 = (dataUrl) => String(dataUrl || "").replace(/^data:image\/\w+;base64,/, "");

// ORG constants from the company config.
export function orgData() {
  const b = COMPANY.bank || {};
  return {
    accred: "ISO 9001:2015 Certified (TNV)  |  ISO/IEC 17025:2017 Accredited (KENAS)  |  ILAC-MRA",
    addr: [
      "QSL Centre, Birdi Singh Complex",
      COMPANY.postal && COMPANY.postal.includes("Box") ? "P.O. Box 34463-00100, Nairobi" : "P.O. Box 34463-00100, Nairobi",
      COMPANY.phone,
      `${COMPANY.email}  ·  ${COMPANY.website}`,
    ],
    legalName: COMPANY.name,
    system: "QaliMetric v2.4",
    verifyBase: "https://reports.qalibrated.com/reports/",
    payRow: [
      ["Account name", b.accountName || COMPANY.name],
      ["Bank", b.name || ""],
      ["Branch", b.branch || ""],
      ["Account no.", b.accountNo || ""],
    ],
    payStrip: [
      b.paybill ? ["Paybill", b.paybill] : null,
      b.bankCode ? ["Bank code", b.bankCode] : null,
      b.branchCode ? ["Branch code", b.branchCode] : null,
      COMPANY.pin ? ["PIN no.", COMPANY.pin] : null,
    ].filter(Boolean),
  };
}

const partyLines = (o) =>
  [o.contactPerson ? `Attn: ${o.contactPerson}` : null, o.contactEmail || null, o.contactPhone || null].filter(Boolean);

const termsToList = (text, fallback) => {
  const t = String(text || "").trim();
  if (!t) return fallback || [];
  const byLine = t.split("\n").map((x) => x.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return t.split(/(?<=\.)\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
};

const QUOTE_STATUS = {
  REQUESTED: { label: "Requested", cls: "quoted" },
  QUOTED: { label: "Quoted", cls: "quoted" },
  ACCEPTED: { label: "Accepted", cls: "paid" },
  DECLINED: { label: "Declined", cls: "unpaid" },
};

export function quotationToDoc(q) {
  const cur = q.currency || "KES";
  const st = QUOTE_STATUS[q.status] || { label: q.status, cls: "quoted" };
  const items = Array.isArray(q.items) ? q.items : [];
  return {
    kind: "QUOTATION",
    themeVars: "--band:#2E5E8E;--tint:#F6F9FC;--wash:#EBF2F8",
    status: st.label,
    statusClass: st.cls,
    qr: "qr_main",
    qrText: `QSL Quotation ${q.number}\nClient: ${String(q.clientName || "").toUpperCase()}\nTotal: ${cur} ${money(q.grandTotal)}${q.validUntil ? `\nValid until ${fmtDate(q.validUntil)}` : ""}`,
    ref: q.number,
    meta: [
      ["Date", fmtDate(q.quotedAt || q.createdAt, true)],
      ["Quote no.", q.number],
      ["Valid to", q.validUntil ? fmtDate(q.validUntil) : "—"],
    ],
    partyLabel: "Prepared for",
    party: { name: q.clientName || "—", lines: partyLines(q) },
    facts: [
      ["Prepared by", q.preparedByName || "—"],
      ["Currency", cur],
      q.fileNo ? ["File no.", q.fileNo] : null,
    ].filter(Boolean),
    subject: q.subject || "",
    items: items.map((it) => [
      it.description || "",
      String(Number(it.qty || 0)),
      it.unit || "EA",
      money(it.unitPrice),
      money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)),
    ]),
    sums: [
      ["Subtotal", money(q.subtotal), ""],
      ...(Number(q.freight) > 0 ? [["Freight", money(q.freight), ""]] : []),
      [`VAT (${Number(q.vatRate || 0)}%)`, money(q.vatAmount), ""],
    ],
    grand: [`Grand total · ${cur}`, money(q.grandTotal)],
    words: q.amountInWords || "",
    termsTitle: "Terms & notes",
    terms: termsToList(q.terms, [
      "Prices quoted are exclusive of applicable taxes unless otherwise stated.",
      "Delivery timelines commence once the quotation has been accepted and the initial payment has been received.",
    ]),
    legal: "Acceptance is recorded electronically in the QSL system — no signature required.",
  };
}

const INV_STATUS = {
  DRAFT: { label: "Draft", cls: "quoted" },
  UNPAID: { label: "Unpaid", cls: "unpaid" },
  PAID: { label: "Paid", cls: "paid" },
  CANCELLED: { label: "Cancelled", cls: "quoted" },
};

export function invoiceToDoc(inv) {
  const cur = inv.currency || "KES";
  const st = INV_STATUS[inv.status] || { label: inv.status, cls: "unpaid" };
  const items = Array.isArray(inv.items) ? inv.items : [];
  const sums = [["Subtotal", money(inv.subtotal), Number(inv.retentionAmount) > 0 ? "em" : ""]];
  if (Number(inv.retentionAmount) > 0) {
    sums.push([`Less retention ${Number(inv.retentionRate) ? `${Number(inv.retentionRate)}%` : ""}`.trim(), `(${money(inv.retentionAmount)})`, "neg"]);
    sums.push(["Net amount", money(inv.netAmount), "em"]);
  }
  sums.push([`VAT (${Number(inv.vatRate || 0)}%)`, money(inv.vatAmount), ""]);
  return {
    kind: "INVOICE",
    themeVars: "--band:#8A5A1E;--tint:#FCF9F4;--wash:#F6EFE3",
    status: st.label,
    statusClass: st.cls,
    qr: "qr_main",
    qrText: `QSL Invoice ${inv.number}\nClient: ${String(inv.clientName || "").toUpperCase()}\nAmount due: ${cur} ${money(inv.grandTotal)}${inv.ref ? `\nRef: ${inv.ref}` : ""}`,
    ref: inv.number,
    meta: [
      ["Date", fmtDate(inv.issuedAt || inv.createdAt, true)],
      ["Invoice no.", inv.number],
      ...(inv.ref ? [["Ref.", inv.ref]] : []),
      ["Due", inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"],
    ],
    partyLabel: "Bill to",
    party: { name: inv.clientName || "—", lines: partyLines(inv) },
    facts: [
      ["Issued by", inv.issuedByName || "—"],
      ["Currency", cur],
      inv.fileNo ? ["File no.", inv.fileNo] : null,
    ].filter(Boolean),
    subject: inv.subject || "",
    items: items.map((it) => [
      it.description || "",
      String(Number(it.qty || 0)),
      it.unit || "EA",
      money(it.unitPrice),
      money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)),
    ]),
    sums,
    grand: [`Amount due · ${cur}`, money(inv.grandTotal)],
    words: inv.amountInWords || "",
    termsTitle: "Terms & notes",
    terms: termsToList(inv.terms, [
      "Payable within 30 days of the invoice date to the account shown above.",
      "Please quote the invoice number on all remittances.",
      "Retention is released on certification of practical completion.",
    ]),
    legal: inv.notes || `Raised by ${COMPANY.name}. Settlement is recorded electronically in the QSL system.`,
  };
}
