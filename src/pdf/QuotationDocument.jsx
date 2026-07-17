import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";

const STATUS = {
  REQUESTED: { label: "REQUESTED", color: "#946B00" },
  QUOTED: { label: "QUOTATION", color: COAL },
  ACCEPTED: { label: "ACCEPTED", color: PASS },
  DECLINED: { label: "DECLINED", color: FAIL },
};

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 44, paddingHorizontal: 32, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 2, fontFamily: "Courier" },
  contact: { fontSize: 6.5, color: MUTE, marginTop: 1 },
  metaRight: { alignItems: "flex-end" },
  sys: { fontSize: 6.5, color: MUTE, fontFamily: "Courier-Bold" },
  mono: { fontSize: 8, fontFamily: "Courier", marginTop: 1 },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 5, marginBottom: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 2 },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "18%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "32%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 8, padding: 4, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 8.5, padding: 4, borderWidth: 0.5, borderColor: "#D9D2C4" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end" },
  totalKey: { width: "24%", padding: 3, fontFamily: "Helvetica-Bold", fontSize: 8.5, backgroundColor: "#F5EEDD", borderWidth: 0.5, borderColor: "#E4DCCB", textAlign: "right" },
  totalVal: { width: "20%", padding: 3, fontSize: 8.5, borderWidth: 0.5, borderColor: "#E4DCCB", textAlign: "right" },
  words: { marginTop: 8, fontSize: 9, fontFamily: "Helvetica-Bold" },
  note: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: GOLD, backgroundColor: "#FCF7EA" },
  noteText: { fontSize: 8, color: INK },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
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

export function QuotationDocument({ quotation, logoSrc }) {
  const q = quotation;
  const st = STATUS[q.status] || { label: q.status, color: INK };
  const items = Array.isArray(q.items) ? q.items : [];

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.topRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logoSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoSrc} style={{ width: 34, height: 34, marginRight: 8 }} />
            ) : null}
            <View>
              <Text style={s.brand}>
                QALIBRATED <Text style={s.brandGold}>SYSTEMS</Text>
              </Text>
              <Text style={s.accred}>KENAS · ISO/IEC 17025:2017 · ISO/IEC 17020:2012 · ILAC-MRA</Text>
              <Text style={s.contact}>{COMPANY.address} · {COMPANY.website}</Text>
              <Text style={s.contact}>{COMPANY.email} · {COMPANY.phone}</Text>
            </View>
          </View>
          <View style={s.metaRight}>
            <Text style={s.sys}>QSL QUOTATION</Text>
            <Text style={s.mono}>NO: {q.number}</Text>
            <Text style={s.mono}>DATE: {fmt(q.quotedAt || q.createdAt)}</Text>
            {q.validUntil ? <Text style={s.mono}>VALID TO: {fmt(q.validUntil)}</Text> : null}
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.titleRow}>
          <Text style={s.title}>Quotation</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>

        {/* Client block */}
        <View style={s.row}>
          <Text style={s.key}>Client</Text>
          <Text style={s.val}>{q.clientName || "-"}</Text>
          <Text style={s.key}>Contact</Text>
          <Text style={s.val}>{q.contactPerson || "-"}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Email</Text>
          <Text style={s.val}>{q.contactEmail || "-"}</Text>
          <Text style={s.key}>Prepared by</Text>
          <Text style={s.val}>{q.preparedByName || "-"}</Text>
        </View>

        {/* Items */}
        <View style={{ marginTop: 10 }}>
          <View style={s.row}>
            <Text style={[s.th, { width: "6%", textAlign: "center" }]}>No.</Text>
            <Text style={[s.th, { width: "48%" }]}>Description</Text>
            <Text style={[s.th, { width: "10%", textAlign: "right" }]}>Qty</Text>
            <Text style={[s.th, { width: "10%", textAlign: "center" }]}>UOM</Text>
            <Text style={[s.th, { width: "13%", textAlign: "right" }]}>Unit price</Text>
            <Text style={[s.th, { width: "13%", textAlign: "right" }]}>Amount</Text>
          </View>
          {items.map((it, i) => (
            <View style={s.row} key={i} wrap={false}>
              <Text style={[s.td, { width: "6%", textAlign: "center" }]}>{i + 1}</Text>
              <Text style={[s.td, { width: "48%" }]}>{it.description}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "right" }]}>{Number(it.qty || 0).toLocaleString()}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{it.unit || "EA"}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right" }]}>{money(it.unitPrice)}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right" }]}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ marginTop: 6 }}>
          <View style={s.totalRow}><Text style={s.totalKey}>Sub total</Text><Text style={s.totalVal}>{money(q.subtotal)}</Text></View>
          {Number(q.freight) > 0 ? (
            <View style={s.totalRow}><Text style={s.totalKey}>Freight</Text><Text style={s.totalVal}>{money(q.freight)}</Text></View>
          ) : null}
          <View style={s.totalRow}><Text style={s.totalKey}>VAT ({Number(q.vatRate || 0)}%)</Text><Text style={s.totalVal}>{money(q.vatAmount)}</Text></View>
          <View style={s.totalRow}>
            <Text style={[s.totalKey, { backgroundColor: COAL, color: "#fff" }]}>Grand total, {q.currency}</Text>
            <Text style={[s.totalVal, { fontFamily: "Helvetica-Bold" }]}>{money(q.grandTotal)}</Text>
          </View>
        </View>

        {q.amountInWords ? <Text style={s.words}>Amount in words: {q.amountInWords}</Text> : null}

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

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · ${q.number} · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* The client's uploaded Local Purchase Order, on its own page. */}
      {q.lpoImage && /^data:image\//.test(q.lpoImage) ? (
        <Page size="A4" style={s.page} wrap>
          <View style={s.titleRow}>
            <Text style={s.title}>Local Purchase Order</Text>
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
