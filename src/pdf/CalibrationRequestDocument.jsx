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
  SUBMITTED: { label: "SUBMITTED", color: "#946B00" },
  ACCEPTED: { label: "ACCEPTED", color: PASS },
  REJECTED: { label: "NOT ACCEPTED", color: FAIL },
};

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
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  title: { fontSize: 12.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", flex: 1, marginRight: 10 },
  statusBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 2 },
  lab: { fontSize: 8, color: MUTE, marginBottom: 6 },
  sectionBar: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 3 },
  swatch: { width: 8, height: 8, backgroundColor: GOLD, marginRight: 4 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  row: { flexDirection: "row" },
  key: { backgroundColor: "#F5EEDD", fontFamily: "Helvetica-Bold", padding: 3, width: "22%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  val: { padding: 3, width: "78%", borderWidth: 0.5, borderColor: "#E4DCCB", fontSize: 8 },
  th: { backgroundColor: COAL, color: "#fff", fontSize: 7, padding: 3, fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderColor: "#2c2720" },
  td: { fontSize: 7.5, padding: 3, borderWidth: 0.5, borderColor: "#D9D2C4" },
  note: { marginTop: 8, padding: 6, borderWidth: 1, borderColor: GOLD, backgroundColor: "#FCF7EA" },
  noteText: { fontSize: 8, color: INK, fontFamily: "Helvetica-Bold" },
  noteSub: { fontSize: 7.5, color: MUTE, marginTop: 2 },
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

const EQUIP_COLS = [
  { k: "name", label: "Equipment name", w: "18%" },
  { k: "makeModel", label: "Manufacturer / Model", w: "17%" },
  { k: "serialNo", label: "Serial No.", w: "13%" },
  { k: "capacity", label: "Capacity", w: "11%" },
  { k: "division", label: "Division (d)", w: "10%" },
  { k: "location", label: "Location", w: "13%" },
  { k: "remarks", label: "Remarks", w: "18%" },
];

const CHECK_ROWS = [
  ["withinScope", "Instrument(s) within laboratory scope"],
  ["standardsAvailable", "Required standards available"],
  ["uncertaintyAchievable", "Measurement uncertainty achievable"],
  ["personnelAvailable", "Qualified personnel available"],
  ["impartialityRisk", "Risk to impartiality check on available personnel"],
  ["methodAvailable", "Calibration method available"],
];

export function CalibrationRequestDocument({ request, logoSrc }) {
  const st = STATUS[request.status] || { label: request.status, color: INK };
  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  const checklist = request.reviewChecklist || {};

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
            <Text style={s.sys}>QSL/QP/013/CRF-NAWI</Text>
            <Text style={s.mono}>REQUEST NO: {request.serial}</Text>
            <Text style={s.mono}>RAISED: {fmt(request.createdAt, true)} EAT</Text>
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.titleRow}>
          <Text style={s.title}>Calibration Request Form — Non-Automatic Weighing Instrument</Text>
          <Text style={[s.statusBadge, { backgroundColor: st.color }]}>{st.label}</Text>
        </View>
        <Text style={s.lab}>Laboratory: Qalibrated Systems Limited Calibration Laboratory</Text>

        {/* 1. Client information */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>1. Client information</Text></View>
        {[
          ["Client name", request.clientName],
          ["Contact person", request.contactPerson],
          ["Address", request.address],
          ["Telephone", request.telephone],
          ["Email", request.email],
        ].map(([k, v]) => (
          <View style={s.row} key={k}><Text style={s.key}>{k}</Text><Text style={s.val}>{v || "-"}</Text></View>
        ))}

        {/* 2. Equipment / instrument details */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>2. Equipment / instrument details</Text></View>
        <View style={s.row}>
          <Text style={[s.th, { width: "5%" }]}>No.</Text>
          {EQUIP_COLS.map((c) => (
            <Text key={c.k} style={[s.th, { width: c.w }]}>{c.label}</Text>
          ))}
        </View>
        {equipment.map((r, i) => (
          <View style={s.row} key={i} wrap={false}>
            <Text style={[s.td, { width: "5%", textAlign: "center" }]}>{i + 1}</Text>
            {EQUIP_COLS.map((c) => (
              <Text key={c.k} style={[s.td, { width: c.w }]}>{r?.[c.k] || ""}</Text>
            ))}
          </View>
        ))}

        {/* 3. Calibration details */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>3. Calibration details</Text></View>
        <View style={s.row}>
          <Text style={s.key}>Type of calibration</Text>
          <Text style={s.val}>
            {request.calibrationType === "IN_SITU" ? "In situ (on site)" : request.calibrationType === "LAB" ? "Lab calibration" : "-"}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.key}>Preferred date</Text>
          <Text style={s.val}>{fmt(request.preferredDate)}</Text>
        </View>

        {/* 4. Additional requests */}
        {request.additionalRequests ? (
          <>
            <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>4. Additional requests</Text></View>
            <Text style={{ fontSize: 8.5, lineHeight: 1.3 }}>{request.additionalRequests}</Text>
          </>
        ) : null}

        {/* 5. Customer declaration */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>5. Customer declaration</Text></View>
        <Text style={{ fontSize: 8, marginBottom: 3 }}>
          I confirm that the information provided above is correct and authorize calibration of the listed items.
        </Text>
        {[
          ["Name", request.declarationName],
          ["Designation", request.declarationDesignation],
          ["Date", fmt(request.declarationDate)],
        ].map(([k, v]) => (
          <View style={s.row} key={k}><Text style={s.key}>{k}</Text><Text style={s.val}>{v || "-"}</Text></View>
        ))}

        {/* 6. Review checklist (laboratory use) */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>6. Calibration request review checklist (for laboratory use)</Text></View>
        <View style={s.row}>
          <Text style={[s.th, { width: "52%" }]}>Review item</Text>
          <Text style={[s.th, { width: "13%", textAlign: "center" }]}>Yes / No</Text>
          <Text style={[s.th, { width: "35%" }]}>Remarks</Text>
        </View>
        {CHECK_ROWS.map(([k, label]) => {
          const c = checklist[k] || {};
          return (
            <View style={s.row} key={k} wrap={false}>
              <Text style={[s.td, { width: "52%" }]}>{label}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "center" }]}>{c.yn || ""}</Text>
              <Text style={[s.td, { width: "35%" }]}>{c.remark || ""}</Text>
            </View>
          );
        })}

        {/* Decision + authorization */}
        <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Decision &amp; authorization</Text></View>
        <View style={s.row}>
          <Text style={s.key}>Decision</Text>
          <Text style={[s.val, { fontFamily: "Helvetica-Bold", color: st.color }]}>{st.label}</Text>
        </View>
        {request.decisionReason ? (
          <View style={s.row}><Text style={s.key}>Reason</Text><Text style={s.val}>{request.decisionReason}</Text></View>
        ) : null}
        <View style={s.row}><Text style={s.key}>Reviewed by</Text><Text style={s.val}>{request.reviewedByName || "-"}</Text></View>
        <View style={s.row}><Text style={s.key}>Approved by</Text><Text style={s.val}>{request.approvedByName || "-"}</Text></View>
        <View style={s.row}><Text style={s.key}>Reviewed on</Text><Text style={s.val}>{fmt(request.reviewedAt, true)}{request.reviewedAt ? " EAT" : ""}</Text></View>

        <View style={s.note} wrap={false}>
          <Text style={s.noteText}>System-generated document — no physical signature required.</Text>
          <Text style={s.noteSub}>Raised by the client and reviewed electronically by the QSL laboratory; the decision is recorded above.</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${COMPANY.name} · ${request.serial} · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
