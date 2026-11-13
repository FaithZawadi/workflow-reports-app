import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY, DEFAULT_PAYMENT_DETAILS } from "@/lib/company";
import { PdfHeader } from "./shared";
import { QrSummary, RefinedFooter } from "./refined";

// The invoice shares the quotation's bordered layout (boxed bill-to card,
// highlighted subject bar, black-header item table, bordered payment table),
// with the inline "Document summary" QR beside the totals and the ISO footer.

const GOLD = "#F5A800";
const GOLD_DK = "#8A6A00";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";

const STATUS = {
  DRAFT: { label: "DRAFT", color: "#6B6355" },
  UNPAID: { label: "UNPAID", color: "#B03A2E" },
  PAID: { label: "PAID", color: PASS },
  CANCELLED: { label: "CANCELLED", color: COAL },
};

const DEFAULT_INVOICE_TERMS =
  "Payable within 30 days of the invoice date to the account shown above. Please quote the invoice number on all remittances. Retention, where shown, is released on certification of practical completion.";

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
  subjectBar: { marginTop: 8, backgroundColor: "#F5EEDD", borderLeftWidth: 3, borderLeftColor: GOLD_DK, paddingVertical: 4, paddingHorizontal: 8 },
  subjectLabel: { fontSize: 6.5, color: MUTE, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  subjectText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COAL, textTransform: "uppercase", marginTop: 1 },
  // Bill-to card.
  clientCard: { flexDirection: "row", marginTop: 12, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  clientMain: { width: "58%", padding: 8, borderRightWidth: 0.7, borderRightColor: "#C9C1B0" },
  clientLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: MUTE, letterSpacing: 0.8, marginBottom: 3 },
  clientName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COAL },
  clientLine: { fontSize: 8, color: INK, marginTop: 2 },
  clientSide: { width: "42%" },
  csRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#C9C1B0", minHeight: 15, alignItems: "center" },
  csK: { width: "42%", alignSelf: "stretch", backgroundColor: "#FAF4E6", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COAL, borderRightWidth: 0.5, borderRightColor: "#C9C1B0" },
  csV: { width: "58%", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 8, color: INK },
  // Items table.
  itemsTable: { marginTop: 12, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  itemsHead: { flexDirection: "row", backgroundColor: COAL },
  ihCell: { color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: GOLD_DK },
  itemsRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#C9C1B0", alignItems: "stretch", minHeight: 19 },
  itemsRowAlt: { backgroundColor: "#FBF8F1" },
  iCell: { fontSize: 8.5, color: INK, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center" },
  iCellNum: { fontSize: 8.3, color: INK, fontFamily: "Courier-Bold", paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center", textAlign: "right" },
  // Totals panel.
  totalsBox: { width: "50%", borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  tRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4.5, paddingHorizontal: 9, borderBottomWidth: 0.5, borderBottomColor: "#C9C1B0" },
  tK: { fontSize: 8.5, color: MUTE, fontFamily: "Helvetica-Bold" },
  tV: { fontSize: 8.5, color: INK, fontFamily: "Courier-Bold" },
  tGrand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COAL, paddingVertical: 6, paddingHorizontal: 9 },
  tGK: { fontSize: 9, color: GOLD, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  tGV: { fontSize: 10.5, color: "#fff", fontFamily: "Courier-Bold" },
  words: { marginTop: 8, fontSize: 9, fontFamily: "Helvetica-Bold" },
  // Terms box.
  termsFull: { marginTop: 10, padding: 8, borderWidth: 0.5, borderColor: "#C9C1B0", borderRadius: 3, backgroundColor: "#FBF8F1" },
  blockTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: GOLD_DK, paddingBottom: 2 },
  termsText: { fontSize: 7.8, color: INK, lineHeight: 1.5 },
  note: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: GOLD_DK, backgroundColor: "#FCF7EA" },
  noteText: { fontSize: 8, color: INK },
  // Payment table.
  payWrap: { marginTop: 14 },
  payBanner: { backgroundColor: COAL, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  payBannerDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: GOLD, marginRight: 6 },
  payBannerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 1 },
  payTable: { borderWidth: 0.6, borderColor: "#C9C1B0", borderTopWidth: 0, overflow: "hidden" },
  payBand: { flexDirection: "row" },
  payHeadCell: { backgroundColor: "#22201C", paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: GOLD_DK, borderBottomWidth: 0.5, borderBottomColor: GOLD_DK, justifyContent: "center" },
  payHeadText: { fontSize: 6.6, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },
  payValCell: { paddingVertical: 6, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#C9C1B0", justifyContent: "center" },
  payValText: { fontSize: 8.2, fontFamily: "Helvetica-Bold", color: INK, textAlign: "center" },
});

function fmt(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InvoiceDocument({ invoice, logoSrc, qrSrc }) {
  const inv = invoice;
  const st = STATUS[inv.status] || { label: inv.status, color: INK };
  const items = Array.isArray(inv.items) ? inv.items : [];
  const cur = inv.currency || "KES";
  const paymentDetails = inv.paymentDetails || DEFAULT_PAYMENT_DETAILS;
  const terms = inv.terms || DEFAULT_INVOICE_TERMS;
  const hasRetention = Number(inv.retentionAmount) > 0;

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
            { k: "DATE", v: fmt(inv.issuedAt || inv.createdAt) },
            { k: "NO.", v: inv.number, mono: true },
            ...(inv.ref ? [{ k: "REF.", v: inv.ref }] : []),
            { k: "DUE", v: inv.dueDate ? fmt(inv.dueDate) : "On receipt" },
          ]}
        />

        <View style={s.titleRow}>
          <Text style={s.titleBadge}>Invoice</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>

        {/* Bill-to card: client on the left, invoice particulars on the right */}
        <View style={s.clientCard}>
          <View style={s.clientMain}>
            <Text style={s.clientLabel}>BILL TO</Text>
            <Text style={s.clientName}>{inv.clientName || "-"}</Text>
            {inv.siteName ? <Text style={s.clientLine}>Site: {inv.siteName}</Text> : null}
            {inv.contactPerson ? <Text style={s.clientLine}>Attn: {inv.contactPerson}</Text> : null}
            {inv.contactEmail ? <Text style={s.clientLine}>{inv.contactEmail}</Text> : null}
            {inv.contactPhone ? <Text style={s.clientLine}>{inv.contactPhone}</Text> : null}
          </View>
          <View style={s.clientSide}>
            <View style={s.csRow}><Text style={s.csK}>Issued by</Text><Text style={s.csV}>{inv.issuedByName || "-"}</Text></View>
            <View style={s.csRow}><Text style={s.csK}>Currency</Text><Text style={s.csV}>{cur}</Text></View>
            <View style={[s.csRow, { borderBottomWidth: 0 }]}><Text style={s.csK}>Items</Text><Text style={s.csV}>{items.length}</Text></View>
          </View>
        </View>

        {inv.subject ? (
          <View style={s.subjectBar}>
            <Text style={s.subjectLabel}>Subject</Text>
            <Text style={s.subjectText}>{inv.subject}</Text>
          </View>
        ) : null}

        {/* Line-items table */}
        <View style={s.itemsTable}>
          <View style={s.itemsHead}>
            <Text style={[s.ihCell, { width: "6%", textAlign: "center" }]}>#</Text>
            <Text style={[s.ihCell, { width: "46%" }]}>DESCRIPTION</Text>
            <Text style={[s.ihCell, { width: "9%", textAlign: "center" }]}>QTY</Text>
            <Text style={[s.ihCell, { width: "10%", textAlign: "center" }]}>UNIT</Text>
            <Text style={[s.ihCell, { width: "14%", textAlign: "right" }]}>RATE</Text>
            <Text style={[s.ihCell, { width: "15%", textAlign: "right", borderRightWidth: 0 }]}>AMOUNT</Text>
          </View>
          {items.map((it, i) => (
            <View style={[s.itemsRow, i % 2 === 1 ? s.itemsRowAlt : null]} key={i} wrap={false}>
              <Text style={[s.iCell, { width: "6%", textAlign: "center" }]}>{i + 1}</Text>
              <Text style={[s.iCell, { width: "46%" }]}>{it.description}</Text>
              <Text style={[s.iCell, { width: "9%", textAlign: "center" }]}>{Number(it.qty || 0).toLocaleString()}</Text>
              <Text style={[s.iCell, { width: "10%", textAlign: "center" }]}>{it.unit || "EA"}</Text>
              <Text style={[s.iCellNum, { width: "14%" }]}>{money(it.unitPrice)}</Text>
              <Text style={[s.iCellNum, { width: "15%", borderRightWidth: 0 }]}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</Text>
            </View>
          ))}
        </View>

        {/* Totals panel — with the verification QR inline to its left */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }} wrap={false}>
          <QrSummary qrSrc={qrSrc} />
          <View style={s.totalsBox}>
            <View style={s.tRow}><Text style={s.tK}>Subtotal</Text><Text style={s.tV}>{money(inv.subtotal)}</Text></View>
            {hasRetention ? (
              <View style={s.tRow}><Text style={s.tK}>Less retention ({Number(inv.retentionRate || 0)}%)</Text><Text style={s.tV}>({money(inv.retentionAmount)})</Text></View>
            ) : null}
            {hasRetention ? (
              <View style={s.tRow}><Text style={s.tK}>Net amount</Text><Text style={s.tV}>{money(inv.netAmount)}</Text></View>
            ) : null}
            <View style={s.tRow}><Text style={s.tK}>VAT ({Number(inv.vatRate || 0)}%)</Text><Text style={s.tV}>{money(inv.vatAmount)}</Text></View>
            <View style={s.tGrand}><Text style={s.tGK}>AMOUNT DUE · {cur}</Text><Text style={s.tGV}>{money(inv.grandTotal)}</Text></View>
          </View>
        </View>

        {inv.amountInWords ? <Text style={s.words}>Amount in words: {inv.amountInWords}</Text> : null}

        {/* Payment details — bordered table when in "LABEL: value" form */}
        {(() => {
          const pairs = parsePayPairs(paymentDetails);
          if (pairs.length >= 2) {
            return (
              <View>
                <PayTable pairs={pairs} />
                <View style={s.termsFull} wrap={false}>
                  <Text style={s.blockTitle}>Terms</Text>
                  <Text style={s.termsText}>{terms}</Text>
                </View>
              </View>
            );
          }
          return (
            <View style={s.termsFull} wrap={false}>
              <Text style={s.blockTitle}>Payment details</Text>
              <Text style={s.termsText}>{paymentDetails}</Text>
              <Text style={[s.blockTitle, { marginTop: 8 }]}>Terms</Text>
              <Text style={s.termsText}>{terms}</Text>
            </View>
          );
        })()}

        {inv.notes ? (
          <View style={s.note}>
            <Text style={[s.noteText, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>Notes</Text>
            <Text style={s.noteText}>{inv.notes}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 8, color: MUTE }}>
            Raised by {COMPANY.name}. Amounts are in {cur}
            {Number(inv.vatRate || 0) ? ` and VAT is charged at ${Number(inv.vatRate)}%` : ""}. Settlement is recorded electronically in the QSL system.
          </Text>
        </View>

        <RefinedFooter serial={inv.number} note="This is a system-generated invoice — no physical signature required." />
      </Page>
    </Document>
  );
}
