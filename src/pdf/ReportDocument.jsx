import React from "react";
import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { templateByCode } from "@/lib/templates";

// The QSL emblem, embedded as a data URL so the PDF is self-contained.
let _markUri = null;
function markUri() {
  if (_markUri !== null) return _markUri || null;
  try {
    const file = path.join(process.cwd(), "public", "icons", "icon-512-transparent.png");
    _markUri = "data:image/png;base64," + fs.readFileSync(file).toString("base64");
  } catch {
    _markUri = "";
  }
  return _markUri || null;
}

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";
const LINEC = "#BBBBBB";

const STATUS = {
  PENDING_SUPERVISOR: { label: "SUPERVISOR REVIEW", color: "#946B00" },
  PENDING_MANAGER: { label: "MANAGER APPROVAL", color: "#946B00" },
  APPROVED: { label: "APPROVED", color: PASS },
  REJECTED: { label: "REJECTED", color: FAIL },
};

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandMark: { width: 30, height: 30, marginRight: 8 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: COAL },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 3, fontFamily: "Courier" },
  metaRight: { alignItems: "flex-end" },
  sys: { fontSize: 6.5, color: MUTE, fontFamily: "Courier-Bold" },
  mono: { fontSize: 8, fontFamily: "Courier", marginTop: 1 },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 8, marginBottom: 8 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  statusLine: { fontSize: 8, color: MUTE, marginTop: 2, marginBottom: 6 },
  table: { marginBottom: 6 },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "17%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "33%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 4 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 3, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8, padding: 3, borderBottomWidth: 0.5, borderBottomColor: "#DDD" },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#111", textAlign: "center", fontSize: 8 },
  freeField: { fontSize: 8.5, marginVertical: 1.5 },
  photoWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  photoCell: { width: "48%", margin: "1%" },
  photoImg: { width: "100%", height: 120, objectFit: "cover", borderWidth: 1, borderColor: "#999" },
  photoCap: { fontSize: 7, marginTop: 2 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  sigCol: { width: "31%" },
  sigLine: { borderTopWidth: 1, borderTopColor: "#111", paddingTop: 3, fontSize: 8, fontFamily: "Helvetica-Bold" },
  sigHint: { fontSize: 7, color: MUTE },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, flexDirection: "row", justifyContent: "space-between" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier" },
});

function fmt(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || "");
  }
}

function Cell({ children, style }) {
  return <Text style={[s.td, style]}>{children}</Text>;
}

export function ReportDocument({ report }) {
  const tpl = templateByCode(report.template);
  const data = report.data || {};
  const st = STATUS[report.status] || { label: report.status, color: INK };
  const meta = [
    ["Client", report.clientName || "-", "Site", report.site || "-"],
    ["Weighbridge", report.weighbridgeId || "-", "Report type", report.template],
    ["Completed by", report.authorName || "-", "Date", fmt(report.createdAt)],
    ["Supervisor", report.supervisorEmail || "-", "Manager", report.managerEmail || "-"],
  ];
  const checklistSections = (tpl?.sections || [])
    .map((sec, idx) => ({ sec, idx }))
    .filter(({ sec }) => sec.type === "checklist");
  const freeFields = Object.entries(data.values || {}).filter(
    ([k, v]) => k !== "weighbridgeId" && v
  );
  const gridEntries = Object.entries(data.grids || {}).filter(([, v]) => v);
  const photos = (report.photos || []).filter((p) => (p.dataUrl || "").startsWith("data:image"));

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* header */}
        <View style={s.topRow}>
          <View style={s.brandRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {markUri() && <Image style={s.brandMark} src={markUri()} />}
            <View>
              <Text style={s.brand}>
                QALIBRATED <Text style={s.brandGold}>SYSTEMS</Text>
              </Text>
              <Text style={s.accred}>KENAS · ISO/IEC 17025:2017 · ISO/IEC 17020:2012 · ILAC-MRA</Text>
            </View>
          </View>
          <View style={s.metaRight}>
            <Text style={s.sys}>QSL MAINTENANCE MANAGEMENT SYSTEM v2.4</Text>
            <Text style={s.mono}>SERIAL NO: {report.serial}</Text>
            <Text style={s.mono}>GENERATED: {fmt(new Date())}</Text>
          </View>
        </View>
        <View style={s.rule} />
        <Text style={s.title}>{report.templateName}</Text>
        <Text style={s.statusLine}>
          STATUS: <Text style={{ color: st.color, fontFamily: "Helvetica-Bold" }}>{st.label}</Text>
        </Text>

        {/* meta */}
        <View style={s.table}>
          {meta.map((r, i) => (
            <View style={s.row} key={i}>
              <Text style={s.key}>{r[0]}</Text>
              <Text style={s.val}>{r[1]}</Text>
              <Text style={s.key}>{r[2]}</Text>
              <Text style={s.val}>{r[3]}</Text>
            </View>
          ))}
        </View>

        {/* free fields */}
        {freeFields.map(([k, v]) => (
          <Text style={s.freeField} key={k}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: MUTE, textTransform: "uppercase", fontSize: 7.5 }}>
              {k}:{" "}
            </Text>
            {String(v)}
          </Text>
        ))}

        {/* checklists */}
        {checklistSections.map(({ sec, idx }) => (
          <View key={idx} wrap={false}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>{sec.title}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.th, { width: "58%" }]}>ITEM</Text>
              <Text style={[s.th, { width: "10%", textAlign: "center" }]}>{sec.yes || "OK"}</Text>
              <Text style={[s.th, { width: "12%", textAlign: "center" }]}>{sec.no || "ATTN"}</Text>
              <Text style={[s.th, { width: "20%" }]}>REMARKS</Text>
            </View>
            {sec.items.map((it, ii) => {
              const v = data.checks?.[`${idx}:${ii}`];
              return (
                <View style={s.row} key={ii}>
                  <Cell style={{ width: "58%" }}>{it}</Cell>
                  <Cell style={{ width: "10%", textAlign: "center" }}>{v?.state === "ok" ? "X" : ""}</Cell>
                  <Cell style={{ width: "12%", textAlign: "center" }}>{v?.state === "problem" ? "X" : ""}</Cell>
                  <Cell style={{ width: "20%", color: FAIL }}>{v?.remark || ""}</Cell>
                </View>
              );
            })}
          </View>
        ))}

        {/* weekly verdict */}
        {data.weekly && (
          <View style={{ marginTop: 8, padding: 6, borderWidth: 1, borderColor: "#111" }}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
              WEEKLY END-MIDDLE-END TEST:{" "}
              {data.weekly.pass === null
                ? "not completed"
                : data.weekly.pass
                ? "WITHIN LIMIT"
                : "OVER LIMIT - QSL ATTENTION REQUIRED"}{" "}
              (limit {data.weekly.limit || "-"} kg)
            </Text>
            <Text style={{ fontSize: 8, marginTop: 2, fontFamily: "Courier" }}>
              Runs:{" "}
              {["1", "2"]
                .map(
                  (r) =>
                    `[${data.runs?.[r + "a"] || "-"} / ${data.runs?.[r + "m"] || "-"} / ${data.runs?.[r + "b"] || "-"}]`
                )
                .join("   ")}
            </Text>
          </View>
        )}

        {/* grids */}
        {gridEntries.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>Recorded readings</Text>
            </View>
            <Text style={{ fontSize: 7.5, color: "#333", fontFamily: "Courier" }}>
              {gridEntries.map(([k, v]) => `${k}=${v}`).join("   |   ")}
            </Text>
          </View>
        )}

        {/* photos */}
        {photos.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>Photo evidence</Text>
            </View>
            <View style={s.photoWrap}>
              {photos.map((p, i) => (
                <View style={s.photoCell} key={i} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.photoImg} src={p.dataUrl} />
                  <Text style={s.photoCap}>
                    {i + 1}. {p.caption || "(no caption)"}
                    {p.takenAt ? ` · ${fmt(p.takenAt)}` : ""}
                    {p.gpsLat != null ? ` · GPS ${p.gpsLat.toFixed(5)}, ${p.gpsLng.toFixed(5)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* trail */}
        <View style={s.sectionBar}>
          <View style={s.swatch} />
          <Text style={s.sectionTitle}>Approval trail</Text>
        </View>
        <View style={s.row}>
          <Text style={[s.th, { width: "50%" }]}>ACTION</Text>
          <Text style={[s.th, { width: "28%" }]}>BY</Text>
          <Text style={[s.th, { width: "22%" }]}>DATE / TIME</Text>
        </View>
        {(report.trailEvents || []).map((t, i) => (
          <View style={s.row} key={i}>
            <Cell style={{ width: "50%" }}>
              {t.action}
              {t.comment ? ` - "${t.comment}"` : ""}
            </Cell>
            <Cell style={{ width: "28%" }}>{t.byName}</Cell>
            <Cell style={{ width: "22%" }}>{fmt(t.at)}</Cell>
          </View>
        ))}

        {/* signatures */}
        <View style={s.sigRow}>
          {["Technician / Engineer", "Supervisor", "Manager"].map((who) => (
            <View style={s.sigCol} key={who}>
              <Text style={s.sigLine}>{who}</Text>
              <Text style={s.sigHint}>Name / Signature / Date</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>
            SYSTEM-GENERATED {report.serial} | QALIBRATED SYSTEMS LTD | KENAS ISO/IEC 17025 + 17020 | ILAC-MRA
          </Text>
          <Text style={s.footText}>+254 714 999 996</Text>
        </View>
      </Page>
    </Document>
  );
}
