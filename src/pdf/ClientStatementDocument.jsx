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
const LINE = "#E4DCCB";

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

const STATUS = {
  APPROVED: { label: "Approved", color: PASS },
  PENDING_SUPERVISOR: { label: "In review", color: WAIT },
  PENDING_MANAGER: { label: "Awaiting", color: WAIT },
  REJECTED: { label: "Returned", color: FAIL },
};

// A branded, client-facing monthly statement of the maintenance management
// services delivered — the document handed to a client at month-end.
export function ClientStatementDocument({ data, logoSrc, clientName, periodLabel, statementRef, generatedByName }) {
  const d = data || {};
  const u = d.usage || {};
  const c = d.compliance || {};
  const services = d.servicesDelivered || [];
  const wbs = d.weighbridgeHistory || [];
  const register = d.register || [];
  const findings = d.findings || [];
  const calibrations = register.filter((r) => r.template === "WB06" || (r.outcome && /certificate/i.test(r.outcome)));

  const totalServices = u.servicesDelivered ?? d.total ?? 0;

  // Per-site rollup from the itemised log.
  const siteMap = new Map();
  for (const r of register) {
    const key = r.site || "(no site)";
    const e = siteMap.get(key) || { site: key, count: 0, findings: 0 };
    e.count += 1;
    e.findings += r.findings || 0;
    siteMap.set(key, e);
  }
  const bySite = [...siteMap.values()].sort((a, b) => b.count - a.count);

  const Header = () => (
    <View style={s.topRow} fixed>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {logoSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logoSrc} style={{ width: 30, height: 30, marginRight: 8 }} />
        ) : null}
        <View>
          <Text style={s.brand}>QALIBRATED <Text style={{ color: GOLD }}>SYSTEMS</Text></Text>
          <Text style={s.accred}>{COMPANY.accreditation}</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.mono}>{statementRef}</Text>
        <Text style={s.mono}>{COMPANY.website}</Text>
      </View>
    </View>
  );

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Monthly Service Statement · ${statementRef} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  const Section = ({ title, note }) => (
    <View style={s.sectionBar} wrap={false}>
      <View style={s.swatch} />
      <Text style={s.sectionTitle}>{title}</Text>
      {note ? <Text style={s.sectionNote}>{note}</Text> : null}
    </View>
  );

  return (
    <Document>
      {/* ---------------- Cover ---------------- */}
      <Page size="A4" style={s.page} wrap>
        <Header />
        <View style={s.rule} />

        <View style={s.coverBand}>
          <Text style={s.coverKicker}>Monthly Service Statement</Text>
          <Text style={s.coverClient}>{clientName || "All clients"}</Text>
          <Text style={s.coverPeriod}>{periodLabel}</Text>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}><Text style={s.metaLab}>Statement ref</Text><Text style={s.metaVal}>{statementRef}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLab}>Issued</Text><Text style={s.metaVal}>{fmtDate(d.generatedAt)}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLab}>Prepared by</Text><Text style={s.metaVal}>{generatedByName || "—"}</Text></View>
        </View>

        <Text style={s.intro}>
          This statement summarises the weighbridge maintenance-management services that {COMPANY.name} delivered
          {clientName ? ` for ${clientName}` : ""} during {periodLabel}. Every visit, inspection, calibration and
          approval below was captured live through the QSL Maintenance Management System.
        </Text>

        {/* Headline metrics */}
        <View style={s.hero}>
          <Hero num={totalServices} label="Services delivered" />
          <Hero num={u.weighbridgesServiced ?? wbs.length} label="Weighbridges maintained" />
          <Hero num={u.sitesServiced ?? "—"} label="Sites covered" />
          <Hero num={c.checklistPassRate != null ? `${c.checklistPassRate}%` : "—"} label="Equipment health" color={PASS} />
        </View>
        <View style={s.hero}>
          <Hero num={u.checklistItems != null ? Number(u.checklistItems).toLocaleString() : "—"} label="Checks completed" small />
          <Hero num={u.photos != null ? Number(u.photos).toLocaleString() : "—"} label="Photos captured" small />
          <Hero num={c.scheduleAdherence != null ? `${c.scheduleAdherence}%` : "—"} label="Schedule adherence" small />
          <Hero num={c.avgTurnaroundHours != null ? `${c.avgTurnaroundHours}h` : "—"} label="Avg. approval time" small />
        </View>

        {/* Services delivered — the billing-style summary */}
        <Section title="Services delivered this period" note={`${services.length} service type${services.length === 1 ? "" : "s"}`} />
        {services.length ? (
          <View>
            <View style={[s.row, s.rowHead]}>
              <Text style={[s.th, { width: "8%" }]}>#</Text>
              <Text style={[s.th, { width: "62%" }]}>Service</Text>
              <Text style={[s.th, { width: "30%", textAlign: "right" }]}>Quantity delivered</Text>
            </View>
            {services.map((sv, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
                <Text style={[s.td, { width: "8%", color: MUTE }]}>{i + 1}</Text>
                <Text style={[s.td, { width: "62%", fontFamily: "Helvetica-Bold" }]}>{sv.name}</Text>
                <Text style={[s.td, { width: "30%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{sv.count}</Text>
              </View>
            ))}
            <View style={[s.row, { backgroundColor: COAL }]} wrap={false}>
              <Text style={[s.td, { width: "70%", color: "#fff", fontFamily: "Helvetica-Bold" }]}>Total services delivered</Text>
              <Text style={[s.td, { width: "30%", textAlign: "right", color: GOLD, fontFamily: "Helvetica-Bold" }]}>{totalServices}</Text>
            </View>
          </View>
        ) : (
          <Text style={s.empty}>No services were recorded for this period.</Text>
        )}

        <Text style={s.note}>
          Quantities above reflect completed, system-recorded service visits and records for the period and support the
          monthly service invoice. A full line-by-line log of every record appears later in this statement.
        </Text>

        <Footer />
      </Page>

      {/* ---------------- Performance + equipment ---------------- */}
      <Page size="A4" style={s.page} wrap>
        <Header />

        <Section title="Service level & compliance" />
        <View style={s.rateRow}>
          <Rate num={c.checklistPassRate != null ? `${c.checklistPassRate}%` : "—"} label="Checklist pass rate" color={PASS} />
          <Rate num={c.scheduleAdherence != null ? `${c.scheduleAdherence}%` : "—"} label="Schedule adherence" color={PASS} />
          <Rate num={`${c.approvalRate ?? 0}%`} label="Reports approved" color={INK} />
          <Rate num={c.avgTurnaroundHours != null ? `${c.avgTurnaroundHours}h` : "—"} label="Avg. sign-off time" color={COAL} last />
        </View>
        <Text style={s.note}>
          {c.checklistPassed ?? 0} of {c.checklistItems ?? 0} equipment checks passed. {c.reportsApproved ?? 0} report
          {(c.reportsApproved ?? 0) === 1 ? "" : "s"} approved, {c.reportsPending ?? 0} in progress
          {(c.findingsOpen ?? 0) > 0 ? `, and ${c.findingsOpen} finding${c.findingsOpen === 1 ? "" : "s"} raised for attention` : ""}.
        </Text>

        {bySite.length > 1 || (bySite.length === 1 && bySite[0].site !== "(no site)") ? (
          <>
            <Section title="Services by site" note={`${bySite.length} site${bySite.length === 1 ? "" : "s"}`} />
            <View>
              <View style={[s.row, s.rowHead]}>
                <Text style={[s.th, { width: "58%" }]}>Site</Text>
                <Text style={[s.th, { width: "21%", textAlign: "center" }]}>Services</Text>
                <Text style={[s.th, { width: "21%", textAlign: "center" }]}>Findings</Text>
              </View>
              {bySite.map((r, i) => (
                <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
                  <Text style={[s.td, { width: "58%", fontFamily: "Helvetica-Bold" }]}>{r.site}</Text>
                  <Text style={[s.td, { width: "21%", textAlign: "center", fontFamily: "Helvetica-Bold" }]}>{r.count}</Text>
                  <Text style={[s.td, { width: "21%", textAlign: "center", color: r.findings ? FAIL : MUTE }]}>{r.findings || "—"}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Section title="Equipment maintained" note={`${wbs.length} weighbridge${wbs.length === 1 ? "" : "s"}`} />
        {wbs.length ? (
          <View>
            <View style={[s.row, s.rowHead]}>
              <Text style={[s.th, { width: "20%" }]}>Weighbridge</Text>
              <Text style={[s.th, { width: "24%" }]}>Site</Text>
              <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Services</Text>
              <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Findings</Text>
              <Text style={[s.th, { width: "16%" }]}>Last service</Text>
              <Text style={[s.th, { width: "16%" }]}>Top service</Text>
            </View>
            {wbs.map((w, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
                <Text style={[s.td, { width: "20%", fontFamily: "Courier", fontSize: 8 }]}>{w.id}</Text>
                <Text style={[s.td, { width: "24%" }]}>{w.site || w.clientName}</Text>
                <Text style={[s.td, { width: "12%", textAlign: "center", fontFamily: "Helvetica-Bold" }]}>{w.reports}</Text>
                <Text style={[s.td, { width: "12%", textAlign: "center", color: w.findings ? FAIL : MUTE }]}>{w.findings || "—"}</Text>
                <Text style={[s.td, { width: "16%", fontSize: 8 }]}>{fmtDate(w.lastDate)}</Text>
                <Text style={[s.td, { width: "16%", fontSize: 8 }]}>{w.services?.[0]?.name || "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.empty}>No equipment records for this period.</Text>
        )}

        {/* Findings & actions */}
        <Section title="Findings & corrective actions" note={`${findings.length} item${findings.length === 1 ? "" : "s"}`} />
        {findings.length ? (
          <View>
            <View style={[s.row, s.rowHead]}>
              <Text style={[s.th, { width: "16%" }]}>Serial</Text>
              <Text style={[s.th, { width: "30%" }]}>Item</Text>
              <Text style={[s.th, { width: "16%" }]}>Weighbridge</Text>
              <Text style={[s.th, { width: "38%" }]}>Action / remark</Text>
            </View>
            {findings.slice(0, 30).map((f, i) => (
              <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
                <Text style={[s.td, { width: "16%", fontFamily: "Courier", fontSize: 7 }]}>{f.serial}</Text>
                <Text style={[s.td, { width: "30%" }]}>{f.item}</Text>
                <Text style={[s.td, { width: "16%", fontFamily: "Courier", fontSize: 7 }]}>{f.weighbridgeId || "—"}</Text>
                <Text style={[s.td, { width: "38%" }]}>{f.remark || "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.cleanNote}>No items required attention this period — all equipment checks passed. ✓</Text>
        )}

        {/* Calibration certificates */}
        {calibrations.length ? (
          <>
            <Section title="Calibration & verification records issued" note={`${calibrations.length}`} />
            <View>
              <View style={[s.row, s.rowHead]}>
                <Text style={[s.th, { width: "20%" }]}>Serial</Text>
                <Text style={[s.th, { width: "16%" }]}>Date</Text>
                <Text style={[s.th, { width: "20%" }]}>Weighbridge</Text>
                <Text style={[s.th, { width: "44%" }]}>Outcome</Text>
              </View>
              {calibrations.map((r, i) => (
                <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
                  <Text style={[s.td, { width: "20%", fontFamily: "Courier", fontSize: 7 }]}>{r.serial}</Text>
                  <Text style={[s.td, { width: "16%", fontSize: 8 }]}>{fmtDate(r.createdAt)}</Text>
                  <Text style={[s.td, { width: "20%", fontFamily: "Courier", fontSize: 7 }]}>{r.weighbridgeId || "—"}</Text>
                  <Text style={[s.td, { width: "44%" }]}>{r.outcome || "Calibration & verification record"}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Footer />
      </Page>

      {/* ---------------- Complete service log ---------------- */}
      <Page size="A4" style={s.page} wrap>
        <Header />
        <Section title={`Complete service log (${register.length})`} note="every record this period" />
        <View style={[s.row, s.rowHead]} fixed>
          <Text style={[s.th, { width: "12%" }]}>Date</Text>
          <Text style={[s.th, { width: "17%" }]}>Serial</Text>
          <Text style={[s.th, { width: "23%" }]}>Service</Text>
          <Text style={[s.th, { width: "14%" }]}>Weighbridge</Text>
          <Text style={[s.th, { width: "18%" }]}>Filed by</Text>
          <Text style={[s.th, { width: "16%" }]}>Status</Text>
        </View>
        {register.map((r, i) => {
          const st = STATUS[r.status] || { label: r.status, color: MUTE };
          return (
            <View style={[s.row, { backgroundColor: i % 2 ? "#FBF8F1" : "#fff" }]} key={i} wrap={false}>
              <Text style={[s.td, { width: "12%", fontSize: 7 }]}>{fmtDate(r.createdAt)}</Text>
              <Text style={[s.td, { width: "17%", fontFamily: "Courier", fontSize: 7 }]}>{r.serial}</Text>
              <Text style={[s.td, { width: "23%" }]}>{r.templateName}</Text>
              <Text style={[s.td, { width: "14%", fontFamily: "Courier", fontSize: 7 }]}>{r.weighbridgeId || "—"}</Text>
              <Text style={[s.td, { width: "18%" }]}>{r.authorName}</Text>
              <Text style={[s.td, { width: "16%", color: st.color, fontFamily: "Helvetica-Bold", fontSize: 7.5 }]}>{st.label.toUpperCase()}</Text>
            </View>
          );
        })}

        {/* Close */}
        <View style={s.close} wrap={false}>
          <Text style={s.closeText}>
            {COMPANY.name} confirms the services above were delivered and recorded through the QSL Maintenance
            Management System for {periodLabel}. We appreciate your continued partnership. For any query on this
            statement, contact us at {COMPANY.email} or {COMPANY.phone}.
          </Text>
          <View style={s.sign}>
            <View style={s.signCell}><Text style={s.signLine}>{generatedByName || ""}</Text><Text style={s.signLab}>Prepared by · {COMPANY.name}</Text></View>
            <View style={s.signCell}><Text style={s.signLine} /><Text style={s.signLab}>Received / acknowledged · {clientName || "Client"}</Text></View>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

function Hero({ num, label, color, small }) {
  return (
    <View style={s.heroCell}>
      <Text style={[s.heroNum, color ? { color } : {}, small ? { fontSize: 18 } : {}]}>{num}</Text>
      <Text style={s.heroLab}>{label}</Text>
    </View>
  );
}
function Rate({ num, label, color, last }) {
  return (
    <View style={[s.rateCell, { borderLeftColor: color || GOLD, marginRight: last ? 0 : 6 }]}>
      <Text style={[s.rateNum, { color: color || INK }]}>{num}</Text>
      <Text style={s.rateLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 42, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: INK },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL, letterSpacing: 0.5 },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 1 },
  mono: { fontSize: 7, color: MUTE, fontFamily: "Courier", textAlign: "right" },
  rule: { height: 2, backgroundColor: COAL, marginTop: 6, marginBottom: 0 },

  coverBand: { backgroundColor: COAL, borderRadius: 4, paddingVertical: 22, paddingHorizontal: 22, marginTop: 18 },
  coverKicker: { fontSize: 10, color: "#cdbd98", textTransform: "uppercase", letterSpacing: 2, fontFamily: "Helvetica-Bold" },
  coverClient: { fontSize: 26, color: "#fff", fontFamily: "Helvetica-Bold", marginTop: 8 },
  coverPeriod: { fontSize: 12, color: GOLD, marginTop: 4, fontFamily: "Helvetica-Bold" },

  metaGrid: { flexDirection: "row", marginTop: 12 },
  metaCell: { flex: 1, borderLeftWidth: 2, borderLeftColor: GOLD, paddingLeft: 8, marginRight: 10 },
  metaLab: { fontSize: 7, color: MUTE, textTransform: "uppercase", letterSpacing: 0.4 },
  metaVal: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2 },

  intro: { fontSize: 9.5, lineHeight: 1.5, color: INK, marginTop: 16, marginBottom: 4 },

  hero: { flexDirection: "row", marginTop: 10 },
  heroCell: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 10, alignItems: "center", marginRight: 8 },
  heroNum: { fontSize: 24, fontFamily: "Helvetica-Bold", color: INK },
  heroLab: { fontSize: 6.8, color: MUTE, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3, textAlign: "center" },

  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 6 },
  swatch: { width: 9, height: 9, backgroundColor: GOLD, marginRight: 7, borderRadius: 2 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3 },
  sectionNote: { fontSize: 7.5, color: MUTE, marginLeft: 7 },

  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#EDE6D6" },
  rowHead: { backgroundColor: COAL, borderBottomWidth: 0 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.3, paddingVertical: 6, paddingHorizontal: 7 },
  td: { fontSize: 8.5, paddingVertical: 6, paddingHorizontal: 7 },

  note: { fontSize: 8, color: MUTE, marginTop: 8, lineHeight: 1.45 },
  cleanNote: { fontSize: 9.5, color: PASS, fontFamily: "Helvetica-Bold", marginTop: 6 },
  empty: { fontSize: 8.5, color: MUTE, fontStyle: "italic", marginTop: 4 },

  rateRow: { flexDirection: "row", marginTop: 4 },
  rateCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: 3, backgroundColor: "#FAF7F0" },
  rateNum: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  rateLabel: { fontSize: 6.8, color: MUTE, textTransform: "uppercase", marginTop: 2, letterSpacing: 0.3 },

  close: { marginTop: 22, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 12 },
  closeText: { fontSize: 9, lineHeight: 1.5, color: INK },
  sign: { flexDirection: "row", marginTop: 26 },
  signCell: { flex: 1, marginRight: 20 },
  signLine: { borderBottomWidth: 1, borderBottomColor: INK, minHeight: 16, fontSize: 9, fontFamily: "Helvetica-Bold" },
  signLab: { fontSize: 7, color: MUTE, marginTop: 3 },

  footer: { position: "absolute", bottom: 16, left: 34, right: 34, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
});
