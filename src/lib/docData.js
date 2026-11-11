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
    pin: COMPANY.pin || "",
    // Footer control note. Templates read either `systemNote` (report,
    // statement) or `sysNote` (purchase order); supply both so neither is blank.
    systemNote: "System-generated — No physical signature required. Records are captured electronically in the QSL system.",
    sysNote: "System-generated document — No physical signature required. Issued subject to the Conditions of Purchase overleaf.",
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

// ── Technical Report (TR01) ──────────────────────────────────────────────
// Maps a Report record onto the technical-report.html template contract.

const REPORT_STATE = {
  PENDING_SUPERVISOR: "review",
  PENDING_MANAGER: "review",
  PENDING_CLIENT: "approved", // QSL has approved it; awaiting client signature
  CLIENT_RETURNED: "review",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// Photos usable in a PDF (data-URL images), kept in display order. Both this
// mapper and the asset builder (reportPdf.js) iterate this identically, so each
// photo's `src` key (p1, p2, …) lines up with the injected base64 asset.
export function usablePhotos(report) {
  return (report?.photos || []).filter((p) => String(p?.dataUrl || "").startsWith("data:image"));
}

const splitLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

const gpsOf = (p) =>
  p && p.gpsLat != null && p.gpsLng != null
    ? `${Number(p.gpsLat).toFixed(5)}, ${Number(p.gpsLng).toFixed(5)}`
    : "";

// Build the approval trail from the report's real history. Unknown / non-stage
// events (Edited, CREATE, UPDATE) are skipped; a pending stage is appended when
// the report has not reached a terminal state, so the trail never reads empty.
function techTrail(report) {
  const rows = [];
  for (const e of report.trailEvents || []) {
    const a = String(e.action || "");
    if (/^edited$/i.test(a) || /^(CREATE|UPDATE)$/.test(a)) continue;
    if (/^submitted$/i.test(a)) {
      rows.push({ role: "Service engineer", by: e.byName, state: "Submitted", st: "done" });
    } else if (/returned|rejected/i.test(a)) {
      const client = /client/i.test(a);
      rows.push({ role: client ? "Client" : "Approving manager", by: e.byName, state: client ? "Returned with comment" : "Returned for correction", st: "now" });
    } else if (/client approved/i.test(a)) {
      rows.push({ role: "Client", by: e.byName, state: "Approved & signed", st: "done" });
    } else if (/sent to client/i.test(a)) {
      rows.push({ role: "Issued to client", by: e.byName, state: "Sent for signature", st: "done" });
    } else if (/approved/i.test(a)) {
      rows.push({ role: "Approving manager", by: e.byName, state: "Approved", st: "done" });
    } else {
      rows.push({ role: "—", by: e.byName, state: a, st: "done" });
    }
  }
  if (!rows.length) rows.push({ role: "Service engineer", by: report.authorName || "—", state: "Submitted", st: "done" });
  // Append the one stage the report is currently waiting on, named for the real
  // status — but only if the history hasn't already recorded an open stage.
  const pending =
    report.status === "PENDING_SUPERVISOR" || report.status === "PENDING_MANAGER"
      ? { role: "Approving manager", by: "— pending —", state: "Pending review", st: "now" }
      : report.status === "PENDING_CLIENT"
      ? { role: "Client", by: "— awaiting —", state: "Awaiting signature", st: "now" }
      : report.status === "CLIENT_RETURNED"
      ? { role: "Approving manager", by: "— pending —", state: "Re-review after client return", st: "now" }
      : null;
  if (pending && !rows.some((r) => r.st === "now")) rows.push(pending);
  return rows;
}

// Third kvTable element: "" = normal, "soft" = grey "— not captured —", true =
// red (a compliance gap). Optional fields go soft when blank; the instrument
// serial is a Cap. 513 identity, so a missing one is flagged red.
export function reportToTechDoc(report) {
  const v = (report.data && report.data.values) || {};
  const g = (report.data && report.data.grids) || {};
  const serviceDate = report.reportDate || report.createdAt;
  const nature = String(v.natureOfVisit || "").trim();
  const timeIn = g["jobTime:0:0"];
  const timeOut = g["jobTime:0:1"];
  const mileage = g["jobTime:0:2"];

  const clientRows = [
    ["Client / Site", [report.clientName, report.site].filter(Boolean).join(" — ") || "—"],
    ["Contact person", v.contactPerson || "", v.contactPerson ? "" : "soft"],
    ["Contact", v.telNo || "", v.telNo ? "" : "soft"],
    ["Machine model", v.machineModel || "", v.machineModel ? "" : "soft"],
    ["Serial no.", v.machineSerial || "Not recorded", v.machineSerial ? "" : true],
    ["Capacity", v.machineCapacity || "", v.machineCapacity ? "" : "soft"],
  ];

  const qslRows = [
    ["Report type", "Field service / calibration visit (TR01)"],
    ["Nature of visit", nature, nature ? "" : "soft"],
    ["Vehicle no.", v.vehicleNo || "", v.vehicleNo ? "" : "soft"],
    ["Completed by", report.authorName || ""],
    ["Time in", timeIn || "", timeIn ? "" : "soft"],
    ["Time out", timeOut || "", timeOut ? "" : "soft"],
    ["Mileage", mileage || "", mileage ? "" : "soft"],
  ];

  const details = [
    ["Fault reported", splitLines(v.faultReported)],
    ["Findings", splitLines(v.findings)],
    ["Correction", splitLines(v.correction)],
    ["Final result", splitLines(v.finalResult)],
  ];
  const followUp = [["Parts to order", splitLines(v.partsToOrder)]];

  const cc = String(v.customerComments || "").trim();
  const customerComment = cc
    ? { text: cc, by: v.contactPerson || report.clientName || "", title: v.contactPerson ? "Contact person" : "", at: fmtDate(serviceDate, true) }
    : null;

  const photos = usablePhotos(report).map((p, i) => ({
    src: `p${i + 1}`,
    desc: p.caption || "",
    at: fmtDate(p.takenAt || serviceDate, true),
    gps: gpsOf(p),
  }));

  return {
    kind: "Technical Report",
    state: REPORT_STATE[report.status] || "review",
    ref: report.serial,
    meta: [
      ["Date", fmtDate(serviceDate, true)],
      ["Report no.", report.serial],
    ],
    generated: fmtDate(report.createdAt, true),
    clientRows,
    qslRows,
    details,
    followUp,
    customerComment,
    photos,
    trail: techTrail(report),
  };
}

// ── Statement of Account (financial, from invoices) ──────────────────────
// Maps a client's invoice history onto the statement.html ledger contract.
// We have no separate receipts ledger, so each issued invoice is a debit on its
// issue date and a PAID invoice is a credit on its real paidAt timestamp — the
// running balance therefore reconciles to the true amount outstanding, and the
// aging buckets are computed from the same "outstanding as at asOf" set.
export function invoiceStatement({ clientName, client, invoices = [], from, to, ref, qrKey = "qr1" }) {
  const cur = invoices.find((i) => i.currency)?.currency || "KES";
  const fromD = from ? new Date(`${from}T00:00:00`) : null;
  const toD = to ? new Date(`${to}T23:59:59`) : null;
  const asOfD = toD || new Date();

  // One signed event per ledger movement (debit +, credit −).
  const events = [];
  for (const inv of invoices) {
    if (inv.status === "CANCELLED" || inv.status === "DRAFT" || !inv.issuedAt) continue;
    events.push({ at: new Date(inv.issuedAt), type: "inv", ref: inv.number, amt: Number(inv.grandTotal) || 0, due: inv.dueDate ? new Date(inv.dueDate) : null });
    if (inv.status === "PAID" && inv.paidAt) {
      events.push({ at: new Date(inv.paidAt), type: "pay", ref: `Payment — ${inv.number}`, amt: -(Number(inv.grandTotal) || 0) });
    }
  }
  // Chronological; an invoice precedes a payment that lands the same day, and
  // two movements of the same kind keep their original (issue) order.
  const rank = (t) => (t === "inv" ? 0 : 1);
  events.sort((a, b) => a.at - b.at || rank(a.type) - rank(b.type));

  // Everything before the window collapses into the opening balance.
  let opening = 0;
  const inWindow = [];
  for (const e of events) {
    if (toD && e.at > toD) continue; // beyond the statement date
    if (fromD && e.at < fromD) opening += e.amt;
    else inWindow.push(e);
  }

  const tx = [{ date: fmtDate(fromD || inWindow[0]?.at || asOfD), type: "opn", ref: "Opening balance", bal: money(opening), neg: opening < 0 }];
  let running = opening;
  let invoicedSum = 0;
  let paidSum = 0;
  for (const e of inWindow) {
    running += e.amt;
    if (e.type === "inv") invoicedSum += e.amt;
    else paidSum += -e.amt;
    tx.push({
      date: fmtDate(e.at),
      type: e.type,
      ref: e.ref,
      ...(e.type === "inv" ? { dr: money(e.amt) } : { cr: money(-e.amt) }),
      bal: money(running),
      neg: running < 0,
      ...(e.due ? { due: fmtDate(e.due) } : {}),
    });
  }

  // Aging: invoices still outstanding as at asOf, bucketed by days past due
  // (due date, or the issue date when no due date was set).
  const b = { current: 0, d30: 0, d60: 0, d90: 0, over: 0 };
  for (const inv of invoices) {
    if (inv.status === "CANCELLED" || inv.status === "DRAFT" || !inv.issuedAt) continue;
    if (new Date(inv.issuedAt) > asOfD) continue;
    const paidByAsOf = inv.paidAt && new Date(inv.paidAt) <= asOfD;
    if (paidByAsOf) continue;
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issuedAt);
    const days = Math.floor((asOfD - due) / 86400000);
    const amt = Number(inv.grandTotal) || 0;
    if (days <= 0) b.current += amt;
    else if (days <= 30) b.d30 += amt;
    else if (days <= 60) b.d60 += amt;
    else if (days <= 90) b.d90 += amt;
    else b.over += amt;
  }

  const addrLines = [client?.address, [client?.city, client?.country].filter(Boolean).join(", ")]
    .map((l) => String(l || "").trim())
    .filter(Boolean);

  return {
    ref,
    qr: qrKey,
    from: fromD ? fmtDate(fromD) : fmtDate(inWindow[0]?.at || asOfD),
    to: fmtDate(asOfD),
    asOf: fmtDate(asOfD),
    currency: cur,
    client: { name: clientName || "—", lines: addrLines, pin: client?.taxPin || "" },
    summary: [
      ["Opening balance", money(opening)],
      ["Invoiced", money(invoicedSum)],
      ["Paid", money(paidSum)],
    ],
    balanceDue: money(running),
    tx,
    aging: [
      ["Current", money(b.current)],
      ["1 – 30", money(b.d30)],
      ["31 – 60", money(b.d60)],
      ["61 – 90", money(b.d90)],
      ["Over 90", money(b.over), "aged"],
    ],
    // QR summary text (the template also derives this, but we pre-render the image).
    qrText: [
      "QSL Statement of Account",
      `${ref} · ${clientName || "—"}`,
      `Balance due ${cur} ${money(running)} as at ${fmtDate(asOfD)}`,
    ].join("\n"),
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

// ── Local Purchase Order (LPO) ───────────────────────────────────────────
// Maps an Lpo record onto the local-purchase-order.html contract. The static
// Conditions of Purchase live in the template; we supply the order + auth only.

const LPO_STATE = {
  DRAFT: "pending",
  PENDING: "pending",
  APPROVED: "approved",
  CANCELLED: "cancelled",
};

function lpoAuth(lpo) {
  const rows = [
    { role: "Raised by", by: lpo.raisedByName || "Procurement", state: "Submitted", st: "done" },
  ];
  if (lpo.status === "APPROVED") {
    rows.push({ role: "Approved by", by: lpo.approvedByName || "—", state: "Approved", st: "done" });
  } else if (lpo.status === "CANCELLED") {
    rows.push({ role: "Approved by", by: lpo.approvedByName || "—", state: "Cancelled", st: "now" });
  } else {
    rows.push({ role: "Approved by", by: lpo.approvedByName || "— pending —", state: "Pending approval", st: "now" });
  }
  if (lpo.notedByName) rows.push({ role: "Noted by", by: lpo.notedByName, state: "For oversight", st: "now" });
  return rows;
}

export function lpoToDoc(lpo) {
  const cur = lpo.currency || "KES";
  const items = Array.isArray(lpo.items) ? lpo.items : [];
  return {
    ref: lpo.number,
    rev: lpo.conditionsRev || "GTB v1.0",
    state: LPO_STATE[lpo.status] || "pending",
    currency: cur,
    meta: [
      ["LPO no.", lpo.number],
      ["Date", fmtDate(lpo.issuedAt || lpo.createdAt)],
      ["Required by", lpo.requiredBy ? fmtDate(lpo.requiredBy) : "—"],
    ],
    supplier: [
      ["Supplier", lpo.supplierName || "—"],
      ["Contact", lpo.supplierContact || "—"],
      ["Tel.", lpo.supplierTel || "—"],
      // eTIMS invoicing needs the supplier's PIN — flag a missing one in red.
      ["PIN no.", lpo.supplierPin || "Not supplied", lpo.supplierPin ? false : true],
    ],
    order: [
      ["Deliver to", lpo.deliverTo || "QSL Centre, Birdi Singh Complex, Nairobi"],
      ["Delivery date", lpo.deliveryDate ? fmtDate(lpo.deliveryDate) : "—"],
      ["Payment terms", lpo.paymentTerms || "30 days from valid eTIMS invoice"],
      ["Your quotation", lpo.supplierQuoteRef || "—"],
      ["Buyer", lpo.buyerName || "Procurement — QSL"],
    ],
    items: items.map((it) => [
      it.description || "",
      String(Number(it.qty || 0)),
      it.unit || "EA",
      money(it.unitPrice),
      money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)),
    ]),
    sums: [
      ["Subtotal", money(lpo.subtotal)],
      [`VAT (${Number(lpo.vatRate || 0)}%)`, money(lpo.vatAmount)],
    ],
    grand: [`Order total · ${cur}`, money(lpo.grandTotal)],
    notes:
      lpo.notes ||
      "Deliver within QSL receiving hours (08:00–16:00, Mon–Fri). Quote the LPO number on the delivery note and the invoice.",
    auth: lpoAuth(lpo),
    // QR summary (the template derives the same; we pre-render the image).
    qrText: [
      "QSL Purchase Order",
      `${lpo.number} · ${lpo.supplierName || "—"}`,
      `Order total ${cur} ${money(lpo.grandTotal)}`,
      `Required by ${lpo.requiredBy ? fmtDate(lpo.requiredBy) : "—"}`,
    ].join("\n"),
  };
}
