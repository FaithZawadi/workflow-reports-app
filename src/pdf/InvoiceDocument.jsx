import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY, DEFAULT_PAYMENT_DETAILS } from "@/lib/company";
import {
  R, TopBar, RefinedHeader, TitlePill, Totals, QrSummary, PaymentGrid, TermsNotes,
  RefinedFooter, fmtDate, money,
} from "./refined";

const STATUS = {
  DRAFT: { label: "Draft", bg: R.MUTE, color: "#fff" },
  UNPAID: { label: "Unpaid", bg: "#C62828", color: "#fff" },
  PAID: { label: "Paid", bg: R.PASS, color: "#fff" },
  CANCELLED: { label: "Cancelled", bg: R.COAL, color: R.GOLD },
};

function parsePayPairs(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const i = line.indexOf(":");
      if (i < 0) return null;
      const label = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean);
}

function termsToList(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  const byLine = t.split("\n").map((x) => x.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return t.split(/(?<=\.)\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
}

const DEFAULT_INVOICE_TERMS = [
  "Payable within 30 days of the invoice date to the account shown above.",
  "Please quote the invoice number on all remittances.",
  "Retention is released on certification of practical completion.",
];

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 80, paddingHorizontal: 34, fontSize: 9, color: R.INK, fontFamily: "Helvetica" },
  partyRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, marginBottom: 8 },
  partyLeft: { width: "50%", paddingRight: 14 },
  partyRight: { width: "46%" },
  pLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  pName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: R.COAL },
  pLine: { fontSize: 8.2, color: R.INK, marginTop: 2 },
  rRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: R.HAIR, paddingVertical: 4.5 },
  rK: { fontSize: 8.4, color: R.MUTE },
  rV: { fontSize: 8.6, fontFamily: "Helvetica-Bold", color: R.COAL },
  subjectLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 },
  subjectText: { fontSize: 11, fontFamily: "Helvetica-Bold", color: R.COAL, marginTop: 2 },
  ihRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: R.COAL, paddingBottom: 4, paddingTop: 6 },
  ihCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 5 },
  iRow: { flexDirection: "row", minHeight: 20, borderBottomWidth: 0.5, borderBottomColor: R.HAIR },
  iNo: { fontSize: 8, color: R.FAINT, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, textAlign: "center" },
  iDesc: { fontSize: 8.4, color: R.INK, paddingVertical: 5, paddingHorizontal: 5 },
  iC: { fontSize: 8.2, color: R.INK, paddingVertical: 5, paddingHorizontal: 5 },
  iNum: { fontSize: 8.2, color: R.INK, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, textAlign: "right" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, marginBottom: 14 },
  words: { fontSize: 8, fontFamily: "Helvetica-Bold", color: R.INK, marginBottom: 8 },
});

const COLW = { no: "6%", desc: "46%", qty: "9%", unit: "9%", rate: "15%", amt: "15%" };

export function InvoiceDocument({ invoice, logoSrc, qrSrc }) {
  const inv = invoice;
  const st = STATUS[inv.status] || { label: inv.status, bg: R.COAL, color: "#fff" };
  const items = Array.isArray(inv.items) ? inv.items : [];
  const cur = inv.currency || "KES";
  const payPairs = parsePayPairs(inv.paymentDetails || DEFAULT_PAYMENT_DETAILS);
  const termsList = inv.terms ? termsToList(inv.terms) : DEFAULT_INVOICE_TERMS;

  const meta = [
    { k: "Date", v: fmtDate(inv.issuedAt || inv.createdAt, true) },
    { k: "No.", v: inv.number, mono: true },
    ...(inv.ref ? [{ k: "Ref", v: inv.ref, mono: true }] : []),
    { k: "Due", v: inv.dueDate ? fmtDate(inv.dueDate) : "On receipt" },
  ];

  const totalsRows = [
    { k: items.length ? "Subtotal" : "Subtotal", v: money(inv.subtotal) },
    ...(Number(inv.retentionAmount) > 0
      ? [
          { k: `Less retention ${Number(inv.retentionRate) ? `${Number(inv.retentionRate)}%` : ""}`.trim(), v: `(${money(inv.retentionAmount)})` },
          { k: "Net amount", v: money(inv.netAmount), strong: true },
        ]
      : []),
    { k: `VAT (${Number(inv.vatRate || 0)}%)`, v: money(inv.vatAmount) },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <TopBar kind="invoice" />
        <RefinedHeader logoSrc={logoSrc} meta={meta} />
        <TitlePill title="Invoice" status={st} />

        <View style={s.partyRow}>
          <View style={s.partyLeft}>
            <Text style={s.pLabel}>Bill to</Text>
            <Text style={s.pName}>{inv.clientName || "—"}</Text>
            {inv.siteName ? <Text style={s.pLine}>Site: {inv.siteName}</Text> : null}
            {inv.contactPerson ? <Text style={s.pLine}>Attn: {inv.contactPerson}</Text> : null}
            {inv.contactEmail ? <Text style={s.pLine}>{inv.contactEmail}</Text> : null}
            {inv.contactPhone ? <Text style={s.pLine}>{inv.contactPhone}</Text> : null}
          </View>
          <View style={s.partyRight}>
            <View style={s.rRow}><Text style={s.rK}>Issued by</Text><Text style={s.rV}>{inv.issuedByName || "—"}</Text></View>
            <View style={s.rRow}><Text style={s.rK}>Currency</Text><Text style={s.rV}>{cur}</Text></View>
            {inv.fileNo ? (
              <View style={[s.rRow, { borderBottomWidth: 0 }]}><Text style={s.rK}>Staff invoice no.</Text><Text style={s.rV}>{inv.fileNo}</Text></View>
            ) : (
              <View style={[s.rRow, { borderBottomWidth: 0 }]}><Text style={s.rK}>Items</Text><Text style={s.rV}>{items.length}</Text></View>
            )}
          </View>
        </View>

        {inv.subject ? (
          <>
            <Text style={s.subjectLabel}>Subject</Text>
            <Text style={s.subjectText}>{inv.subject}</Text>
          </>
        ) : null}

        <View style={s.ihRow}>
          <Text style={[s.ihCell, { width: COLW.no, textAlign: "center" }]}>No</Text>
          <Text style={[s.ihCell, { width: COLW.desc }]}>Description</Text>
          <Text style={[s.ihCell, { width: COLW.qty, textAlign: "center" }]}>Qty</Text>
          <Text style={[s.ihCell, { width: COLW.unit }]}>Unit</Text>
          <Text style={[s.ihCell, { width: COLW.rate, textAlign: "right" }]}>Rate</Text>
          <Text style={[s.ihCell, { width: COLW.amt, textAlign: "right" }]}>Amount</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={[s.iRow, { backgroundColor: i % 2 ? R.ACCENT.invoice.tint : "#fff" }]} wrap={false}>
            <Text style={[s.iNo, { width: COLW.no }]}>{i + 1}</Text>
            <Text style={[s.iDesc, { width: COLW.desc }]}>{it.description}</Text>
            <Text style={[s.iC, { width: COLW.qty, textAlign: "center" }]}>{Number(it.qty || 0).toLocaleString()}</Text>
            <Text style={[s.iC, { width: COLW.unit }]}>{it.unit || "EA"}</Text>
            <Text style={[s.iNum, { width: COLW.rate }]}>{money(it.unitPrice)}</Text>
            <Text style={[s.iNum, { width: COLW.amt }]}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</Text>
          </View>
        ))}

        <View style={s.sumRow} wrap={false}>
          <QrSummary qrSrc={qrSrc} />
          <Totals rows={totalsRows} grand={{ k: `AMOUNT DUE · ${cur}`, v: money(inv.grandTotal) }} />
        </View>

        {inv.amountInWords ? <Text style={s.words}>Amount in words: {inv.amountInWords}</Text> : null}

        <PaymentGrid pairs={payPairs} />
        <View style={{ height: 10 }} />
        <TermsNotes items={termsList} />

        <RefinedFooter
          serial={inv.number}
          note={inv.notes || `Raised by ${COMPANY.name}. Settlement is recorded electronically in the QSL system.`}
        />
      </Page>
    </Document>
  );
}
