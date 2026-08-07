import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";
const WAIT = "#946B00";

const ACTION_COLOR = { CREATE: PASS, APPROVE: PASS, UPDATE: WAIT, REJECT: FAIL, DELETE: FAIL };

function fmt(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(d);
  }
}

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 8.5, color: INK },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 1 },
  contact: { fontSize: 7, color: MUTE, marginTop: 1 },
  metaRight: { alignItems: "flex-end" },
  sys: { fontSize: 6.5, color: MUTE, fontFamily: "Courier" },
  mono: { fontSize: 7.5, color: INK, fontFamily: "Courier", marginTop: 1 },
  rule: { height: 2, backgroundColor: GOLD, marginTop: 8, marginBottom: 8 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: INK },
  sub: { fontSize: 8.5, color: MUTE, marginTop: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E4DCCB" },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff", backgroundColor: COAL, padding: 4 },
  td: { fontSize: 7.5, color: INK, padding: 4 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
});

export function AuditLogDocument({ logs = [], filterLabel, generatedByName, logoSrc }) {
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.topRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logoSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoSrc} style={{ width: 46, height: 46, marginRight: 10, objectFit: "contain" }} />
            ) : (
              <Text style={[s.brand, { marginRight: 10 }]}>QALIBRATED <Text style={s.brandGold}>SYSTEMS</Text></Text>
            )}
            <View>
              <Text style={s.accred}>{COMPANY.accreditation}</Text>
              <Text style={s.contact}>{COMPANY.address} · {COMPANY.website} · {COMPANY.email}</Text>
            </View>
          </View>
          <View style={s.metaRight}>
            <Text style={s.sys}>QSL MAINTENANCE MANAGEMENT SYSTEM</Text>
            <Text style={s.mono}>GENERATED: {fmt(new Date())}</Text>
            {generatedByName ? <Text style={s.mono}>BY: {generatedByName}</Text> : null}
          </View>
        </View>
        <View style={s.rule} />

        <Text style={s.title}>Audit log</Text>
        <Text style={s.sub}>{logs.length} record{logs.length === 1 ? "" : "s"}{filterLabel ? ` · ${filterLabel}` : ""} · newest first</Text>

        <View style={[s.row, { marginTop: 10 }]} fixed>
          <Text style={[s.th, { width: "16%" }]}>Date &amp; time</Text>
          <Text style={[s.th, { width: "16%" }]}>Actor</Text>
          <Text style={[s.th, { width: "11%" }]}>Action</Text>
          <Text style={[s.th, { width: "12%" }]}>Entity</Text>
          <Text style={[s.th, { width: "45%" }]}>Summary</Text>
        </View>
        {logs.length === 0 ? (
          <Text style={[s.sub, { marginTop: 10 }]}>No audit records match this filter.</Text>
        ) : (
          logs.map((l, i) => (
            <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
              <Text style={[s.td, { width: "16%", fontFamily: "Courier", fontSize: 6.8 }]}>{fmt(l.at)}</Text>
              <Text style={[s.td, { width: "16%" }]}>{l.actorName || "—"}{l.actorRole ? `\n${l.actorRole}` : ""}</Text>
              <Text style={[s.td, { width: "11%", fontFamily: "Helvetica-Bold", color: ACTION_COLOR[l.action] || INK }]}>{l.action}</Text>
              <Text style={[s.td, { width: "12%" }]}>{l.entity}{l.entityId ? `\n${l.entityId}` : ""}</Text>
              <Text style={[s.td, { width: "45%" }]}>{l.summary}</Text>
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Audit log · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
