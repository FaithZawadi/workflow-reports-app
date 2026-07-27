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

const STATUS_LABEL = {
  PENDING_SUPERVISOR: "Supervisor review",
  PENDING_MANAGER: "Manager approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const STATUS_COLOR = { PENDING_SUPERVISOR: WAIT, PENDING_MANAGER: WAIT, APPROVED: PASS, REJECTED: FAIL };

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 32, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 2, fontFamily: "Courier" },
  contact: { fontSize: 6.5, color: MUTE, marginTop: 1 },
  metaRight: { alignItems: "flex-end" },
  mono: { fontSize: 8, fontFamily: "Courier", marginTop: 1 },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 5, marginBottom: 8 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  sub: { fontSize: 8.5, color: MUTE, marginTop: 2 },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 5 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  kpi: { width: "16.66%", padding: 4 },
  kpiBox: { borderWidth: 1, borderColor: "#E4DCCB", borderRadius: 3, padding: 8, alignItems: "center" },
  kpiNum: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  kpiLabel: { fontSize: 6.5, color: MUTE, textTransform: "uppercase", marginTop: 2, textAlign: "center", letterSpacing: 0.3 },
  row: { flexDirection: "row" },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 4, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 8, padding: 4, borderWidth: 0.5, borderColor: "#E4DCCB" },
  empty: { fontSize: 8.5, color: MUTE, fontStyle: "italic", marginTop: 4 },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
});

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function Kpi({ num, label, color }) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiBox}>
        <Text style={[s.kpiNum, color ? { color } : {}]}>{num}</Text>
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
    </View>
  );
}

// A simple two/three column count table.
function CountTable({ cols, rows }) {
  if (!rows.length) return <Text style={s.empty}>None in this period.</Text>;
  const widths = cols.map((c) => c.w);
  return (
    <View>
      <View style={s.row}>
        {cols.map((c, i) => (
          <Text key={i} style={[s.th, { width: widths[i], textAlign: c.align || "left" }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View style={s.row} key={ri} wrap={false}>
          {cols.map((c, i) => (
            <Text key={i} style={[s.td, { width: widths[i], textAlign: c.align || "left", color: c.color ? c.color(r) : INK }]}>
              {c.get(r)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ManagementReportDocument({ data, logoSrc, generatedByName, generatedByRole }) {
  const d = data || {};
  const rangeLabel =
    d.range && (d.range.from || d.range.to)
      ? `${fmtDate(d.range.from) || "start"} — ${fmtDate(d.range.to) || "today"}`
      : "All time";

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
              <Text style={s.brand}>QALIBRATED <Text style={s.brandGold}>SYSTEMS</Text></Text>
              <Text style={s.accred}>KENAS · ISO/IEC 17025:2017 · ISO/IEC 17020:2012 · ILAC-MRA</Text>
              <Text style={s.contact}>{COMPANY.address} · {COMPANY.website}</Text>
              <Text style={s.contact}>{COMPANY.email} · {COMPANY.phone}</Text>
            </View>
          </View>
          <View style={s.metaRight}>
            <Text style={s.mono}>GENERATED: {fmtDate(d.generatedAt)}</Text>
            <Text style={s.mono}>BY: {(generatedByName || "-").toUpperCase()}</Text>
            {generatedByRole ? <Text style={s.mono}>{generatedByRole.toUpperCase()}</Text> : null}
          </View>
        </View>
        <View style={s.rule} />

        <Text style={s.title}>Maintenance Management Report</Text>
        <Text style={s.sub}>Period: {rangeLabel} · {d.total || 0} report{d.total === 1 ? "" : "s"} in scope</Text>

        {/* Summary KPIs */}
        <View style={s.kpiRow}>
          <Kpi num={d.total || 0} label="Total reports" />
          <Kpi num={d.pending || 0} label="Pending" color={WAIT} />
          <Kpi num={d.approved || 0} label="Approved" color={PASS} />
          <Kpi num={d.rejected || 0} label="Rejected" color={FAIL} />
          <Kpi num={d.findingsCount || 0} label="Findings" color={FAIL} />
          <Kpi num={d.avgTurnaroundHours != null ? `${d.avgTurnaroundHours}h` : "—"} label="Avg approval" />
        </View>

        {/* Status breakdown */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Status breakdown</Text></View>
        <CountTable
          cols={[
            { label: "Status", w: "70%", get: (r) => STATUS_LABEL[r.key] || r.key, color: (r) => STATUS_COLOR[r.key] || INK },
            { label: "Reports", w: "30%", align: "right", get: (r) => r.count },
          ]}
          rows={Object.keys(d.byStatus || {}).map((k) => ({ key: k, count: d.byStatus[k] }))}
        />

        {/* By weighbridge */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By weighbridge</Text></View>
        <CountTable
          cols={[
            { label: "Weighbridge", w: "55%", get: (r) => r.id },
            { label: "Reports", w: "22%", align: "right", get: (r) => r.count },
            { label: "Findings", w: "23%", align: "right", get: (r) => r.findings, color: (r) => (r.findings ? FAIL : MUTE) },
          ]}
          rows={d.byWeighbridge || []}
        />

        {/* By client / site */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By client &amp; site</Text></View>
        <CountTable
          cols={[
            { label: "Client / site", w: "78%", get: (r) => r.name },
            { label: "Reports", w: "22%", align: "right", get: (r) => r.count },
          ]}
          rows={d.byClient || []}
        />

        {/* By report type */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By report type</Text></View>
        <CountTable
          cols={[
            { label: "Report type", w: "78%", get: (r) => `${r.name} (${r.code})` },
            { label: "Reports", w: "22%", align: "right", get: (r) => r.count },
          ]}
          rows={d.byTemplate || []}
        />

        {/* By author */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By person (filed)</Text></View>
        <CountTable
          cols={[
            { label: "Filed by", w: "78%", get: (r) => r.name },
            { label: "Reports", w: "22%", align: "right", get: (r) => r.count },
          ]}
          rows={d.byAuthor || []}
        />

        {/* Findings */}
        <View style={s.sectionBar} break><View style={s.swatch} /><Text style={s.sectionTitle}>Flagged findings — needs attention ({d.findingsCount || 0})</Text></View>
        {(!d.findings || !d.findings.length) ? (
          <Text style={s.empty}>No items needed attention in this period.</Text>
        ) : (
          <View>
            <View style={s.row}>
              <Text style={[s.th, { width: "15%" }]}>Serial</Text>
              <Text style={[s.th, { width: "30%" }]}>Item</Text>
              <Text style={[s.th, { width: "13%" }]}>Result</Text>
              <Text style={[s.th, { width: "27%" }]}>Remark</Text>
              <Text style={[s.th, { width: "15%" }]}>WB / date</Text>
            </View>
            {d.findings.map((f, i) => (
              <View style={s.row} key={i} wrap={false}>
                <Text style={[s.td, { width: "15%", fontFamily: "Courier", fontSize: 7 }]}>{f.serial}</Text>
                <Text style={[s.td, { width: "30%" }]}>{f.item}</Text>
                <Text style={[s.td, { width: "13%", color: FAIL, fontFamily: "Helvetica-Bold" }]}>{f.result}</Text>
                <Text style={[s.td, { width: "27%" }]}>{f.remark || "—"}</Text>
                <Text style={[s.td, { width: "15%", fontSize: 7 }]}>{f.weighbridgeId || "—"}{"\n"}{fmtDate(f.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Management Report · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
