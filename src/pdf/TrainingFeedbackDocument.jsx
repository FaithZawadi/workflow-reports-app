import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { TRAINING_CRITERIA, TRAINING_SCALE, RECOMMEND_LABEL, TRAINING_MODE_LABEL } from "@/lib/training";

const GOLD = "#F5A800";
const COAL = "#161310";
const INK = "#26221C";
const MUTE = "#6B6355";

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
  paraLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTE, textTransform: "uppercase", marginTop: 5 },
  para: { fontSize: 8.5, lineHeight: 1.3, marginTop: 1 },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: MUTE, fontFamily: "Courier", textAlign: "center" },
  qrBlock: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#E4DCCB" },
  qrImg: { width: 68, height: 68, marginRight: 10 },
  qrText: { flex: 1 },
  qrTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.4 },
  qrSub: { fontSize: 7.5, color: MUTE, marginTop: 2, lineHeight: 1.3, maxWidth: 260 },
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

// One feedback sheet (a Page), reused for a single download and the "all" book.
export function TrainingFeedbackSheet({ feedback, logoSrc, qrSrc }) {
  const f = feedback;
  const criteria = f.criteria || {};
  const scaleWord = (n) => (n >= 1 && n <= 5 ? `${n} — ${TRAINING_SCALE[n - 1]}` : "-");

  return (
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
          <Text style={s.sys}>QSL/HR/TFB</Text>
          <Text style={s.mono}>RECORDED: {fmt(f.createdAt, true)} EAT</Text>
        </View>
      </View>
      <View style={s.rule} />

      <Text style={s.title}>Training Feedback Form</Text>
      <Text style={s.lab}>Training on the Qalibrated Systems Maintenance Management System (MMS)</Text>

      {/* Participant details */}
      <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Participant details</Text></View>
      {[
        ["Name", f.traineeName],
        ["Organization / Site", f.organization],
        ["Role / Designation", f.traineeRole],
        ["Date of training", f.trainingDate ? fmt(f.trainingDate) : null],
        ["Trainer", f.trainer],
        ["Mode", TRAINING_MODE_LABEL[f.mode]],
      ].map(([k, v]) => (
        <View style={s.row} key={k}><Text style={s.key}>{k}</Text><Text style={s.val}>{v || "-"}</Text></View>
      ))}

      {/* Evaluation */}
      <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Training content, delivery &amp; system understanding (1 = Poor … 5 = Excellent)</Text></View>
      <View style={s.row}>
        <Text style={[s.th, { width: "10%" }]}>No.</Text>
        <Text style={[s.th, { width: "62%" }]}>Criteria</Text>
        <Text style={[s.th, { width: "28%", textAlign: "center" }]}>Rating</Text>
      </View>
      {TRAINING_CRITERIA.map(([k, label], i) => (
        <View style={s.row} key={k}>
          <Text style={[s.td, { width: "10%" }]}>{i + 1}</Text>
          <Text style={[s.td, { width: "62%" }]}>{label}</Text>
          <Text style={[s.td, { width: "28%", textAlign: "center" }]}>{criteria[k] ? scaleWord(criteria[k]) : "-"}</Text>
        </View>
      ))}
      <View style={s.row}>
        <Text style={[s.td, { width: "72%", fontFamily: "Helvetica-Bold" }]}>Overall rating of the training</Text>
        <Text style={[s.td, { width: "28%", textAlign: "center", fontFamily: "Helvetica-Bold" }]}>{f.overall ? scaleWord(f.overall) : "-"}</Text>
      </View>

      <View style={s.row} wrap={false}>
        <Text style={[s.key, { width: "50%" }]}>Would you recommend this training to a colleague?</Text>
        <Text style={[s.val, { width: "50%" }]}>{RECOMMEND_LABEL[f.recommend] || "-"}</Text>
      </View>

      {/* Open feedback */}
      <View style={s.sectionBar}><View style={s.swatch} /><Text style={s.sectionTitle}>Open feedback</Text></View>
      <Text style={s.paraLabel}>Most useful part of this training</Text>
      <Text style={s.para}>{f.didWell || "-"}</Text>
      <Text style={s.paraLabel}>What could be improved</Text>
      <Text style={s.para}>{f.improve || "-"}</Text>
      <Text style={s.paraLabel}>Additional support / follow-up needed</Text>
      <Text style={s.para}>{f.additionalSupport || "-"}</Text>

      <Text style={{ fontSize: 7.5, color: MUTE, marginTop: 8 }}>
        Submitted: {fmt(f.createdAt, true)} EAT{f.recordedByName ? ` · recorded by ${f.recordedByName}` : ""} · Qalibrated Systems Limited
      </Text>

      {/* Scan-for-details QR — at the foot of the sheet, not the header */}
      {qrSrc ? (
        <View style={s.qrBlock} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrSrc} style={s.qrImg} />
          <View style={s.qrText}>
            <Text style={s.qrTitle}>Scan for details</Text>
            <Text style={s.qrSub}>Point your phone camera at this code for a summary of this training feedback.</Text>
          </View>
        </View>
      ) : null}

      <View style={s.footer} fixed>
        <Text style={s.footText}>{COMPANY.name} · Training Feedback · {COMPANY.website}</Text>
      </View>
    </Page>
  );
}

// Single-sheet document.
export function TrainingFeedbackDocument({ feedback, logoSrc, qrSrc }) {
  return (
    <Document>
      <TrainingFeedbackSheet feedback={feedback} logoSrc={logoSrc} qrSrc={qrSrc} />
    </Document>
  );
}

// A book of all sheets (one Page each) for a bulk download.
export function TrainingFeedbackBook({ list, logoSrc }) {
  return (
    <Document>
      {(list || []).map((f) => (
        <TrainingFeedbackSheet key={f.id} feedback={f} logoSrc={logoSrc} qrSrc={null} />
      ))}
    </Document>
  );
}
