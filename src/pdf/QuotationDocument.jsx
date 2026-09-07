import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY, DEFAULT_PAYMENT_DETAILS, DEFAULT_QUOTE_TERMS } from "@/lib/company";
import { PdfHeader } from "./shared";

const GOLD = "#F5A800";
// Deep gold for gold-coloured TEXT/lines that sit on a light background: bright
// gold is too light to read once a page is photocopied in black & white, so
// anything gold-on-white uses this darker tone (still clearly golden in colour,
// but dark enough for grayscale). Bright GOLD is kept only on dark fills
// (light-on-dark prints fine) and as a fill behind dark text.
const GOLD_DK = "#8A6A00";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";

const STATUS = {
  REQUESTED: { label: "REQUESTED", color: "#946B00" },
  QUOTED: { label: "QUOTED", color: COAL },
  ACCEPTED: { label: "ACCEPTED", color: PASS },
  DECLINED: { label: "DECLINED", color: FAIL },
};

// Parse the "LABEL: value" payment-details text into {label, value} pairs so it
// can be laid out as a horizontal table. Lines without a colon are ignored.
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

// Split pairs into balanced bands (rows) of at most MAX columns, so a long list
// wraps into even rows (e.g. 9 → 5 + 4) instead of a lonely trailing cell.
function payBands(pairs, max = 5) {
  const n = pairs.length;
  if (n === 0) return [];
  const bands = Math.ceil(n / max);
  const per = Math.ceil(n / bands);
  const out = [];
  for (let i = 0; i < n; i += per) out.push(pairs.slice(i, i + per));
  return out;
}

// The modern payment-details table: a coal banner, then one or more bands, each
// a coloured header row over a value row. On-brand (coal + gold).
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
              <View style={[s.payBand, lastBand ? null : { borderBottomWidth: 0.5, borderBottomColor: "#EAE3D5" }]}>
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
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 14 },
  logo: { width: 62, height: 62, marginRight: 12, objectFit: "contain" },
  brandText: { flex: 1, paddingTop: 2 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: COAL, marginBottom: 2 },
  brandGold: { color: GOLD_DK },
  tagline: { fontSize: 8, color: GOLD_DK, fontFamily: "Helvetica-Oblique", marginBottom: 2 },
  accred: { fontSize: 6.8, color: MUTE, marginTop: 2, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  contact: { fontSize: 7.2, color: INK, marginTop: 2, fontFamily: "Helvetica", lineHeight: 1.3 },
  // Boxed DATE / NO / FILE NO panel, top-right (invoice style).
  metaBox: { borderWidth: 0.8, borderColor: COAL, width: 196 },
  metaLine: { flexDirection: "row", alignItems: "center", minHeight: 16, borderBottomWidth: 0.5, borderBottomColor: "#CFC7B6" },
  metaK: { width: "36%", alignSelf: "stretch", backgroundColor: "#F5EEDD", paddingVertical: 3.5, paddingHorizontal: 5, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COAL, letterSpacing: 0.3, borderRightWidth: 0.5, borderRightColor: "#CFC7B6" },
  metaV: { width: "64%", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 7.8, fontFamily: "Courier-Bold", color: COAL },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 5, marginBottom: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  // Gold QUOTATION banner, matching the reference invoice.
  titleBadge: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL, backgroundColor: GOLD, paddingVertical: 3, paddingHorizontal: 12, letterSpacing: 1, textTransform: "uppercase" },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 2 },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "16%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "34%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  subjectBar: { marginTop: 8, backgroundColor: "#F5EEDD", borderLeftWidth: 3, borderLeftColor: GOLD_DK, paddingVertical: 4, paddingHorizontal: 8 },
  subjectLabel: { fontSize: 6.5, color: MUTE, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  subjectText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COAL, textTransform: "uppercase", marginTop: 1 },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 8, padding: 4, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 8.5, padding: 4, borderWidth: 0.5, borderColor: "#D9D2C4" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end" },
  totalKey: { width: "26%", padding: 3, fontFamily: "Helvetica-Bold", fontSize: 8.5, backgroundColor: "#F5EEDD", borderWidth: 0.5, borderColor: "#E4DCCB", textAlign: "right" },
  totalVal: { width: "22%", padding: 3, fontSize: 8.5, borderWidth: 0.5, borderColor: "#E4DCCB", textAlign: "right" },
  words: { marginTop: 8, fontSize: 9, fontFamily: "Helvetica-Bold" },
  // --- Preset table quotation ---------------------------------------------
  // "Prepared for" card + details.
  clientCard: { flexDirection: "row", marginTop: 12, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  clientMain: { width: "58%", padding: 8, borderRightWidth: 0.7, borderRightColor: "#C9C1B0" },
  clientLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: MUTE, letterSpacing: 0.8, marginBottom: 3 },
  clientName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COAL },
  clientLine: { fontSize: 8, color: INK, marginTop: 2 },
  clientSide: { width: "42%" },
  csRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#EAE3D4", minHeight: 15, alignItems: "center" },
  csK: { width: "42%", alignSelf: "stretch", backgroundColor: "#FAF4E6", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COAL, borderRightWidth: 0.5, borderRightColor: "#EAE3D4" },
  csV: { width: "58%", paddingVertical: 3.5, paddingHorizontal: 6, fontSize: 8, color: INK },
  // Line-items table.
  itemsTable: { marginTop: 12, borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  itemsHead: { flexDirection: "row", backgroundColor: COAL },
  ihCell: { color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "rgba(255,255,255,0.16)" },
  itemsRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#EAE3D4", alignItems: "stretch", minHeight: 19 },
  itemsRowAlt: { backgroundColor: "#FBF8F1" },
  iCell: { fontSize: 8.5, color: INK, paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center" },
  iCellNum: { fontSize: 8.3, color: INK, fontFamily: "Courier-Bold", paddingVertical: 5, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EFE9DB", justifyContent: "center", textAlign: "right" },
  // Totals panel.
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalsBox: { width: "50%", borderWidth: 0.7, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  tRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4.5, paddingHorizontal: 9, borderBottomWidth: 0.5, borderBottomColor: "#EAE3D4" },
  tK: { fontSize: 8.5, color: MUTE, fontFamily: "Helvetica-Bold" },
  tV: { fontSize: 8.5, color: INK, fontFamily: "Courier-Bold" },
  tGrand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COAL, paddingVertical: 6, paddingHorizontal: 9 },
  tGK: { fontSize: 9, color: GOLD, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  tGV: { fontSize: 10.5, color: "#fff", fontFamily: "Courier-Bold" },
  note: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: GOLD_DK, backgroundColor: "#FCF7EA" },
  noteText: { fontSize: 8, color: INK },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 2, borderTopColor: GOLD_DK, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
  // Payment details + terms of sale blocks at the foot of the quotation.
  blocks: { flexDirection: "row", marginTop: 12 },
  pay: { flex: 1, padding: 8, borderWidth: 0.5, borderColor: "#D9D2C4", borderRadius: 3, backgroundColor: "#FBF8F1", marginRight: 8 },
  terms: { flex: 1, padding: 8, borderWidth: 0.5, borderColor: "#D9D2C4", borderRadius: 3, backgroundColor: "#FBF8F1" },
  blockTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: GOLD_DK, paddingBottom: 2 },
  payText: { fontSize: 7.8, color: INK, lineHeight: 1.5, fontFamily: "Courier" },
  termsText: { fontSize: 7.8, color: INK, lineHeight: 1.5 },
  // Modern full-width payment-details table (label header row + value row).
  payWrap: { marginTop: 14 },
  payBanner: { backgroundColor: COAL, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  payBannerDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: GOLD, marginRight: 6 },
  payBannerText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 1 },
  payTable: { borderWidth: 0.6, borderColor: "#D9D2C4", borderTopWidth: 0, overflow: "hidden" },
  payBand: { flexDirection: "row" },
  payHeadCell: { backgroundColor: "#22201C", paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "rgba(255,255,255,0.18)", borderBottomWidth: 0.5, borderBottomColor: GOLD, justifyContent: "center" },
  payHeadText: { fontSize: 6.6, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },
  payValCell: { paddingVertical: 6, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#EAE3D5", justifyContent: "center" },
  payValText: { fontSize: 8.2, fontFamily: "Helvetica-Bold", color: INK, textAlign: "center" },
  termsFull: { marginTop: 10, padding: 8, borderWidth: 0.5, borderColor: "#D9D2C4", borderRadius: 3, backgroundColor: "#FBF8F1" },
  qrBlock: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#E4DCCB" },
  qrImg: { width: 46, height: 46 },
  // Pinned bottom-right, above the footer, page 1 only.
  qrFixed: { position: "absolute", bottom: 24, right: 32, alignItems: "flex-end" },
  qrText: { flex: 1 },
  qrTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4 },
  qrSub: { fontSize: 7.5, color: MUTE, marginTop: 2, lineHeight: 1.3, maxWidth: 260 },
  // Amendment / revision history block.
  amendWrap: { marginTop: 12, borderWidth: 0.5, borderColor: "#D9D2C4", borderRadius: 3, backgroundColor: "#FBF8F1" },
  amendTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4, padding: 6, borderBottomWidth: 0.5, borderBottomColor: GOLD_DK },
  amendRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#EAE3D4", paddingVertical: 3, paddingHorizontal: 6 },
  amendRev: { width: "12%", fontSize: 8, fontFamily: "Helvetica-Bold", color: COAL },
  amendWho: { width: "26%", fontSize: 8 },
  amendWhen: { width: "26%", fontSize: 7.5, color: MUTE, fontFamily: "Courier" },
  amendNote: { width: "36%", fontSize: 8 },
});

function fmt(d, withTime) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
    });
  } catch {
    return String(d);
  }
}
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// `internal` — when true (an authenticated QSL staff download) the amendment
// history is included; the client-facing share PDF (/d/<token>) omits it.
export function QuotationDocument({ quotation, logoSrc, qrSrc, internal = false }) {
  const q = quotation;
  const st = STATUS[q.status] || { label: q.status, color: INK };
  const items = Array.isArray(q.items) ? q.items : [];
  const paymentDetails = q.paymentDetails || DEFAULT_PAYMENT_DETAILS;
  const terms = q.terms || DEFAULT_QUOTE_TERMS;

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* Shared letterhead — the same header every system PDF carries, with the
            quotation's date / number / validity in the standard meta rows. */}
        <PdfHeader
          logoSrc={logoSrc}
          contactLines={[
            `${COMPANY.postal || COMPANY.address} · ${COMPANY.website}`,
            `${COMPANY.email} · ${COMPANY.phone}${COMPANY.pin ? ` · PIN ${COMPANY.pin}` : ""}`,
          ]}
          meta={[
            { k: "DATE", v: fmt(q.quotedAt || q.createdAt) },
            { k: "NO.", v: q.number, mono: true },
            { k: "FILE NO.", v: q.fileNo || "-" },
            { k: "VALID TO", v: q.validUntil ? fmt(q.validUntil) : "-" },
          ]}
        />

        <View style={s.titleRow}>
          <Text style={s.titleBadge}>Quotation</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>

        {/* Prepared-for card: client on the left, quote particulars on the right */}
        <View style={s.clientCard}>
          <View style={s.clientMain}>
            <Text style={s.clientLabel}>PREPARED FOR</Text>
            <Text style={s.clientName}>{q.clientName || "-"}</Text>
            {q.contactPerson ? <Text style={s.clientLine}>Attn: {q.contactPerson}</Text> : null}
            {q.contactEmail ? <Text style={s.clientLine}>{q.contactEmail}</Text> : null}
            {q.contactPhone ? <Text style={s.clientLine}>{q.contactPhone}</Text> : null}
          </View>
          <View style={s.clientSide}>
            <View style={s.csRow}><Text style={s.csK}>Prepared by</Text><Text style={s.csV}>{q.preparedByName || "-"}</Text></View>
            <View style={s.csRow}><Text style={s.csK}>Currency</Text><Text style={s.csV}>{q.currency || "KES"}</Text></View>
            <View style={[s.csRow, { borderBottomWidth: 0 }]}><Text style={s.csK}>Items</Text><Text style={s.csV}>{items.length}</Text></View>
          </View>
        </View>

        {/* Subject / job — the invoice-style RE: line */}
        {q.subject ? (
          <View style={s.subjectBar}>
            <Text style={s.subjectLabel}>Subject</Text>
            <Text style={s.subjectText}>{q.subject}</Text>
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

        {/* Totals panel */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalsBox}>
            <View style={s.tRow}><Text style={s.tK}>Subtotal</Text><Text style={s.tV}>{money(q.subtotal)}</Text></View>
            {Number(q.freight) > 0 ? (
              <View style={s.tRow}><Text style={s.tK}>Freight</Text><Text style={s.tV}>{money(q.freight)}</Text></View>
            ) : null}
            <View style={s.tRow}><Text style={s.tK}>VAT ({Number(q.vatRate || 0)}%)</Text><Text style={s.tV}>{money(q.vatAmount)}</Text></View>
            <View style={s.tGrand}><Text style={s.tGK}>GRAND TOTAL · {q.currency || "KES"}</Text><Text style={s.tGV}>{money(q.grandTotal)}</Text></View>
          </View>
        </View>

        {q.amountInWords ? <Text style={s.words}>Amount in words: {q.amountInWords}</Text> : null}

        {/* Payment details + terms of sale — both editable per quotation. When
            the payment block is in "LABEL: value" form it renders as a modern
            horizontal table; otherwise it falls back to the plain text box. */}
        {(() => {
          const pairs = parsePayPairs(paymentDetails);
          if (pairs.length >= 2) {
            return (
              <View>
                <PayTable pairs={pairs} />
                <View style={s.termsFull} wrap={false}>
                  <Text style={s.blockTitle}>Terms of sale</Text>
                  <Text style={s.termsText}>{terms}</Text>
                </View>
              </View>
            );
          }
          return (
            <View style={s.blocks} wrap={false}>
              <View style={s.pay}>
                <Text style={s.blockTitle}>Payment details</Text>
                <Text style={s.payText}>{paymentDetails}</Text>
              </View>
              <View style={s.terms}>
                <Text style={s.blockTitle}>Terms of sale</Text>
                <Text style={s.termsText}>{terms}</Text>
              </View>
            </View>
          );
        })()}

        {q.notes ? (
          <View style={s.note}>
            <Text style={[s.noteText, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>Notes</Text>
            <Text style={s.noteText}>{q.notes}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 8, color: MUTE }}>
            This quotation is issued by {COMPANY.name}. Prices are in {q.currency}
            {Number(q.vatRate || 0) ? ` and VAT is charged at ${Number(q.vatRate)}%` : ""}. Acceptance is recorded electronically in the QSL system.
          </Text>
          {q.status === "ACCEPTED" ? (
            <Text style={{ fontSize: 9, color: PASS, fontFamily: "Helvetica-Bold", marginTop: 4 }}>
              ACCEPTED by the client on {fmt(q.decidedAt, true)} EAT.
            </Text>
          ) : q.status === "DECLINED" ? (
            <Text style={{ fontSize: 9, color: FAIL, fontFamily: "Helvetica-Bold", marginTop: 4 }}>
              DECLINED by the client on {fmt(q.decidedAt, true)} EAT.
            </Text>
          ) : null}
        </View>

        {/* Amendment / revision history is deliberately NOT printed on the client
            PDF — repeated revisions confuse clients. It stays on the on-screen
            preview (staff) and in the audit log. */}

        {/* Verify QR — pinned to the bottom of page 1 only, so a long quote's
            overflow flows onto page 2 without dragging the QR onto its own page. */}
        {qrSrc ? (
          <View
            fixed
            style={s.qrFixed}
            render={({ pageNumber }) => (pageNumber === 1 ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={qrSrc} style={s.qrImg} />
            ) : null)}
          />
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · ${q.number} · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* The client's uploaded Local Purchase Order, on its own page. */}
      {q.lpoImage && /^data:image\//.test(q.lpoImage) ? (
        <Page size="A4" style={s.page} wrap>
          <View style={s.titleRow}>
            <Text style={s.titleBadge}>Local Purchase Order</Text>
            <Text style={[s.statusBadge, { backgroundColor: COAL }]}>{q.number}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={q.lpoImage} style={{ marginTop: 6, maxWidth: "100%", maxHeight: 720, objectFit: "contain" }} />
          <View style={s.footer} fixed>
            <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · ${q.number} · Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
