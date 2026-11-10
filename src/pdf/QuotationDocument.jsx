import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY, DEFAULT_PAYMENT_DETAILS, DEFAULT_QUOTE_TERMS } from "@/lib/company";
import {
  R, TopBar, RefinedHeader, TitlePill, Totals, QrSummary, PaymentGrid, TermsNotes,
  RefinedFooter, fmtDate, money,
} from "./refined";

// Status → badge colours for the title row.
const STATUS = {
  REQUESTED: { label: "Requested", bg: R.WAIT, color: "#fff" },
  QUOTED: { label: "Quoted", bg: R.COAL, color: R.GOLD },
  ACCEPTED: { label: "Accepted", bg: R.PASS, color: "#fff" },
  DECLINED: { label: "Declined", bg: R.FAIL, color: "#fff" },
};

// Parse "LABEL: value" payment-details text into {label, value} pairs.
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

// Split a free-text terms string into a numbered list: by line, else by sentence.
function termsToList(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  const byLine = t.split("\n").map((x) => x.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return t.split(/(?<=\.)\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
}

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
  hr: { borderBottomWidth: 0.5, borderBottomColor: R.HAIR, marginTop: 8, marginBottom: 2 },
  ihRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: R.COAL, paddingBottom: 4, paddingTop: 6 },
  ihCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 5 },
  iRow: { flexDirection: "row", minHeight: 20, borderBottomWidth: 0.5, borderBottomColor: R.HAIR },
  iNo: { fontSize: 8, color: R.FAINT, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, textAlign: "center" },
  iDesc: { fontSize: 8.4, color: R.INK, paddingVertical: 5, paddingHorizontal: 5 },
  iC: { fontSize: 8.2, color: R.INK, paddingVertical: 5, paddingHorizontal: 5 },
  iNum: { fontSize: 8.2, color: R.INK, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, textAlign: "right" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, marginBottom: 14 },
  words: { fontSize: 8, fontFamily: "Helvetica-Bold", color: R.INK, marginBottom: 8 },
  decided: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 6 },
});

const COLW = { no: "6%", desc: "46%", qty: "9%", unit: "9%", rate: "15%", amt: "15%" };

export function QuotationDocument({ quotation, logoSrc, qrSrc, internal = false }) {
  const q = quotation;
  const st = STATUS[q.status] || { label: q.status, bg: R.COAL, color: "#fff" };
  const items = Array.isArray(q.items) ? q.items : [];
  const cur = q.currency || "KES";
  const payPairs = parsePayPairs(q.paymentDetails || DEFAULT_PAYMENT_DETAILS);
  const termsList = termsToList(q.terms || DEFAULT_QUOTE_TERMS);

  const meta = [
    { k: "Date", v: fmtDate(q.quotedAt || q.createdAt, true) },
    { k: "No.", v: q.number, mono: true },
    { k: "Valid to", v: q.validUntil ? fmtDate(q.validUntil) : "—" },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <TopBar kind="quotation" />
        <RefinedHeader logoSrc={logoSrc} meta={meta} />
        <TitlePill title="Quotation" status={st} />

        {/* Parties */}
        <View style={s.partyRow}>
          <View style={s.partyLeft}>
            <Text style={s.pLabel}>Prepared for</Text>
            <Text style={s.pName}>{q.clientName || "—"}</Text>
            {q.siteName ? <Text style={s.pLine}>Site: {q.siteName}</Text> : null}
            {q.contactPerson ? <Text style={s.pLine}>Attn: {q.contactPerson}</Text> : null}
            {q.contactEmail ? <Text style={s.pLine}>{q.contactEmail}</Text> : null}
            {q.contactPhone ? <Text style={s.pLine}>{q.contactPhone}</Text> : null}
          </View>
          <View style={s.partyRight}>
            <View style={s.rRow}><Text style={s.rK}>Prepared by</Text><Text style={s.rV}>{q.preparedByName || "—"}</Text></View>
            <View style={s.rRow}><Text style={s.rK}>Currency</Text><Text style={s.rV}>{cur}</Text></View>
            {q.fileNo ? (
              <View style={[s.rRow, { borderBottomWidth: 0 }]}><Text style={s.rK}>Staff quote no.</Text><Text style={s.rV}>{q.fileNo}</Text></View>
            ) : (
              <View style={[s.rRow, { borderBottomWidth: 0 }]}><Text style={s.rK}>Items</Text><Text style={s.rV}>{items.length}</Text></View>
            )}
          </View>
        </View>

        {q.subject ? (
          <>
            <Text style={s.subjectLabel}>Subject</Text>
            <Text style={s.subjectText}>{q.subject}</Text>
          </>
        ) : null}

        {/* Line items */}
        <View style={s.ihRow}>
          <Text style={[s.ihCell, { width: COLW.no, textAlign: "center" }]}>No</Text>
          <Text style={[s.ihCell, { width: COLW.desc }]}>Description</Text>
          <Text style={[s.ihCell, { width: COLW.qty, textAlign: "center" }]}>Qty</Text>
          <Text style={[s.ihCell, { width: COLW.unit }]}>Unit</Text>
          <Text style={[s.ihCell, { width: COLW.rate, textAlign: "right" }]}>Rate</Text>
          <Text style={[s.ihCell, { width: COLW.amt, textAlign: "right" }]}>Amount</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={[s.iRow, { backgroundColor: i % 2 ? R.ACCENT.quotation.tint : "#fff" }]} wrap={false}>
            <Text style={[s.iNo, { width: COLW.no }]}>{i + 1}</Text>
            <Text style={[s.iDesc, { width: COLW.desc }]}>{it.description}</Text>
            <Text style={[s.iC, { width: COLW.qty, textAlign: "center" }]}>{Number(it.qty || 0).toLocaleString()}</Text>
            <Text style={[s.iC, { width: COLW.unit }]}>{it.unit || "EA"}</Text>
            <Text style={[s.iNum, { width: COLW.rate }]}>{money(it.unitPrice)}</Text>
            <Text style={[s.iNum, { width: COLW.amt }]}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</Text>
          </View>
        ))}

        {/* QR summary + totals */}
        <View style={s.sumRow} wrap={false}>
          <QrSummary qrSrc={qrSrc} />
          <Totals
            rows={[
              { k: "Subtotal", v: money(q.subtotal) },
              ...(Number(q.freight) > 0 ? [{ k: "Freight", v: money(q.freight) }] : []),
              { k: `VAT (${Number(q.vatRate || 0)}%)`, v: money(q.vatAmount) },
            ]}
            grand={{ k: `GRAND TOTAL · ${cur}`, v: money(q.grandTotal) }}
          />
        </View>

        {q.amountInWords ? <Text style={s.words}>Amount in words: {q.amountInWords}</Text> : null}

        <PaymentGrid pairs={payPairs} />
        <View style={{ height: 10 }} />
        <TermsNotes items={termsList} />

        {q.status === "ACCEPTED" ? (
          <Text style={[s.decided, { color: R.PASS }]}>ACCEPTED by the client on {fmtDate(q.decidedAt, true)}.</Text>
        ) : q.status === "DECLINED" ? (
          <Text style={[s.decided, { color: R.FAIL }]}>DECLINED by the client on {fmtDate(q.decidedAt, true)}.</Text>
        ) : null}

        <RefinedFooter serial={q.number} note="Acceptance is recorded electronically in the QSL system — no signature required." />
      </Page>

      {/* Client's uploaded Local Purchase Order, on its own page. */}
      {q.lpoImage && /^data:image\//.test(q.lpoImage) ? (
        <Page size="A4" style={s.page} wrap>
          <TopBar kind="quotation" />
          <RefinedHeader logoSrc={logoSrc} meta={meta} />
          <TitlePill title="Local Purchase Order" status={{ label: q.number, bg: R.COAL, color: R.GOLD }} />
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={q.lpoImage} style={{ marginTop: 6, maxWidth: "100%", maxHeight: 700, objectFit: "contain" }} />
          <RefinedFooter serial={q.number} />
        </Page>
      ) : null}
    </Document>
  );
}
