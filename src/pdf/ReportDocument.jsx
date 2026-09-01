import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from "@react-pdf/renderer";
import { templateByCode } from "@/lib/templates";
import { chainFor } from "@/lib/approvalChain";
import { COMPANY } from "@/lib/company";
import { geofenceSummary } from "@/lib/geofence";
import { PdfHeader } from "./shared";

const GOLD = "#F5A800";
// Deep gold for gold TEXT on a light background — bright gold is too light to
// survive black & white printing/photocopying, so gold-on-white uses this.
const GOLD_DK = "#8A6A00";
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

// Layout is tuned to keep a routine report (e.g. the Daily Site Check with its
// checklist, a note and a few photos) on a single A4 page: trimmed page margins,
// tighter section spacing/table padding, and compact 3-up photos. Larger
// calibration sheets still flow onto extra pages naturally.
const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 40, paddingHorizontal: 30, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: COAL, letterSpacing: 0.3 },
  brandGold: { color: GOLD_DK },
  headText: { flex: 1 },
  accred: { fontSize: 6.8, color: MUTE, marginTop: 3, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  contact: { fontSize: 7.2, color: INK, marginTop: 2, fontFamily: "Helvetica" },
  // Right meta block: neat right-aligned label / value rows.
  metaRight: { alignItems: "flex-end", minWidth: 176 },
  sys: { fontSize: 6.4, color: MUTE, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 3, textTransform: "uppercase" },
  metaLine: { flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end", marginTop: 2 },
  metaK: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: MUTE, letterSpacing: 0.4, marginRight: 5 },
  metaVMono: { fontSize: 8.5, fontFamily: "Courier-Bold", color: COAL },
  metaV: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COAL },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 6, marginBottom: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase", flex: 1, marginRight: 10 },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 2 },
  table: { marginBottom: 4 },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 2.5, width: "17%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 2.5, width: "33%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  fillCell: { width: "50%", borderWidth: 0.5, borderColor: "#E4DCCB" },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 3 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 2.5, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8, padding: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#DDD" },
  tdCell: { fontSize: 8, padding: 2.5, borderWidth: 0.5, borderColor: "#DDD" },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#111", textAlign: "center", fontSize: 8 },
  freeField: { fontSize: 8.5, marginVertical: 1.5 },
  photoWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  photoCell: { width: "31.3%", margin: "1%" },
  photoImg: { width: "100%", height: 82, objectFit: "contain", backgroundColor: "#f3eee2", borderWidth: 1, borderColor: "#999" },
  photoCap: { fontSize: 6.5, marginTop: 1.5 },
  narrative: { marginTop: 4 },
  narrativeLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTE, textTransform: "uppercase" },
  narrativeText: { fontSize: 8.5, marginTop: 1.5, lineHeight: 1.25 },
  // Appealing narrative card: subtle paper fill + gold left accent.
  // Structured topic → response table for the job narrative.
  narrTable: { marginTop: 3, borderWidth: 0.5, borderColor: "#E4DCCB" },
  narrRow: { flexDirection: "row", alignItems: "stretch" },
  narrRowDiv: { borderTopWidth: 0.5, borderTopColor: "#E4DCCB" },
  narrKey: { width: "23%", backgroundColor: "#F5EEDD", padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: COAL, textTransform: "uppercase", letterSpacing: 0.3, borderRightWidth: 0.5, borderRightColor: "#E4DCCB" },
  narrVal: { width: "77%", padding: 4 },
  narrText: { fontSize: 8.5, lineHeight: 1.35, color: INK },
  bulletRow: { flexDirection: "row", marginTop: 1 },
  bulletDot: { fontSize: 8.5, color: GOLD, width: 9, fontFamily: "Helvetica-Bold" },
  bulletText: { fontSize: 8.5, flex: 1, lineHeight: 1.3, color: INK },
  // ISO document-control block (e.g. Site Instruction), rendered when a template
  // declares `docControl`.
  docCtrl: { marginTop: 10, borderWidth: 0.6, borderColor: "#C9C1B0", borderRadius: 3, overflow: "hidden" },
  docCtrlHead: { backgroundColor: "#22201C", paddingVertical: 3, paddingHorizontal: 6 },
  docCtrlHeadText: { fontSize: 6.8, color: GOLD, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  docCtrlBody: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, paddingTop: 6 },
  docCtrlItem: { width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 6 },
  docCtrlK: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: MUTE, width: 56, textTransform: "uppercase", letterSpacing: 0.3 },
  docCtrlV: { fontSize: 7.2, color: INK, flex: 1 },
  docCtrlNotice: { fontSize: 6.8, color: FAIL, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingBottom: 6, letterSpacing: 0.3 },
  // Printed wet-signature sign-off blocks (e.g. Site Instruction Section C).
  signWrap: { marginTop: 12 },
  signStatement: { fontSize: 8, color: INK, lineHeight: 1.35, marginBottom: 8 },
  signRow: { flexDirection: "row" },
  signCol: { flex: 1 },
  signColGap: { width: 14 },
  signTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COAL, textTransform: "uppercase", letterSpacing: 0.4, backgroundColor: "#F5EEDD", paddingVertical: 3, paddingHorizontal: 6, borderWidth: 0.5, borderColor: "#E4DCCB" },
  signBody: { borderWidth: 0.5, borderTopWidth: 0, borderColor: "#E4DCCB", paddingTop: 4, paddingHorizontal: 6, paddingBottom: 6 },
  signField: { flexDirection: "row", alignItems: "flex-end", marginTop: 8 },
  signFieldK: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTE, width: 58, textTransform: "uppercase", letterSpacing: 0.3 },
  signFieldLine: { flex: 1, borderBottomWidth: 0.7, borderBottomColor: "#8a8171", height: 11 },
  sysNote: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: GOLD, backgroundColor: "#FCF7EA" },
  sysNoteText: { fontSize: 8, color: INK, fontFamily: "Helvetica-Bold" },
  sysNoteSub: { fontSize: 7.5, color: MUTE, marginTop: 2 },
  footNote: { marginTop: 8, padding: 6, borderWidth: 1, borderColor: GOLD, backgroundColor: "#FCF7EA", flexDirection: "row", alignItems: "center" },
  footQr: { width: 52, height: 52, marginLeft: 6 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
  qrBlock: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#E4DCCB" },
  qrImg: { width: 68, height: 68, marginRight: 10 },
  qrText: { flex: 1 },
  qrTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4 },
  qrSub: { fontSize: 7.5, color: MUTE, marginTop: 2, lineHeight: 1.3, maxWidth: 260 },
});

// Timestamps are printed in East Africa Time. The PDF is rendered on the server
// (the container clock is UTC), so an unqualified toLocaleString would show UTC
// wall-clock time — e.g. a report completed 9:06 AM in Kenya would print 6:06 AM.
// Forcing Africa/Nairobi converts the stored UTC instant to the correct local time.
function fmt(d) {
  try {
    return (
      new Date(d).toLocaleString("en-GB", {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " EAT"
    );
  } catch {
    return String(d || "");
  }
}

// Right-aligned figures with a thousands separator (e.g. 1,250.5). Non-numeric
// text (positions, labels) is returned unchanged.
function fmtNum(v) {
  const str = String(v == null ? "" : v).trim();
  if (str === "") return "";
  const n = Number(str.replace(/,/g, ""));
  return Number.isNaN(n) ? str : n.toLocaleString("en-US");
}

const isNumericCol = (col) => !/position/i.test(col || "");

function Cell({ children, style }) {
  return <Text style={[s.td, style]}>{children}</Text>;
}

// Standard PDF Helvetica has no check-mark glyph, so draw the tick as vector
// strokes. Used to mark an "OK" inspection result in place of a plain "X".
function Tick() {
  return (
    <Svg width={9} height={9} viewBox="0 0 12 12">
      <Path d="M1.5 6.5 L4.5 9.5 L10.5 2.5" stroke={PASS} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function ReportDocument({ report, logoSrc, qrSrc }) {
  const tpl = templateByCode(report.template);
  const data = report.data || {};
  const grids = data.grids || {};
  const st = STATUS[report.status] || { label: report.status, color: INK };
  // Role-locked chains relabel the pending stages (e.g. "TECHNICAL MANAGER
  // REVIEW" / "PROJECT MANAGER APPROVAL") on the status badge and info panel.
  const chain = chainFor(report.template);
  const stLabel = chain
    ? report.status === "PENDING_SUPERVISOR"
      ? chain.SUPERVISOR.short
      : report.status === "PENDING_MANAGER"
      ? chain.MANAGER.short
      : st.label
    : st.label;
  // The service date (the date the work is FOR). For a backdated report this is
  // earlier than the creation/"generated" date shown in the header.
  const serviceDate = report.reportDate || report.createdAt;
  // The Technical Report isn't tied to a weighbridge — show the vehicle instead.
  const isTechReport = report.template === "TR01";
  const meta = [
    ["Client", report.clientName || "-", "Site", report.site || "-"],
    isTechReport
      ? ["Vehicle no.", data.values?.vehicleNo || "-", "Report type", tpl?.cadence ? `${tpl.cadence} (${report.template})` : report.template]
      : ["Weighbridge", report.weighbridgeId || "-", "Report type", tpl?.cadence ? `${tpl.cadence} (${report.template})` : report.template],
    ["Completed by", report.authorName || "-", "Date", fmt(serviceDate)],
    [
      isTechReport ? "Technical Manager" : "Supervisor",
      report.supervisorEmail || "-",
      isTechReport ? "Project Manager" : "Manager",
      report.managerEmail || "-",
    ],
  ];
  // Geofence line — proof of where the report was filed, when captured.
  const geoLabel = geofenceSummary(report.geofenceStatus, report.geofenceDistanceM, report.site);
  if (geoLabel) {
    const coords =
      report.filedLat != null && report.filedLng != null
        ? `${Number(report.filedLat).toFixed(5)}, ${Number(report.filedLng).toFixed(5)}`
        : "-";
    meta.push(["Filed location", geoLabel, "GPS", coords]);
  }
  const checklistSections = (tpl?.sections || [])
    .map((sec, idx) => ({ sec, idx }))
    .filter(({ sec }) => sec.type === "checklist");
  const rowSections = (tpl?.sections || []).filter((sec) => sec.type === "rows");
  const hasLoadcells = (tpl?.sections || []).some((sec) => sec.type === "loadcells");
  // The built-in Helvetica PDF font has no Greek omega glyph, so spell out "Ohm".
  const lcUnitLabel = grids.lcUnit === "ohm" ? "Impedance (Ohm)" : "Output (mV)";
  const lcRows = [
    { key: "lc", label: lcUnitLabel },
    { key: "corner", label: "Corner (kg)" },
  ];
  // Proper field labels + the template's declaration order, so the report reads
  // in the same logical sequence as the form (e.g. Fault → Findings → Correction
  // → Result → Parts) rather than raw object-key order. Long narrative fields
  // (textareas) are kept full width; short fields go in a tidy table.
  const fieldLabels = {};
  const longKeys = new Set();
  const fieldOrder = {};
  let _oi = 0;
  (tpl?.sections || []).forEach((sec) => {
    if (sec.type === "fields") sec.fields.forEach((f) => { fieldLabels[f.k] = f.label; fieldOrder[f.k] = _oi++; });
    else if (sec.type === "choices") { fieldLabels[sec.k] = sec.title; fieldOrder[sec.k] = _oi++; }
    else if (sec.type === "textarea") {
      fieldLabels[sec.k] = sec.label;
      longKeys.add(sec.k);
      fieldOrder[sec.k] = _oi++;
    }
  });
  const labelFor = (k) =>
    fieldLabels[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  const freeFields = Object.entries(data.values || {})
    // vehicleNo is shown in the meta header for the Technical Report — don't repeat it.
    .filter(([k, v]) => k !== "weighbridgeId" && !(isTechReport && k === "vehicleNo") && v)
    .sort((a, b) => (fieldOrder[a[0]] ?? 999) - (fieldOrder[b[0]] ?? 999));
  const detailFields = freeFields.filter(([k]) => !longKeys.has(k));
  const narrativeFields = freeFields.filter(([k]) => longKeys.has(k));
  const detailRows = [];
  for (let i = 0; i < detailFields.length; i += 2) detailRows.push(detailFields.slice(i, i + 2));
  const photos = (report.photos || []).filter((p) => (p.dataUrl || "").startsWith("data:image"));

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* Shared letterhead — common to every system PDF. */}
        <PdfHeader
          logoSrc={logoSrc}
          sys="QSL Maintenance Management System v2.4"
          meta={[
            { k: "SERIAL NO", v: report.serial, mono: true },
            // The day the report was filed in the system (a backdated report's
            // service date, shown below, can differ).
            { k: "GENERATED", v: fmt(report.createdAt) },
          ]}
        />

        {/* title left · status on the extreme right, same line */}
        <View style={s.titleRow}>
          <Text style={s.title}>{report.templateName}</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{stLabel}</Text>
        </View>

        {/* Info panel — meta + key details in one continuous key/value table. */}
        <View style={s.table}>
          {meta.map((r, i) => (
            <View style={s.row} key={`m${i}`}>
              <Text style={s.key}>{r[0]}</Text>
              <Text style={s.val}>{r[1]}</Text>
              <Text style={s.key}>{r[2]}</Text>
              <Text style={s.val}>{r[3]}</Text>
            </View>
          ))}
          {detailRows.map((pair, ri) => (
            <View style={s.row} key={`d${ri}`}>
              {[0, 1].map((ci) => {
                const cell = pair[ci];
                // A trailing odd cell renders as a plain filler — never an empty
                // cream label box, which looked unfinished.
                if (!cell) return <View key={ci} style={s.fillCell} />;
                return (
                  <React.Fragment key={ci}>
                    <Text style={s.key}>{labelFor(cell[0])}</Text>
                    <Text style={s.val}>{String(cell[1])}</Text>
                  </React.Fragment>
                );
              })}
            </View>
          ))}
        </View>

        {/* Job narrative — a structured topic → response table. Each field is a
            labelled row (topic on the left, response on the right); dash/bullet
            lines render as a tidy bulleted list. */}
        {narrativeFields.length > 0 && (
          <View wrap={false}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>{isTechReport ? "Job details" : "Details"}</Text>
            </View>
            <View style={s.narrTable}>
              {narrativeFields.map(([k, v], ri) => {
                const lines = String(v).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                const bulleted = lines.length > 1 && lines.every((l) => /^[-•*]/.test(l));
                return (
                  <View style={[s.narrRow, ri > 0 && s.narrRowDiv]} key={k} wrap={false}>
                    <Text style={s.narrKey}>{labelFor(k)}</Text>
                    <View style={s.narrVal}>
                      {bulleted ? (
                        lines.map((l, i) => (
                          <View style={s.bulletRow} key={i}>
                            <Text style={s.bulletDot}>•</Text>
                            <Text style={s.bulletText}>{l.replace(/^[-•*]\s*/, "")}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={s.narrText}>{String(v)}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* checklists — one result column per state (OK/ATTN/N/A, PASS/ADJ/FAIL, …) */}
        {checklistSections.map(({ sec, idx }) => {
          const states = sec.states || [
            { key: "ok", label: sec.yes || "OK" },
            { key: "problem", label: sec.no || "NO" },
          ];
          // Item stays only as wide as it needs (so the result column sits close
          // to the text); result columns stay narrow; Remarks takes the rest.
          const stateW = `${(12 / states.length).toFixed(2)}%`;
          const itemW = "44%";
          const remarksW = `${(100 - 44 - 12).toFixed(0)}%`; // 44%
          const itemCell = { fontSize: 7.5 };
          const tickKeys = new Set(["ok", "pass"]);
          const vline = { borderRightWidth: 0.5, borderColor: "#AFAFAF" };
          return (
            <View key={idx} wrap={false}>
              <View style={s.sectionBar}>
                <View style={s.swatch} />
                <Text style={s.sectionTitle}>{sec.title}</Text>
              </View>
              <View style={{ borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: "#AFAFAF" }}>
                <View style={s.row}>
                  <Text style={[s.th, vline, { width: itemW }]}>ITEM</Text>
                  {states.map((st) => (
                    <Text key={st.key} style={[s.th, vline, { width: stateW, textAlign: "center" }]}>{st.label}</Text>
                  ))}
                  <Text style={[s.th, vline, { width: remarksW }]}>REMARKS</Text>
                </View>
                {sec.items.map((it, ii) => {
                  const v = data.checks?.[`${idx}:${ii}`];
                  return (
                    <View style={s.row} key={ii}>
                      <Cell style={[vline, itemCell, { width: itemW }]}>{it}</Cell>
                      {states.map((st) => (
                        <View key={st.key} style={[s.td, vline, { width: stateW, alignItems: "center", justifyContent: "center" }]}>
                          {v?.state === st.key ? (tickKeys.has(st.key) ? <Tick /> : <Text>X</Text>) : null}
                        </View>
                      ))}
                      <Cell style={[vline, { width: remarksW, color: FAIL }]}>{v?.remark || ""}</Cell>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

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
              (limit {fmtNum(data.weekly.limit) || "-"} kg)
            </Text>
            <Text style={{ fontSize: 8, marginTop: 2, fontFamily: "Courier" }}>
              Runs:{" "}
              {["1", "2"]
                .map(
                  (r) =>
                    `[${fmtNum(data.runs?.[r + "a"]) || "-"} / ${fmtNum(data.runs?.[r + "m"]) || "-"} / ${fmtNum(data.runs?.[r + "b"]) || "-"}]`
                )
                .join("   ")}
            </Text>
          </View>
        )}

        {/* load cell readings — proper table, right-aligned figures */}
        {hasLoadcells && (
          <View wrap={false} style={{ marginTop: 4 }}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>Load cell readings</Text>
            </View>
            {lcRows.map((row) => (
              <View style={s.row} key={row.key}>
                <Text style={[s.tdCell, { width: "20%", fontFamily: "Helvetica-Bold", backgroundColor: "#F5EEDD" }]}>
                  {row.label}
                </Text>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Text style={[s.tdCell, { width: "10%", textAlign: "right" }]} key={i}>
                    {fmtNum(grids[`${row.key}:${i}`])}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* calibration / measurement tables (WB06 increasing-load & eccentricity) */}
        {rowSections.map((sec, si) => {
          const w = `${(100 / sec.cols.length).toFixed(2)}%`;
          return (
            <View key={si} wrap={false} style={{ marginTop: 4 }}>
              <View style={s.sectionBar}>
                <View style={s.swatch} />
                <Text style={s.sectionTitle}>{sec.title}</Text>
              </View>
              <View style={s.row}>
                {sec.cols.map((c) => (
                  <Text style={[s.th, { width: w, textAlign: isNumericCol(c) ? "right" : "left" }]} key={c}>
                    {c}
                  </Text>
                ))}
              </View>
              {Array.from({ length: sec.rows }).map((_, ri) => (
                <View style={s.row} key={ri}>
                  {sec.cols.map((c, ci) => {
                    const raw = grids[`${sec.key}:${ri}:${ci}`] ?? (sec.prefill?.[ri]?.[ci] || "");
                    const numeric = isNumericCol(c);
                    return (
                      <Text style={[s.tdCell, { width: w, textAlign: numeric ? "right" : "left" }]} key={ci}>
                        {numeric ? fmtNum(raw) : String(raw)}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

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

        {/* ISO document-control block — controlled-document identity per QSL SOPs. */}
        {tpl?.docControl ? (
          <View style={s.docCtrl} wrap={false}>
            <View style={s.docCtrlHead}><Text style={s.docCtrlHeadText}>Document control</Text></View>
            <View style={s.docCtrlBody}>
              <View style={[s.docCtrlItem, { width: "100%" }]}><Text style={s.docCtrlK}>Reference</Text><Text style={s.docCtrlV}>{tpl.docControl.reference}</Text></View>
              <View style={s.docCtrlItem}><Text style={s.docCtrlK}>Doc no.</Text><Text style={s.docCtrlV}>{tpl.docControl.docNo}</Text></View>
              <View style={s.docCtrlItem}><Text style={s.docCtrlK}>SI no.</Text><Text style={s.docCtrlV}>{report.serial}</Text></View>
              <View style={s.docCtrlItem}><Text style={s.docCtrlK}>Revision</Text><Text style={s.docCtrlV}>{tpl.docControl.revision}</Text></View>
              <View style={s.docCtrlItem}><Text style={s.docCtrlK}>Issue date</Text><Text style={s.docCtrlV}>{tpl.docControl.issueDate}</Text></View>
            </View>
            {tpl.docControl.notice ? <Text style={s.docCtrlNotice}>{tpl.docControl.notice}</Text> : null}
          </View>
        ) : null}

        {/* Printed wet-signature sign-off (Section C) — used instead of the
            electronic-signature note when the template declares signOff. */}
        {tpl?.signOff ? (
          <View style={s.signWrap} wrap={false}>
            <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>{tpl.signOff.title || "Sign-off"}</Text></View>
            {tpl.signOff.statement ? <Text style={s.signStatement}>{tpl.signOff.statement}</Text> : null}
            <View style={s.signRow}>
              {(tpl.signOff.parties || []).map((party, pi) => (
                <React.Fragment key={pi}>
                  {pi > 0 ? <View style={s.signColGap} /> : null}
                  <View style={s.signCol}>
                    <Text style={s.signTitle}>{party}</Text>
                    <View style={s.signBody}>
                      {(tpl.signOff.lines || ["Name", "Signature", "Date"]).map((ln, li) => (
                        <View style={s.signField} key={li}>
                          <Text style={s.signFieldK}>{ln}</Text>
                          <View style={s.signFieldLine} />
                        </View>
                      ))}
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {qrSrc ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrSrc} style={[s.footQr, { marginLeft: 0, marginRight: 8 }]} />
                <Text style={s.sysNoteSub}>Scan to verify this instruction online.</Text>
              </View>
            ) : null}
          </View>
        ) : (
          /* Electronic-signature note + scan-to-verify QR as one compact block, so
             the QR never orphans onto a near-empty extra page. */
          <View style={s.footNote} wrap={false}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.sysNoteText}>System-generated document — no physical signature required.</Text>
              <Text style={s.sysNoteSub}>
                All approvals are captured electronically by the named approvers and recorded in the approval trail above.
                {qrSrc ? " Scan the code to verify this report online." : ""}
              </Text>
            </View>
            {qrSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={qrSrc} style={s.footQr} />
            ) : null}
          </View>
        )}

        {/* Footer carries only the document identity + page number — the company
            contact block lives in the header and is not repeated here. */}
        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => (
            `${COMPANY.name} · ${report.serial} · Page ${pageNumber} of ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  );
}
