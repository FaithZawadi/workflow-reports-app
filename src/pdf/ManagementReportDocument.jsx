import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { ReportDetailBlocks } from "./ReportDetailBlocks";

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";
const WAIT = "#946B00";
const BAR_COLORS = ["#161310", "#946B00", "#2E7D46", "#3B82C4", "#B03A2E", "#7A5CCB", "#0E7C86", "#C2711C"];

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
  sectionNote: { fontSize: 7, color: MUTE, marginLeft: 6 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  kpi: { width: "16.66%", padding: 4 },
  kpiBox: { borderWidth: 1, borderColor: "#E4DCCB", borderRadius: 3, padding: 8, alignItems: "center" },
  kpiNum: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  kpiLabel: { fontSize: 6.5, color: MUTE, textTransform: "uppercase", marginTop: 2, textAlign: "center", letterSpacing: 0.3 },
  kpiDelta: { fontSize: 6.5, fontFamily: "Helvetica-Bold", marginTop: 2, textAlign: "center" },
  kpiSub: { fontSize: 6, color: MUTE, marginTop: 1, textAlign: "center" },
  insRow: { flexDirection: "row", marginTop: 8 },
  insCell: { flex: 1, borderLeftWidth: 3, paddingLeft: 7, paddingRight: 7, paddingVertical: 3, marginRight: 7 },
  insTitle: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: MUTE },
  insBody: { fontSize: 8, marginTop: 2, lineHeight: 1.3 },
  healthRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  healthNum: { fontSize: 26, fontFamily: "Helvetica-Bold", width: 70 },
  healthBarTrack: { flex: 1, height: 12, backgroundColor: "#F0EADD", borderRadius: 3, overflow: "hidden", marginHorizontal: 8 },
  healthBarFill: { height: 12, borderRadius: 3 },
  healthNote: { fontSize: 7.5, color: MUTE, width: 150 },
  rateRow: { flexDirection: "row", marginTop: 6 },
  rateCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderLeftWidth: 3, marginRight: 6, backgroundColor: "#FAF7F0" },
  rateNum: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  rateLabel: { fontSize: 6.5, color: MUTE, textTransform: "uppercase", marginTop: 1, letterSpacing: 0.3 },
  opsMoneyRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 2 },
  opsMoney: { fontSize: 8, color: MUTE },
  opsLine: { flexDirection: "row", marginTop: 5, alignItems: "baseline" },
  opsLineLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: MUTE, width: 110, letterSpacing: 0.3 },
  opsLineVal: { fontSize: 8.5, flex: 1 },
  opsDueRow: { flexDirection: "row", marginTop: 3, alignItems: "center" },
  opsDueLabel: { fontSize: 8, flex: 1 },
  opsDueWb: { fontSize: 7, fontFamily: "Courier", color: MUTE, width: 70 },
  opsDueDate: { fontSize: 7.5, fontFamily: "Helvetica-Bold", width: 60, textAlign: "right" },
  row: { flexDirection: "row" },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 4, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 8, padding: 4, borderWidth: 0.5, borderColor: "#E4DCCB" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3, paddingVertical: 1 },
  barLabel: { width: "40%", fontSize: 8, paddingRight: 6 },
  barTrack: { flex: 1, height: 10, backgroundColor: "#F0EADD", borderRadius: 2, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 2 },
  barVal: { width: 42, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", paddingLeft: 4 },
  trendWrap: { flexDirection: "row", alignItems: "flex-end", height: 60, marginTop: 4, borderBottomWidth: 0.5, borderColor: "#E4DCCB", paddingTop: 2 },
  trendBar: { flex: 1, marginHorizontal: 0.6, backgroundColor: GOLD, minHeight: 1 },
  trendAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  trendTick: { fontSize: 6, color: MUTE },
  empty: { fontSize: 8.5, color: MUTE, fontStyle: "italic", marginTop: 4 },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
  apxCard: { borderWidth: 0.5, borderColor: "#D9D2C4", borderRadius: 3, padding: 6, marginBottom: 7 },
  apxHead: { borderBottomWidth: 0.5, borderColor: "#E6E0D2", paddingBottom: 3, marginBottom: 2 },
  apxSerial: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK },
  apxMeta: { fontSize: 7, color: MUTE, marginTop: 1 },
});

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function deltaText(delta) {
  if (!delta) return null;
  if (delta.diff === 0) return { txt: "no change", color: MUTE };
  const sign = delta.diff > 0 ? "+" : "-";
  const color = delta.trend === "good" ? PASS : delta.trend === "bad" ? FAIL : MUTE;
  return { txt: `${sign}${delta.abs}${delta.unit ? " " + delta.unit : ""} vs prev`, color };
}

function Kpi({ num, label, sub, color, delta }) {
  const dt = deltaText(delta);
  return (
    <View style={s.kpi}>
      <View style={s.kpiBox}>
        <Text style={[s.kpiNum, color ? { color } : {}]}>{num}</Text>
        <Text style={s.kpiLabel}>{label}</Text>
        {dt ? <Text style={[s.kpiDelta, { color: dt.color }]}>{dt.txt}</Text> : null}
        {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// A horizontal bar chart — one row per item, filled proportionally to the max.
function BarChart({ items, color }) {
  if (!items || !items.length) return <Text style={s.empty}>None in this period.</Text>;
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <View>
      {items.map((it, i) => (
        <View style={s.barRow} key={i} wrap={false}>
          <Text style={s.barLabel} hyphenationCallback={(w) => [w]}>{it.label}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(3, (it.value / max) * 100)}%`, backgroundColor: color || it.color || GOLD }]} />
          </View>
          <Text style={s.barVal}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

// The wider operational picture — quotation pipeline (with value), calibration
// requests, satisfaction, task workload and overdue maintenance / contracts.
function OperationsBlock({ ops }) {
  const q = ops.quotes;
  const crf = ops.crf;
  const tasks = ops.tasks;
  const sat = ops.satisfaction;
  const sch = ops.schedules;
  const con = ops.contracts;

  const pulse = [];
  if (crf) pulse.push({ num: crf.total, label: "Calibration reqs", color: WAIT });
  if (sat && sat.avg != null) pulse.push({ num: `${sat.avg}/5`, label: "Cust. satisfaction", color: WAIT });
  if (tasks) pulse.push({ num: tasks.open, label: "Open tasks", color: tasks.overdue ? FAIL : INK });
  if (sch) pulse.push({ num: sch.overdue, label: "Overdue maint.", color: sch.overdue ? FAIL : PASS });
  if (typeof ops.fleet === "number") pulse.push({ num: ops.fleet, label: "Weighbridges", color: INK });

  return (
    <View>
      <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Across the business</Text></View>

      {pulse.length ? (
        <View style={s.rateRow}>
          {pulse.map((p, i) => (
            <View key={i} style={[s.rateCell, { borderLeftColor: p.color, marginRight: i === pulse.length - 1 ? 0 : 6 }]}>
              <Text style={[s.rateNum, { color: p.color }]}>{p.num}</Text>
              <Text style={s.rateLabel}>{p.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {crf ? (
        <View style={s.opsLine}>
          <Text style={s.opsLineLabel}>Calibration requests</Text>
          <Text style={s.opsLineVal}>{crf.total} total · {crf.submitted} submitted · {crf.accepted} accepted · {crf.rejected} rejected · {crf.inSitu} in-situ / {crf.lab} lab</Text>
        </View>
      ) : null}

      {tasks ? (
        <View style={s.opsLine}>
          <Text style={s.opsLineLabel}>Task workload</Text>
          <Text style={s.opsLineVal}>{tasks.open} open · {tasks.inProgress} in progress · {tasks.blocked} blocked · {tasks.done} done · <Text style={{ color: tasks.overdue ? FAIL : MUTE, fontFamily: "Helvetica-Bold" }}>{tasks.overdue} overdue</Text></Text>
        </View>
      ) : null}

      {sat && sat.avg != null ? (
        <View style={s.opsLine}>
          <Text style={s.opsLineLabel}>Customer satisfaction</Text>
          <Text style={s.opsLineVal}>{sat.avg} / 5 from {sat.count} response{sat.count === 1 ? "" : "s"}{sat.recommendRate != null ? ` · ${sat.recommendRate}% would recommend` : ""}{ops.training && ops.training.avg != null ? ` · training ${ops.training.avg}/5` : ""}</Text>
        </View>
      ) : null}

      {sch && sch.overdueList && sch.overdueList.length ? (
        <>
          <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Overdue maintenance</Text><Text style={s.sectionNote}>{sch.overdue} overdue · {sch.dueSoon} due this week</Text></View>
          {sch.overdueList.map((r, i) => (
            <View style={s.opsDueRow} key={i} wrap={false}>
              <Text style={s.opsDueLabel}>{r.label}</Text>
              <Text style={s.opsDueWb}>{r.weighbridgeId}</Text>
              <Text style={[s.opsDueDate, { color: FAIL }]}>{fmtDate(r.dueAt)}</Text>
            </View>
          ))}
        </>
      ) : null}

      {con && con.upcomingList && con.upcomingList.length ? (
        <>
          <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Service contracts — upcoming</Text><Text style={s.sectionNote}>{con.overdue} overdue · {con.dueSoon} within 30 days</Text></View>
          {con.upcomingList.map((r, i) => (
            <View style={s.opsDueRow} key={i} wrap={false}>
              <Text style={s.opsDueLabel}>{r.label}</Text>
              <Text style={[s.opsDueDate, { color: r.overdue ? FAIL : WAIT }]}>{fmtDate(r.dueAt)}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const REG_STATUS = {
  APPROVED: { label: "Approved", color: PASS },
  PENDING_SUPERVISOR: { label: "In review", color: WAIT },
  PENDING_MANAGER: { label: "Awaiting", color: WAIT },
  REJECTED: { label: "Returned", color: FAIL },
};

// Platform-usage tiles — the "everything the app did" summary.
function UsageBlock({ usage }) {
  const tiles = [
    { num: usage.servicesDelivered, label: "Services delivered" },
    { num: usage.checklistItems, label: "Checks completed" },
    { num: usage.photos, label: "Photos captured" },
    { num: usage.weighbridgesServiced, label: "Weighbridges" },
    { num: usage.sitesServiced, label: "Sites" },
    { num: usage.staffActive, label: "Staff active" },
  ];
  return (
    <View>
      <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Platform activity this period</Text></View>
      <View style={s.kpiRow}>
        {tiles.map((t, i) => (
          <View style={s.kpi} key={i}>
            <View style={s.kpiBox}>
              <Text style={s.kpiNum}>{Number(t.num || 0).toLocaleString()}</Text>
              <Text style={s.kpiLabel}>{t.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// The full itemised service register — one row per report, wraps across pages.
function RegisterBlock({ rows }) {
  return (
    <View>
      <View style={s.sectionBar} wrap={false}><View style={s.swatch} /><Text style={s.sectionTitle}>Service register — every report filed ({rows.length})</Text></View>
      <View style={s.row} fixed>
        <Text style={[s.th, { width: "11%" }]}>Date</Text>
        <Text style={[s.th, { width: "16%" }]}>Serial</Text>
        <Text style={[s.th, { width: "20%" }]}>Service</Text>
        <Text style={[s.th, { width: "13%" }]}>Weighbridge</Text>
        <Text style={[s.th, { width: "17%" }]}>Client / branch</Text>
        <Text style={[s.th, { width: "13%" }]}>Filed by</Text>
        <Text style={[s.th, { width: "5%", textAlign: "center" }]}>Fnd</Text>
        <Text style={[s.th, { width: "5%", textAlign: "center" }]}>Ph</Text>
      </View>
      {rows.map((r, i) => {
        const st = REG_STATUS[r.status] || { label: r.status, color: MUTE };
        return (
          <View style={s.row} key={i} wrap={false}>
            <Text style={[s.td, { width: "11%", fontSize: 7 }]}>{fmtDate(r.createdAt)}</Text>
            <Text style={[s.td, { width: "16%", fontFamily: "Courier", fontSize: 6.2 }]}>{r.serial}{"\n"}<Text style={{ color: st.color, fontFamily: "Helvetica-Bold", fontSize: 6 }}>{st.label.toUpperCase()}</Text></Text>
            <Text style={[s.td, { width: "20%" }]}>{r.templateName}</Text>
            <Text style={[s.td, { width: "13%", fontFamily: "Courier", fontSize: 7 }]}>{r.weighbridgeId || "—"}</Text>
            <Text style={[s.td, { width: "17%" }]}>{r.clientName || "—"}{r.site ? <Text style={{ color: MUTE, fontSize: 6.5 }}>{"\n"}{r.site}</Text> : null}</Text>
            <Text style={[s.td, { width: "13%" }]}>{r.authorName}</Text>
            <Text style={[s.td, { width: "5%", textAlign: "center", color: r.findings ? FAIL : MUTE, fontFamily: r.findings ? "Helvetica-Bold" : "Helvetica" }]}>{r.findings || "—"}</Text>
            <Text style={[s.td, { width: "5%", textAlign: "center" }]}>{r.photos || "—"}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Compact submissions sparkline drawn as vertical bars.
function TrendBars({ points }) {
  if (!points || !points.length) return <Text style={s.empty}>No submissions in this period.</Text>;
  const max = Math.max(...points.map((p) => p.count)) || 1;
  const first = points[0]?.date;
  const last = points[points.length - 1]?.date;
  const total = points.reduce((a, p) => a + p.count, 0);
  return (
    <View>
      <View style={s.trendWrap}>
        {points.map((p, i) => (
          <View key={i} style={[s.trendBar, { height: `${Math.max(2, (p.count / max) * 100)}%` }]} />
        ))}
      </View>
      <View style={s.trendAxis}>
        <Text style={s.trendTick}>{fmtDate(first)}</Text>
        <Text style={s.trendTick}>{total} submissions · peak {max}/period</Text>
        <Text style={s.trendTick}>{fmtDate(last)}</Text>
      </View>
    </View>
  );
}

export function ManagementReportDocument({ data, logoSrc, generatedByName, generatedByRole }) {
  const d = data || {};
  const rangeLabel =
    d.range && (d.range.from || d.range.to)
      ? `${fmtDate(d.range.from) || "start"} — ${fmtDate(d.range.to) || "today"}`
      : "All time";

  const wbBars = (d.byWeighbridge || []).slice(0, 10).map((r, i) => ({ label: r.id, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const tplBars = (d.byTemplate || []).slice(0, 10).map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const clientBars = (d.byClient || []).slice(0, 10).map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const authorBars = (d.byAuthor || []).slice(0, 10).map((r, i) => ({ label: r.name, value: r.count, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const findingBars = (d.topFindings || []).slice(0, 8).map((r) => ({ label: r.item, value: r.count }));

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
        <Text style={s.sub}>Period: {rangeLabel} · {d.total || 0} report{d.total === 1 ? "" : "s"} in scope{d.clientLabel ? ` · ${d.clientLabel}${d.siteLabel ? ` — ${d.siteLabel} branch` : " (all branches)"}` : ""}</Text>

        {d.compareRange ? (
          <Text style={[s.sub, { marginTop: 1 }]}>Compared to previous period ({fmtDate(d.compareRange.from)} — {fmtDate(d.compareRange.to)})</Text>
        ) : null}

        {/* Summary KPIs */}
        <View style={s.kpiRow}>
          <Kpi num={d.total || 0} label="Total reports" delta={d.deltas?.total} />
          <Kpi num={d.pending || 0} label="Pending" color={WAIT} />
          <Kpi num={d.approved || 0} label="Approved" sub={`${d.approvalRate || 0}% of total`} color={PASS} />
          <Kpi num={d.rejected || 0} label="Rejected" sub={`${d.rejectionRate || 0}% of total`} color={FAIL} delta={d.deltas?.rejectionRate} />
          <Kpi num={d.findingsCount || 0} label="Findings" sub={`${d.findingsRate || 0} / report`} color={FAIL} delta={d.deltas?.findingsCount} />
          <Kpi num={d.avgTurnaroundHours != null ? `${d.avgTurnaroundHours}h` : "—"} label="Avg approval" sub="submit → approved" delta={d.deltas?.avgTurnaroundHours} />
        </View>

        {/* Auto insights */}
        {d.insights && d.insights.length ? (
          <View style={s.insRow}>
            {d.insights.map((it, i) => (
              <View key={i} style={[s.insCell, { borderLeftColor: it.kind === "good" ? PASS : it.kind === "bad" ? FAIL : GOLD, marginRight: i === d.insights.length - 1 ? 0 : 7 }]}>
                <Text style={s.insTitle}>{it.title}</Text>
                <Text style={s.insBody}>{it.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Key rates */}
        <View style={s.rateRow}>
          <View style={[s.rateCell, { borderLeftColor: PASS }]}>
            <Text style={[s.rateNum, { color: PASS }]}>{d.approvalRate || 0}%</Text>
            <Text style={s.rateLabel}>Approval rate</Text>
          </View>
          <View style={[s.rateCell, { borderLeftColor: FAIL }]}>
            <Text style={[s.rateNum, { color: FAIL }]}>{d.rejectionRate || 0}%</Text>
            <Text style={s.rateLabel}>Rejection rate</Text>
          </View>
          <View style={[s.rateCell, { borderLeftColor: WAIT }]}>
            <Text style={[s.rateNum, { color: WAIT }]}>{d.findingsRate || 0}</Text>
            <Text style={s.rateLabel}>Findings per report</Text>
          </View>
          <View style={[s.rateCell, { borderLeftColor: COAL, marginRight: 0 }]}>
            <Text style={[s.rateNum, { color: COAL }]}>{d.avgTurnaroundHours != null ? `${d.avgTurnaroundHours}h` : "—"}</Text>
            <Text style={s.rateLabel}>Avg time to approve</Text>
          </View>
        </View>

        {/* Equipment health */}
        {d.passRate != null ? (
          <>
            <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Equipment health</Text></View>
            <View style={s.healthRow}>
              <Text style={[s.healthNum, { color: d.passRate >= 90 ? PASS : d.passRate >= 75 ? "#5C8A2E" : d.passRate >= 50 ? WAIT : FAIL }]}>{d.passRate}%</Text>
              <View style={s.healthBarTrack}>
                <View style={[s.healthBarFill, { width: `${d.passRate}%`, backgroundColor: d.passRate >= 90 ? PASS : d.passRate >= 75 ? "#5C8A2E" : d.passRate >= 50 ? WAIT : FAIL }]} />
              </View>
              <Text style={s.healthNote}>{d.checklistPassed} of {d.checklistTotal} checklist items passed · {d.findingsCount} flagged</Text>
            </View>
          </>
        ) : null}

        {/* Submissions trend */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Submissions over time</Text></View>
        <TrendBars points={d.trend} />

        {/* Status breakdown */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Status distribution</Text></View>
        <BarChart
          items={["APPROVED", "PENDING_MANAGER", "PENDING_SUPERVISOR", "REJECTED"]
            .map((k) => ({ label: STATUS_LABEL[k], value: (d.byStatus && d.byStatus[k]) || 0, color: STATUS_COLOR[k] }))
            .filter((r) => r.value > 0)}
        />

        {/* By weighbridge */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By weighbridge</Text><Text style={s.sectionNote}>top {wbBars.length}</Text></View>
        <BarChart items={wbBars} />

        {/* By report type */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By report type</Text></View>
        <BarChart items={tplBars} />

        {/* By client / site */}
        <View style={s.sectionBar} wrap={false}><View style={s.swatch} /><Text style={s.sectionTitle}>By client &amp; site</Text><Text style={s.sectionNote}>top {clientBars.length}</Text></View>
        <BarChart items={clientBars} />

        {/* By author */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>By person (filed)</Text><Text style={s.sectionNote}>top {authorBars.length}</Text></View>
        <BarChart items={authorBars} />

        {/* Most common findings */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Most common findings</Text></View>
        {findingBars.length ? <BarChart items={findingBars} color={FAIL} /> : <Text style={s.empty}>No items needed attention in this period.</Text>}

        {/* Platform activity — everything the app captured */}
        {d.usage ? <UsageBlock usage={d.usage} /> : null}

        {/* Service register — the itemised log of every report filed */}
        {d.register && d.register.length ? <RegisterBlock rows={d.register} /> : null}

        {/* Across the business — the wider operational picture */}
        {d.operations ? <OperationsBlock ops={d.operations} /> : null}

        {/* Findings detail */}
        <View style={s.sectionBar} wrap={false}><View style={s.swatch} /><Text style={s.sectionTitle}>Flagged findings — needs attention ({d.findingsCount || 0})</Text></View>
        {(!d.findings || !d.findings.length) ? (
          <Text style={s.empty}>No items needed attention in this period.</Text>
        ) : (
          <View>
            <View style={s.row}>
              <Text style={[s.th, { width: "17%" }]}>Serial</Text>
              <Text style={[s.th, { width: "25%" }]}>Item</Text>
              <Text style={[s.th, { width: "9%" }]}>Result</Text>
              <Text style={[s.th, { width: "26%" }]}>Remark</Text>
              <Text style={[s.th, { width: "23%" }]}>Client / branch · WB · date</Text>
            </View>
            {d.findings.map((f, i) => (
              <View style={s.row} key={i} wrap={false}>
                <Text style={[s.td, { width: "17%", fontFamily: "Courier", fontSize: 6.2 }]}>{f.serial}</Text>
                <Text style={[s.td, { width: "25%" }]}>{f.item}</Text>
                <Text style={[s.td, { width: "9%", color: FAIL, fontFamily: "Helvetica-Bold" }]}>{f.result}</Text>
                <Text style={[s.td, { width: "26%" }]}>{f.remark || "—"}</Text>
                <Text style={[s.td, { width: "23%", fontSize: 7 }]}>{f.clientName || "—"}{f.site ? ` · ${f.site}` : ""}{"\n"}{f.weighbridgeId || "—"} · {fmtDate(f.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Management Report · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Appendix — the full, itemised detail of every report in scope: each
          field, checklist result, calibration reading and note as captured. */}
      {Array.isArray(d.register) && d.register.some((r) => r.details && r.details.length) ? (
        <Page size="A4" style={s.page} wrap>
          <View style={s.sectionBar} wrap={false}>
            <View style={s.swatch} />
            <Text style={s.sectionTitle}>Appendix — full report detail ({d.register.length})</Text>
          </View>
          <Text style={[s.sub, { marginBottom: 6 }]}>Every report in this period, expanded with all captured entries.</Text>
          {d.register.map((r, i) => (
            <View key={i} style={s.apxCard} wrap={false}>
              <View style={s.apxHead}>
                <Text style={s.apxSerial}>{r.serial}</Text>
                <Text style={s.apxMeta}>
                  {r.templateName} · {fmtDate(r.createdAt)} · {r.clientName}{r.site ? ` — ${r.site}` : ""}
                  {r.weighbridgeId ? ` · ${r.weighbridgeId}` : ""} · {r.authorName}
                  {r.status === "APPROVED" ? " · Approved" : r.status === "REJECTED" ? " · Returned" : " · Pending"}
                </Text>
              </View>
              <ReportDetailBlocks blocks={r.details} photoCount={r.photos} />
            </View>
          ))}
          <View style={s.footer} fixed>
            <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Management Report · Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
