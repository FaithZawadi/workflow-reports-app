import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";

// Renders the itemised blocks from itemizeReport() inside a PDF — every field,
// checklist result, calibration grid, load-cell reading and note. Shared by the
// management-report appendix and the client statement so a report expands the
// same way everywhere.

const INK = "#26221C";
const MUTE = "#6B6355";
const PASS = "#2E7D46";
const FAIL = "#B03A2E";
const LINE = "#D9D2C4";
const HEAD = "#F3EEE2";

const s = StyleSheet.create({
  blockTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: INK, marginTop: 6, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  kvRow: { flexDirection: "row", marginBottom: 1.5 },
  kvKey: { width: "42%", fontSize: 7.5, color: MUTE },
  kvVal: { width: "58%", fontSize: 7.5, color: INK, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 7.5, color: INK, lineHeight: 1.35, marginBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: LINE },
  th: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: INK, padding: 2.5, backgroundColor: HEAD },
  td: { fontSize: 7, color: INK, padding: 2.5 },
  chkItem: { width: "56%" },
  chkRes: { width: "16%", textAlign: "center" },
  chkRem: { width: "28%", color: FAIL },
  pill: { fontSize: 6, fontFamily: "Helvetica-Bold" },
});

function KeyVals({ entries }) {
  return (
    <View>
      {entries.map((e, i) => (
        <View style={s.kvRow} key={i}>
          <Text style={s.kvKey}>{e.label}</Text>
          <Text style={s.kvVal}>{e.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Checklist({ block }) {
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.th, s.chkItem]}>Item</Text>
        <Text style={[s.th, s.chkRes]}>Result</Text>
        <Text style={[s.th, s.chkRem]}>Remark</Text>
      </View>
      {block.items.filter((i) => i.answered || i.remark).map((i, ix) => (
        <View style={s.row} key={ix} wrap={false}>
          <Text style={[s.td, s.chkItem]}>{i.item}</Text>
          <Text style={[s.td, s.chkRes, { color: i.ok === false ? FAIL : i.ok ? PASS : MUTE, fontFamily: "Helvetica-Bold" }]}>{i.result || "—"}</Text>
          <Text style={[s.td, s.chkRem]}>{i.remark || ""}</Text>
        </View>
      ))}
    </View>
  );
}

function Grid({ block }) {
  const w = `${(100 / Math.max(1, block.cols.length)).toFixed(2)}%`;
  return (
    <View>
      <View style={s.row}>
        {block.cols.map((c, ci) => (
          <Text style={[s.th, { width: w, textAlign: block.numericCols?.[ci] ? "right" : "left" }]} key={ci}>{c}</Text>
        ))}
      </View>
      {block.rows.map((r, ri) => (
        <View style={s.row} key={ri} wrap={false}>
          {r.map((cell, ci) => (
            <Text style={[s.td, { width: w, textAlign: block.numericCols?.[ci] ? "right" : "left" }]} key={ci}>{cell}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function LoadCells({ block }) {
  const w = `${(100 / (block.cols.length + 1)).toFixed(2)}%`;
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.th, { width: w }]}> </Text>
        {block.cols.map((c, ci) => <Text style={[s.th, { width: w, textAlign: "right" }]} key={ci}>{c}</Text>)}
      </View>
      {block.rows.map((r, ri) => (
        <View style={s.row} key={ri} wrap={false}>
          <Text style={[s.td, { width: w, fontFamily: "Helvetica-Bold", backgroundColor: HEAD }]}>{r.label}</Text>
          {r.cells.map((cell, ci) => <Text style={[s.td, { width: w, textAlign: "right" }]} key={ci}>{cell || "—"}</Text>)}
        </View>
      ))}
    </View>
  );
}

function Weekly({ block }) {
  const verdict = block.pass === null ? "not completed" : block.pass ? "WITHIN LIMIT" : "OVER LIMIT — attention required";
  return (
    <View>
      <Text style={[s.note, { fontFamily: "Helvetica-Bold", color: block.pass === false ? FAIL : INK }]}>
        Verdict: {verdict}  ·  limit {block.limit || "—"} kg{block.worst != null ? `  ·  worst spread ${block.worst}` : ""}
      </Text>
      <View style={s.row}>
        <Text style={[s.th, { width: "25%" }]}>Run</Text>
        <Text style={[s.th, { width: "20%", textAlign: "right" }]}>End A</Text>
        <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Middle</Text>
        <Text style={[s.th, { width: "20%", textAlign: "right" }]}>End B</Text>
        <Text style={[s.th, { width: "15%", textAlign: "right" }]}>Spread</Text>
      </View>
      {block.rows.map((r, ri) => (
        <View style={s.row} key={ri} wrap={false}>
          <Text style={[s.td, { width: "25%" }]}>{r.run}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{r.a || "—"}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{r.m || "—"}</Text>
          <Text style={[s.td, { width: "20%", textAlign: "right" }]}>{r.b || "—"}</Text>
          <Text style={[s.td, { width: "15%", textAlign: "right" }]}>{r.diff || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

// Render one report's blocks. `photoCount` is shown as a trailing note.
export function ReportDetailBlocks({ blocks, photoCount }) {
  if (!blocks || !blocks.length) {
    return <Text style={s.note}>No structured entries were captured on this report.</Text>;
  }
  return (
    <View>
      {blocks.map((b, i) => (
        <View key={i} wrap={false}>
          <Text style={s.blockTitle}>{b.title}{b.kind === "checklist" && b.flagged ? `  ·  ${b.flagged} flagged` : ""}</Text>
          {b.kind === "fields" ? <KeyVals entries={b.entries} /> : null}
          {b.kind === "note" ? <Text style={s.note}>{b.value}</Text> : null}
          {b.kind === "choice" ? <Text style={[s.note, { fontFamily: "Helvetica-Bold" }]}>{b.value}</Text> : null}
          {b.kind === "checklist" ? <Checklist block={b} /> : null}
          {b.kind === "grid" ? <Grid block={b} /> : null}
          {b.kind === "loadcells" ? <LoadCells block={b} /> : null}
          {b.kind === "weekly" ? <Weekly block={b} /> : null}
        </View>
      ))}
      {photoCount ? <Text style={[s.note, { color: MUTE, marginTop: 3 }]}>{photoCount} photo{photoCount === 1 ? "" : "s"} attached to this report.</Text> : null}
    </View>
  );
}
