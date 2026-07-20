import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import {
  SURVEY_SERVICE_LABEL,
  SURVEY_CRITERIA,
  SATISFACTION_SCALE,
  COMPLAINT_HANDLING_LABEL,
} from "@/lib/survey";

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";

const YN = { YES: "Yes", NO: "No", NOT_SURE: "Not sure" };

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 32, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COAL },
  brandGold: { color: GOLD },
  accred: { fontSize: 6.5, color: MUTE, marginTop: 2, fontFamily: "Courier" },
  contact: { fontSize: 6.5, color: MUTE, marginTop: 1 },
  metaRight: { alignItems: "flex-end" },
  sys: { fontSize: 6.5, color: MUTE, fontFamily: "Courier-Bold" },
  mono: { fontSize: 8, fontFamily: "Courier", marginTop: 1 },
  rule: { borderBottomWidth: 2, borderBottomColor: COAL, marginTop: 5, marginBottom: 6 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  lab: { fontSize: 8, color: MUTE, marginBottom: 4 },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 3 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "28%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "72%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7.5, padding: 3, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 8, padding: 3, borderWidth: 0.5, borderColor: "#D9D2C4" },
  para: { fontSize: 8.5, lineHeight: 1.3, marginBottom: 4 },
  paraLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTE, textTransform: "uppercase", marginTop: 4 },
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

export function SurveyDocument({ feedback, logoSrc }) {
  const f = feedback;
  const types = Array.isArray(f.serviceTypes) ? f.serviceTypes : [];
  const criteria = f.criteria || {};
  const scaleWord = (n) => (n >= 1 && n <= 5 ? `${n} — ${SATISFACTION_SCALE[n - 1]}` : "-");

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
            <Text style={s.sys}>QSL/QP/004/CSSF</Text>
            <Text style={s.mono}>SUBMITTED: {fmt(f.createdAt, true)} EAT</Text>
          </View>
        </View>
        <View style={s.rule} />

        <Text style={s.title}>Customer Satisfaction Survey</Text>
        <Text style={s.lab}>Laboratory: Qalibrated Systems Limited Calibration Laboratory · NAWI &amp; Mass Standards</Text>

        {/* §1 */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>1. Customer information</Text></View>
        {[
          ["Organization", f.clientName],
          ["Contact person", f.contactName],
          ["Email", f.contactEmail],
          ["Phone", f.contactPhone],
          ["Date", f.serviceDate ? fmt(f.serviceDate) : null],
          ["Service(s) used", types.map((t) => SURVEY_SERVICE_LABEL[t] || t).join(", ")],
        ].map(([k, v]) => (
          <View style={s.row} key={k}><Text style={s.key}>{k}</Text><Text style={s.val}>{v || "-"}</Text></View>
        ))}

        {/* §2 */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>2. Service evaluation (1 = Very Dissatisfied … 5 = Very Satisfied)</Text></View>
        <View style={s.row}>
          <Text style={[s.th, { width: "10%" }]}>No.</Text>
          <Text style={[s.th, { width: "70%" }]}>Evaluation criteria</Text>
          <Text style={[s.th, { width: "20%", textAlign: "center" }]}>Rating</Text>
        </View>
        {SURVEY_CRITERIA.map(([k, label]) => (
          <View style={s.row} key={k} wrap={false}>
            <Text style={[s.td, { width: "10%" }]}>{k}</Text>
            <Text style={[s.td, { width: "70%" }]}>{label}</Text>
            <Text style={[s.td, { width: "20%", textAlign: "center", fontFamily: "Helvetica-Bold", color: criteria[k] >= 4 ? PASS : criteria[k] <= 2 ? FAIL : INK }]}>
              {criteria[k] ? `${criteria[k]} / 5` : "-"}
            </Text>
          </View>
        ))}

        {/* §4 */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>4. Complaints and issues</Text></View>
        <View style={s.row}>
          <Text style={s.key}>Any problems / nonconformities?</Text>
          <Text style={s.val}>{f.hadProblem === true ? "Yes" : f.hadProblem === false ? "No" : "-"}</Text>
        </View>
        {f.problemDetail ? (<><Text style={s.paraLabel}>Description</Text><Text style={s.para}>{f.problemDetail}</Text></>) : null}
        <View style={s.row}>
          <Text style={s.key}>Complaint handled effectively?</Text>
          <Text style={s.val}>{f.complaintHandling ? COMPLAINT_HANDLING_LABEL[f.complaintHandling] || f.complaintHandling : "-"}</Text>
        </View>

        {/* §5 */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>5. Improvement and expectations</Text></View>
        <Text style={s.paraLabel}>What we did well</Text><Text style={s.para}>{f.didWell || "-"}</Text>
        <Text style={s.paraLabel}>Areas to improve</Text><Text style={s.para}>{f.improve || "-"}</Text>
        <Text style={s.paraLabel}>Additional services wanted</Text><Text style={s.para}>{f.additionalServices || "-"}</Text>

        {/* §6 */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>6. Overall assessment</Text></View>
        <View style={s.row}><Text style={s.key}>Overall satisfaction</Text><Text style={[s.val, { fontFamily: "Helvetica-Bold" }]}>{scaleWord(f.overall || f.rating)}</Text></View>
        <View style={s.row}><Text style={s.key}>Would use us again</Text><Text style={s.val}>{YN[f.useAgain] || "-"}</Text></View>
        <View style={s.row}><Text style={s.key}>Would recommend us</Text><Text style={s.val}>{YN[f.recommend] || "-"}</Text></View>
        {f.comments ? (<><Text style={s.paraLabel}>Other comments</Text><Text style={s.para}>{f.comments}</Text></>) : null}

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · Customer Satisfaction Survey · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
