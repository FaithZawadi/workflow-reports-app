import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

// The QSL Material Requisition Form (QSL-A2), rendered to match the printed A2
// book: masthead + form badge, the project / prepared-by header grid, the
// itemised table with a "Purchase Use Only" (actual cost / variation) block,
// and the company footer. Carries the company (Qalibrated) logo.

const GOLD = "#F5A800";
const GOLD_DK = "#8A6A00";
const COAL = "#161310";
const INK = "#1a1510";
const RED = "#C0392B";
const LINE = "#111";

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 54, paddingHorizontal: 26, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  // masthead
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 40, height: 40, marginRight: 8, objectFit: "contain" },
  brandName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: COAL, letterSpacing: 0.3 },
  brandSub: { fontSize: 7, color: GOLD_DK, fontFamily: "Helvetica-Bold" },
  headRight: { alignItems: "flex-end" },
  serial: { fontSize: 12, fontFamily: "Courier-Bold", color: RED, letterSpacing: 1 },
  tagline: { fontSize: 6.5, color: "#fff", backgroundColor: COAL, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 2, marginTop: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 8 },
  titlePill: { backgroundColor: GOLD, color: COAL, fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 0.5, paddingVertical: 3, paddingHorizontal: 10, textTransform: "uppercase" },
  codePill: { marginLeft: 8, backgroundColor: COAL, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 10, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 2 },
  // header grid
  grid: { borderWidth: 1, borderColor: LINE },
  gRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  gRowLast: { flexDirection: "row" },
  gCell: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 5, minHeight: 20 },
  gLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginRight: 4 },
  gVal: { fontSize: 9, color: COAL, flex: 1 },
  vdiv: { borderRightWidth: 1, borderRightColor: LINE },
  // items table
  table: { borderWidth: 1, borderColor: LINE, borderTopWidth: 0, marginTop: 0 },
  thead: { flexDirection: "row", backgroundColor: "#efe8d8", borderTopWidth: 1, borderTopColor: LINE },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.3, textAlign: "center", justifyContent: "center", alignItems: "center", paddingVertical: 3, paddingHorizontal: 2, borderRightWidth: 1, borderRightColor: LINE },
  puHead: { borderRightWidth: 1, borderRightColor: LINE },
  puTop: { fontFamily: "Helvetica-Bold", fontSize: 6.6, textAlign: "center", paddingVertical: 1.5, borderBottomWidth: 1, borderBottomColor: LINE },
  puSubRow: { flexDirection: "row" },
  puSub: { fontFamily: "Helvetica-Bold", fontSize: 6.6, textAlign: "center", paddingVertical: 1.5 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, minHeight: 18 },
  td: { fontSize: 8.5, paddingVertical: 3, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: LINE, justifyContent: "center" },
  tdNum: { fontSize: 8.5, fontFamily: "Courier", textAlign: "right", paddingVertical: 3, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: LINE, justifyContent: "center" },
  totalRow: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: LINE },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right", paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 1, borderRightColor: LINE },
  totalVal: { fontFamily: "Courier-Bold", fontSize: 9.5, color: COAL, textAlign: "right", paddingVertical: 4, paddingHorizontal: 4, borderRightWidth: 1, borderRightColor: LINE },
  // footer
  foot: { position: "absolute", left: 26, right: 26, bottom: 18 },
  footBar: { backgroundColor: GOLD, color: COAL, fontSize: 6.8, textAlign: "center", paddingVertical: 4, paddingHorizontal: 6, lineHeight: 1.4 },
});

// Column widths (must sum to 100).
const COL = { no: "6%", desc: "34%", qty: "7%", unit: "8%", each: "16%", est: "15%", actual: "8%", varc: "6%" };
const money = (n) => (n || n === 0 ? Number(n).toLocaleString("en-US") : "");

export function MaterialRequisitionDocument({ request, logoSrc }) {
  const r = request || {};
  const items = Array.isArray(r.items) ? r.items : [];
  const rows = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const each = Number(it.estUnitPrice) || 0;
    return { desc: it.description || "", qty: qty || "", unit: it.unit || "", each: each ? money(each) : "", est: qty && each ? money(qty * each) : "" };
  });
  // Pad to a minimum number of rows so the form reads like the printed book.
  const MIN_ROWS = 9;
  while (rows.length < MIN_ROWS) rows.push({ desc: "", qty: "", unit: "", each: "", est: "" });
  const total = items.reduce((t, it) => t + (Number(it.qty) || 0) * (Number(it.estUnitPrice) || 0), 0);
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("en-GB"); } catch { return ""; } };

  const HeadCell = ({ w, children, last }) => (
    <View style={[s.th, { width: w }, last ? { borderRightWidth: 0 } : null]}><Text>{children}</Text></View>
  );

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* Masthead */}
        <View style={s.head}>
          <View style={s.brand}>
            {logoSrc ? (/* eslint-disable-next-line jsx-a11y/alt-text */ <Image src={logoSrc} style={s.logo} />) : null}
            <View>
              <Text style={s.brandName}>QALIBRATED SYSTEMS</Text>
              <Text style={s.brandSub}>Inventing and Making it Happen</Text>
            </View>
          </View>
          <View style={s.headRight}>
            <Text style={s.serial}>{r.number || ""}</Text>
          </View>
        </View>

        <View style={s.titleRow}>
          <Text style={s.titlePill}>Material Requisition Form A-2</Text>
          <Text style={s.codePill}>QSL-A2</Text>
        </View>

        {/* Header grid */}
        <View style={s.grid}>
          <View style={s.gRow}>
            <View style={[s.gCell, s.vdiv, { width: "60%" }]}><Text style={s.gLabel}>Project Name</Text><Text style={s.gVal}>{r.projectName || ""}</Text></View>
            <View style={[s.gCell, { width: "40%" }]}><Text style={s.gLabel}>Project Number</Text><Text style={s.gVal}>{r.projectNumber || ""}</Text></View>
          </View>
          <View style={s.gRow}>
            <View style={[s.gCell, { width: "100%" }]}><Text style={s.gLabel}>Store Name</Text><Text style={s.gVal}>{r.storeName || ""}</Text></View>
          </View>
          <View style={s.gRow}>
            <View style={[s.gCell, s.vdiv, { width: "60%" }]}><Text style={s.gLabel}>Prepared by</Text><Text style={s.gVal}>{r.requestedByName || ""}</Text></View>
            <View style={[s.gCell, { width: "40%" }]}><Text style={s.gLabel}>Approved By</Text><Text style={s.gVal}>{r.status === "APPROVED" || r.status === "CONVERTED" ? (r.reviewedByName || "") : ""}</Text></View>
          </View>
          <View style={s.gRowLast}>
            <View style={[s.gCell, s.vdiv, { width: "60%" }]}><Text style={s.gLabel}>Checked By</Text><Text style={s.gVal}>{r.checkedByName || ""}</Text></View>
            <View style={[s.gCell, { width: "40%" }]}><Text style={s.gLabel}>Date</Text><Text style={s.gVal}>{fmtDate(r.createdAt)}</Text></View>
          </View>
        </View>

        {/* Items table header */}
        <View style={s.table}>
          <View style={s.thead}>
            <HeadCell w={COL.no}>S/No</HeadCell>
            <HeadCell w={COL.desc}>Description</HeadCell>
            <HeadCell w={COL.qty}>Qty</HeadCell>
            <HeadCell w={COL.unit}>Unit</HeadCell>
            <HeadCell w={COL.each}>Amount for Each</HeadCell>
            <HeadCell w={COL.est}>Estimated Cost</HeadCell>
            <View style={[s.puHead, { width: `${parseFloat(COL.actual) + parseFloat(COL.varc)}%` }]}>
              <Text style={s.puTop}>Purchase Use Only (Attach RECEIPTS)</Text>
              <View style={s.puSubRow}>
                <Text style={[s.puSub, { width: "57%", borderRightWidth: 1, borderRightColor: LINE }]}>Actual Cost</Text>
                <Text style={[s.puSub, { width: "43%" }]}>Variation</Text>
              </View>
            </View>
          </View>

          {rows.map((row, i) => (
            <View style={s.tr} key={i} wrap={false}>
              <View style={[s.td, { width: COL.no, textAlign: "center", alignItems: "center" }]}><Text>{row.desc ? i + 1 : ""}</Text></View>
              <View style={[s.td, { width: COL.desc }]}><Text>{row.desc}</Text></View>
              <View style={[s.td, { width: COL.qty, textAlign: "center", alignItems: "center" }]}><Text>{row.qty}</Text></View>
              <View style={[s.td, { width: COL.unit, textAlign: "center", alignItems: "center" }]}><Text>{row.unit}</Text></View>
              <View style={[s.tdNum, { width: COL.each }]}><Text>{row.each}</Text></View>
              <View style={[s.tdNum, { width: COL.est }]}><Text>{row.est}</Text></View>
              <View style={[s.td, { width: COL.actual }]}><Text> </Text></View>
              <View style={[s.td, { width: COL.varc, borderRightWidth: 0 }]}><Text> </Text></View>
            </View>
          ))}

          {/* Total */}
          <View style={s.totalRow}>
            <View style={[s.totalLabel, { width: `${parseFloat(COL.no) + parseFloat(COL.desc) + parseFloat(COL.qty) + parseFloat(COL.unit) + parseFloat(COL.each)}%` }]}><Text>Total</Text></View>
            <View style={[s.totalVal, { width: COL.est }]}><Text>{money(total)}</Text></View>
            <View style={[s.td, { width: `${parseFloat(COL.actual) + parseFloat(COL.varc)}%`, borderRightWidth: 0 }]}><Text> </Text></View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.foot} fixed>
          <Text style={s.footBar}>
            {COMPANY.address || "Birdi Singh Complex 1st Floor, off Mombasa Road"}, P.O BOX 34463 - 00100, Nairobi, Kenya · Tel: {COMPANY.phone} · {COMPANY.email} | {COMPANY.website}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
