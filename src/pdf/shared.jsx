import React from "react";
import { Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { R, TopBar, RefinedHeader, RefinedFooter, TitlePill, SectionHead } from "./refined";

// Shared palette kept for backward compatibility (many documents import PDF.*).
export const PDF = {
  GOLD: R.GOLD,
  GOLD_DK: R.GOLD_DK,
  COAL: R.COAL,
  INK: R.INK,
  MUTE: R.MUTE,
  PASS: R.PASS,
  FAIL: R.FAIL,
  LINE: R.LINE,
  CREAM: R.CREAM,
};

const h = StyleSheet.create({
  // Legacy section-head styling upgraded to the refined look (gold square + gold
  // underline + muted uppercase label), so every document that still uses the
  // shared header reads as one family.
  sectionBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: R.GOLD_DK, paddingBottom: 3, marginTop: 10, marginBottom: 6 },
  swatch: { width: 6, height: 6, backgroundColor: R.GOLD, marginRight: 6 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: R.MUTE, letterSpacing: 1, textTransform: "uppercase" },
});
export const sectionStyles = h;

// The shared letterhead now delegates to the refined design: a thin accent top
// bar (per document `kind`/`accent`) plus the boxed-logo header with right-hand
// meta rows. The old API (logoSrc, meta, sys, contactLines, compact, fixed) is
// preserved; `sys`/`compact` are accepted but no longer rendered.
//   kind: "report" | "quotation" | "invoice" | "statement" | "management" |
//         "calibration" | "survey" | "training" | "audit" (sets the bar colour)
//   accent: an explicit bar colour that overrides `kind`.
export function PdfHeader({ logoSrc, meta = [], sys, contactLines, kind = "default", accent, compact = false, fixed = false }) {
  void sys; void compact;
  const header = <RefinedHeader logoSrc={logoSrc} meta={meta} contactLines={contactLines} />;
  return (
    <React.Fragment>
      <TopBar kind={kind} color={accent} />
      {fixed ? <View fixed>{header}</View> : header}
    </React.Fragment>
  );
}

// The shared footer now renders the refined ISO footer. New callers pass
// `serial` (+ optional `note`); a legacy string child is used as the serial.
export function PdfFooter({ serial, note, children }) {
  const s = serial || (typeof children === "string" ? children : "");
  return <RefinedFooter serial={s} note={note} />;
}

// Re-export so documents can pull the refined pieces straight from "./shared".
export { TopBar, RefinedHeader, RefinedFooter, TitlePill, SectionHead, R };
export { COMPANY };
