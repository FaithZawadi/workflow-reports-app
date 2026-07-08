import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { templateByCode } from "@/lib/templates";
import { COMPANY } from "@/lib/company";

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
  page: { paddingTop: 34, paddingBottom: 52, paddingHorizontal: 34, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: COAL },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 3, fontFamily: "Courier" },
  contact: { fontSize: 6.5, color: MUTE, marginTop: 1.5 },
  metaRight: { alignItems: "flex-end" },
  sys: { fontSize: 6.5, color: MUTE, fontFamily: "Courier-Bold" },
  mono: { fontSize: 8, fontFamily: "Courier", marginTop: 1 },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 8, marginBottom: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textTransform: "uppercase", flex: 1, marginRight: 10 },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 2 },
  table: { marginBottom: 6 },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "17%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "33%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 4 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 3, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8, padding: 3, borderBottomWidth: 0.5, borderBottomColor: "#DDD" },
  tdCell: { fontSize: 8, padding: 3, borderWidth: 0.5, borderColor: "#DDD" },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#111", textAlign: "center", fontSize: 8 },
  freeField: { fontSize: 8.5, marginVertical: 1.5 },
  photoWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  photoCell: { width: "48%", margin: "1%" },
  photoImg: { width: "100%", height: 120, objectFit: "cover", borderWidth: 1, borderColor: "#999" },
  photoCap: { fontSize: 7, marginTop: 2 },
  sysNote: { marginTop: 18, padding: 8, borderWidth: 1, borderColor: GOLD, backgroundColor: "#FCF7EA" },
  sysNoteText: { fontSize: 8, color: INK, fontFamily: "Helvetica-Bold" },
  sysNoteSub: { fontSize: 7.5, color: MUTE, marginTop: 2 },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4 },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier" },
});

function fmt(d) {
  try {
    return new Date(d).toLocaleString();
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

export function ReportDocument({ report, logoSrc }) {
  const tpl = templateByCode(report.template);
  const data = report.data || {};
  const grids = data.grids || {};
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
  const rowSections = (tpl?.sections || []).filter((sec) => sec.type === "rows");
  const hasLoadcells = (tpl?.sections || []).some((sec) => sec.type === "loadcells");
  // The built-in Helvetica PDF font has no Greek omega glyph, so spell out "Ohm".
  const lcUnitLabel = grids.lcUnit === "ohm" ? "Impedance (Ohm)" : "Output (mV)";
  const lcRows = [
    { key: "lc", label: lcUnitLabel },
    { key: "corner", label: "Corner (kg)" },
  ];
  const freeFields = Object.entries(data.values || {}).filter(
    ([k, v]) => k !== "weighbridgeId" && v
  );
  const photos = (report.photos || []).filter((p) => (p.dataUrl || "").startsWith("data:image"));

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* header */}
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
              <Text style={s.contact}>
                {COMPANY.address} · {COMPANY.website}
              </Text>
              <Text style={s.contact}>
                {COMPANY.email} · {COMPANY.phone}
              </Text>
            </View>
          </View>
          <View style={s.metaRight}>
            <Text style={s.sys}>QSL MAINTENANCE MANAGEMENT SYSTEM v2.4</Text>
            <Text style={s.mono}>SERIAL NO: {report.serial}</Text>
            <Text style={s.mono}>GENERATED: {fmt(new Date())}</Text>
          </View>
        </View>
        <View style={s.rule} />

        {/* title left · status on the extreme right, same line */}
        <View style={s.titleRow}>
          <Text style={s.title}>{report.templateName}</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>

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

        {/* checklists — OK / ATTN moved left, REMARKS widened for comments */}
        {checklistSections.map(({ sec, idx }) => (
          <View key={idx} wrap={false}>
            <View style={s.sectionBar}>
              <View style={s.swatch} />
              <Text style={s.sectionTitle}>{sec.title}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.th, { width: "40%" }]}>ITEM</Text>
              <Text style={[s.th, { width: "9%", textAlign: "center" }]}>{sec.yes || "OK"}</Text>
              <Text style={[s.th, { width: "13%", textAlign: "center" }]}>{sec.no || "ATTN"}</Text>
              <Text style={[s.th, { width: "38%" }]}>REMARKS</Text>
            </View>
            {sec.items.map((it, ii) => {
              const v = data.checks?.[`${idx}:${ii}`];
              return (
                <View style={s.row} key={ii}>
                  <Cell style={{ width: "40%" }}>{it}</Cell>
                  <Cell style={{ width: "9%", textAlign: "center" }}>{v?.state === "ok" ? "X" : ""}</Cell>
                  <Cell style={{ width: "13%", textAlign: "center" }}>{v?.state === "problem" ? "X" : ""}</Cell>
                  <Cell style={{ width: "38%", color: FAIL }}>{v?.remark || ""}</Cell>
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

        {/* system-generated note — approvals are electronic, no physical signing */}
        <View style={s.sysNote} wrap={false}>
          <Text style={s.sysNoteText}>
            System-generated document — no physical signature required.
          </Text>
          <Text style={s.sysNoteSub}>
            All approvals are captured electronically by the named supervisor and manager and are
            recorded in the approval trail above.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>
            {COMPANY.name} · {COMPANY.address} · {COMPANY.website}
          </Text>
          <Text style={s.footText}>
            {COMPANY.email} · {COMPANY.phone} · {report.serial} · {COMPANY.accreditation}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
