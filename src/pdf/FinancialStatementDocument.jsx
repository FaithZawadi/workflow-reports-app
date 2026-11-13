import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { PdfHeader } from "./shared";
import { QrSummary, RefinedFooter } from "./refined";

// Financial Statement of Account in the bordered document layout (matching the
// quotation / invoice): a boxed account card, an account-summary panel, a
// black-header transactions ledger, a coal balance-due bar, an aging strip and
// the bordered payment table — with the inline "Document summary" QR and the
// ISO footer. Consumes the statement object produced by invoiceStatement().

const GOLD = "#F5A800";
const GOLD_DK = "#8A6A00";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const CREDIT = "#2E7D46";
const FLAG = "#B03A2E";

const TYPE_LABEL = { inv: "Invoice", pay: "Payment", opn: "" };

const num = (v) => parseFloat(String(v).replace(/,/g, "")) || 0;
function statementState(s) {
  if (num(s.balanceDue) <= 0) return { label: "SETTLED", color: CREDIT };
  const overdue = (s.aging || []).slice(1).reduce((t, b) => t + num(b[1]), 0);
  return overdue > 0 ? { label: "PAST DUE", color: FLAG } : { label: "CURRENT", color: COAL };
}

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
function payBands(pairs, max = 5) {
  const n = pairs.length;
  if (n === 0) return [];
  const bands = Math.ceil(n / max);
  const per = Math.ceil(n / bands);
  const out = [];
  for (let i = 0; i < n; i += per) out.push(pairs.slice(i, i + per));
  return out;
}
function PayTable({ pairs }) {
  const bands = payBands(pairs);
  if (!bands.length) return null;
  return (
    <View style={s.payWrap} wrap={false}>
      <View style={s.payBanner}>
        <View style={s.payBannerDot} />
        <Text style={s.payBannerText}>Payment details</Text>
      </View>
      <View style={s.payTable}>
        {bands.map((band, bi) => {
          const w = `${100 / band.length}%`;
          const lastBand = bi === bands.length - 1;
          return (
            <View key={bi}>
              <View style={s.payBand}>
                {band.map((p, ci) => (
                  <View key={ci} style={[s.payHeadCell, { width: w }, ci === band.length - 1 ? { borderRightWidth: 0 } : null]}>
                    <Text style={s.payHeadText}>{p.label}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.payBand, lastBand ? null : { borderBottomWidth: 0.5, borderBottomColor: "#C9C1B0" }]}>
                {band.map((p, ci) => (
                  <View key={ci} style={[s.payValCell, { width: w }, ci === band.length - 1 ? { borderRightWidth: 0 } : null]}>
                    <Text style={s.payValText}>{p.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 74, paddingHorizontal: 32, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  titleBadge: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL, backgroundColor: GOLD, paddingVertical: 3, paddingHorizontal: 12, letterSpacing: 1, textTransform: "uppercase" },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 2 },
  // Account card.
  card: { flexDirection: "row", marginTop: 12, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  acctMain: { width: "55%", padding: 8, borderRightWidth: 0.7, borderRightColor: "#C9C1B0" },
  acctLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: MUTE, letterSpacing: 0.8, marginBottom: 3 },
  acctName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COAL },
  acctLine: { fontSize: 8, color: INK, marginTop: 2 },
  acctSide: { width: "45%" },
  sumRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#C9C1B0", minHeight: 15, alignItems: "center" },
  sumK: { width: "48%", alignSelf: "stretch", backgroundColor: "#FAF4E6", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COAL, borderRightWidth: 0.5, borderRightColor: "#C9C1B0" },
  sumV: { width: "52%", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 8, color: INK, fontFamily: "Courier-Bold", textAlign: "right" },
  sumVbold: { color: COAL, fontSize: 8.5 },
  // Transactions table.
  secLabel: { marginTop: 14, flexDirection: "row", alignItems: "center" },
  secDot: { width: 7, height: 7, borderRadius: 1.5, backgroundColor: GOLD_DK, marginRight: 5 },
  secText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.6 },
  secNote: { fontSize: 7.5, color: MUTE, marginLeft: 4 },
  table: { marginTop: 6, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  head: { flexDirection: "row", backgroundColor: COAL },
  hCell: { color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: GOLD_DK },
  tr: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#C9C1B0", alignItems: "stretch", minHeight: 17 },
  trAlt: { backgroundColor: "#FBF8F1" },
  trOpen: { backgroundColor: "#F5EEDD" },
  cell: { fontSize: 8, color: INK, paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center" },
  cellNum: { fontSize: 8, color: INK, fontFamily: "Courier-Bold", paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center", textAlign: "right" },
  typePill: { fontSize: 6.6, fontFamily: "Helvetica-Bold", color: "#fff", backgroundColor: COAL, paddingVertical: 1.5, paddingHorizontal: 4, borderRadius: 2, textTransform: "uppercase", alignSelf: "flex-start" },
  typePillPay: { backgroundColor: CREDIT },
  due: { fontSize: 6.8, color: MUTE },
  // Balance-due bar.
  dueBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COAL, paddingVertical: 7, paddingHorizontal: 10, marginTop: 8, borderRadius: 3 },
  dueK: { fontSize: 9, color: GOLD, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  dueAsOf: { fontSize: 7, color: "#C9C1B0", marginLeft: 6 },
  dueV: { fontSize: 11.5, color: "#fff", fontFamily: "Courier-Bold" },
  // Aging strip.
  agingWrap: { flexDirection: "row", marginTop: 10, borderWidth: 0.6, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  agCell: { flex: 1, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#C9C1B0", alignItems: "center" },
  agK: { fontSize: 6.6, fontFamily: "Helvetica-Bold", color: MUTE, textTransform: "uppercase", letterSpacing: 0.4 },
  agV: { fontSize: 8.4, fontFamily: "Courier-Bold", color: INK, marginTop: 2 },
  agAged: { backgroundColor: "#FBEDEC" },
  agAgedV: { color: FLAG },
  agTotal: { backgroundColor: "#F5EEDD" },
  agTotalV: { color: COAL },
  // Payment table.
  payWrap: { marginTop: 12 },
  payBanner: { backgroundColor: COAL, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  payBannerDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: GOLD, marginRight: 6 },
  payBannerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 1 },
  payTable: { borderWidth: 0.6, borderColor: "#C9C1B0", borderTopWidth: 0, overflow: "hidden" },
  payBand: { flexDirection: "row" },
  payHeadCell: { backgroundColor: "#22201C", paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: GOLD_DK, borderBottomWidth: 0.5, borderBottomColor: GOLD_DK, justifyContent: "center" },
  payHeadText: { fontSize: 6.6, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },
  payValCell: { paddingVertical: 6, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#C9C1B0", justifyContent: "center" },
  payValText: { fontSize: 8.2, fontFamily: "Helvetica-Bold", color: INK, textAlign: "center" },
  legal: { marginTop: 12, fontSize: 7.6, color: MUTE, lineHeight: 1.4 },
});

export function FinancialStatementDocument({ statement, logoSrc, qrSrc }) {
  const d = statement;
  const st = statementState(d);
  const cur = d.currency || "KES";
  const tx = Array.isArray(d.tx) ? d.tx : [];
  const payPairs = parsePayPairs(
    [
      COMPANY.bank?.accountName ? `Account name: ${COMPANY.bank.accountName}` : null,
      COMPANY.bank?.name ? `Bank: ${COMPANY.bank.name}` : null,
      COMPANY.bank?.branch ? `Branch: ${COMPANY.bank.branch}` : null,
      COMPANY.bank?.accountNo ? `A/C no: ${COMPANY.bank.accountNo}` : null,
      COMPANY.bank?.paybill ? `Paybill: ${COMPANY.bank.paybill}` : null,
      COMPANY.pin ? `PIN no: ${COMPANY.pin}` : null,
    ].filter(Boolean).join("\n")
  );

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <PdfHeader
          logoSrc={logoSrc}
          contactLines={[
            `${COMPANY.postal || COMPANY.address} · ${COMPANY.website}`,
            `${COMPANY.email} · ${COMPANY.phone}${COMPANY.pin ? ` · PIN ${COMPANY.pin}` : ""}`,
          ]}
          meta={[
            { k: "STATEMENT", v: d.ref, mono: true },
            { k: "PERIOD", v: `${d.from} – ${d.to}` },
            { k: "AS AT", v: d.asOf },
          ]}
        />

        <View style={s.titleRow}>
          <Text style={s.titleBadge}>Statement</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>

        {/* Account + summary card */}
        <View style={s.card}>
          <View style={s.acctMain}>
            <Text style={s.acctLabel}>STATEMENT TO</Text>
            <Text style={s.acctName}>{d.client?.name || "-"}</Text>
            {(d.client?.lines || []).map((l, i) => <Text key={i} style={s.acctLine}>{l}</Text>)}
            {d.client?.pin ? <Text style={s.acctLine}>PIN: {d.client.pin}</Text> : null}
          </View>
          <View style={s.acctSide}>
            {(d.summary || []).map(([k, v], i) => (
              <View key={i} style={s.sumRow}><Text style={s.sumK}>{k}</Text><Text style={s.sumV}>{cur} {v}</Text></View>
            ))}
            <View style={[s.sumRow, { borderBottomWidth: 0 }]}><Text style={s.sumK}>Balance due</Text><Text style={[s.sumV, s.sumVbold]}>{cur} {d.balanceDue}</Text></View>
          </View>
        </View>

        {/* Transactions ledger */}
        <View style={s.secLabel}>
          <View style={s.secDot} />
          <Text style={s.secText}>Transactions</Text>
          <Text style={s.secNote}>· {tx.length}</Text>
        </View>
        <View style={s.table}>
          <View style={s.head}>
            <Text style={[s.hCell, { width: "16%" }]}>DATE</Text>
            <Text style={[s.hCell, { width: "13%" }]}>TYPE</Text>
            <Text style={[s.hCell, { width: "31%" }]}>REFERENCE</Text>
            <Text style={[s.hCell, { width: "13%", textAlign: "right" }]}>DEBIT</Text>
            <Text style={[s.hCell, { width: "13%", textAlign: "right" }]}>CREDIT</Text>
            <Text style={[s.hCell, { width: "14%", textAlign: "right", borderRightWidth: 0 }]}>BALANCE</Text>
          </View>
          {tx.map((t, i) => (
            <View key={i} style={[s.tr, t.type === "opn" ? s.trOpen : i % 2 === 1 ? s.trAlt : null]} wrap={false}>
              <Text style={[s.cell, { width: "16%" }]}>{t.date}</Text>
              <View style={[s.cell, { width: "13%" }]}>
                {TYPE_LABEL[t.type] ? <Text style={[s.typePill, t.type === "pay" ? s.typePillPay : null]}>{TYPE_LABEL[t.type]}</Text> : null}
              </View>
              <View style={[s.cell, { width: "31%" }]}>
                <Text>{t.ref}{t.due && t.due !== t.date ? <Text style={s.due}>  · due {t.due}</Text> : null}</Text>
              </View>
              <Text style={[s.cellNum, { width: "13%" }]}>{t.dr || ""}</Text>
              <Text style={[s.cellNum, { width: "13%", color: t.cr ? CREDIT : INK }]}>{t.cr || ""}</Text>
              <Text style={[s.cellNum, { width: "14%", borderRightWidth: 0, color: t.neg ? FLAG : INK }]}>{t.bal}</Text>
            </View>
          ))}
        </View>

        {/* Balance due bar */}
        <View style={s.dueBar}>
          <Text><Text style={s.dueK}>BALANCE DUE · {cur}</Text><Text style={s.dueAsOf}>{"   as at "}{d.asOf}</Text></Text>
          <Text style={s.dueV}>{d.balanceDue}</Text>
        </View>

        {/* Aging summary */}
        <View style={s.agingWrap} wrap={false}>
          {(d.aging || []).map(([k, v, flag], i) => (
            <View key={i} style={[s.agCell, flag === "aged" && num(v) > 0 ? s.agAged : null]}>
              <Text style={s.agK}>{k}</Text>
              <Text style={[s.agV, flag === "aged" && num(v) > 0 ? s.agAgedV : null]}>{v}</Text>
            </View>
          ))}
          <View style={[s.agCell, s.agTotal, { borderRightWidth: 0 }]}>
            <Text style={s.agK}>Total due</Text>
            <Text style={[s.agV, s.agTotalV]}>{d.balanceDue}</Text>
          </View>
        </View>

        {/* Document summary QR */}
        <View style={{ marginTop: 14 }} wrap={false}>
          <QrSummary qrSrc={qrSrc} text="Scan for the statement reference, account and balance due. Encoded in the code itself — no network needed." />
        </View>

        {/* Payment details */}
        <PayTable pairs={payPairs} />

        <Text style={s.legal}>
          Please quote the statement reference with any remittance or query. Invoices are payable within 30 days of issue.
          Balances exclude payments received after the date shown.
        </Text>

        <RefinedFooter serial={d.ref} note="System-generated statement — no physical signature required." />
      </Page>
    </Document>
  );
}
