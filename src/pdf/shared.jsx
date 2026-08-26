import React from "react";
import { Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

// One shared palette + letterhead for EVERY system PDF, so reports, quotations,
// requests, statements, surveys and logs all read as one family. Bright GOLD is
// kept only on dark fills (light-on-dark prints fine); gold text/lines on a
// light background use GOLD_DK so the page still reads in black & white.
export const PDF = {
  GOLD: "#F5A800",
  GOLD_DK: "#8A6A00",
  COAL: "#161310",
  INK: "#26221C",
  MUTE: "#6B6355",
  PASS: "#2E7D46",
  FAIL: "#B03A2E",
  LINE: "#E4DCCB",
  CREAM: "#F5EEDD",
};

const h = StyleSheet.create({
  wrap: {},
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  left: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 14 },
  logo: { width: 54, height: 54, marginRight: 12, objectFit: "contain" },
  logoSm: { width: 42, height: 42, marginRight: 10, objectFit: "contain" },
  text: { flex: 1, paddingTop: 2 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: PDF.COAL, letterSpacing: 0.3 },
  brandGold: { color: PDF.GOLD_DK },
  accred: { fontSize: 6.8, color: PDF.MUTE, marginTop: 3, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  contact: { fontSize: 7.2, color: PDF.INK, marginTop: 2, fontFamily: "Helvetica", lineHeight: 1.3 },
  right: { alignItems: "flex-end", minWidth: 176 },
  sys: { fontSize: 6.4, color: PDF.MUTE, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 3, textTransform: "uppercase" },
  metaLine: { flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end", marginTop: 2 },
  metaK: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: PDF.MUTE, letterSpacing: 0.4, marginRight: 5 },
  metaVMono: { fontSize: 8.5, fontFamily: "Courier-Bold", color: PDF.COAL },
  metaV: { fontSize: 8, fontFamily: "Helvetica-Bold", color: PDF.COAL },
  rule: { borderBottomWidth: 2, borderBottomColor: PDF.COAL, marginTop: 6, marginBottom: 6 },
  ruleThin: { borderBottomWidth: 1, borderBottomColor: PDF.COAL, marginTop: 5, marginBottom: 6 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, borderTopWidth: 2, borderTopColor: PDF.GOLD_DK, paddingTop: 4, alignItems: "center" },
  footText: { fontSize: 6.5, color: PDF.MUTE, fontFamily: "Helvetica", textAlign: "center" },
});

// Shared letterhead. Left: logo (or the wordmark when there's no logo) + the
// accreditation + contact lines. Right: an optional form-code line and a tidy
// stack of right-aligned LABEL / value rows (mono for serials/refs).
//   meta: [{ k, v, mono? }]
//   contactLines: overrides the default two lines; pass [] to hide them.
//   compact: slimmer running header (smaller logo, thin rule, no contact lines
//            unless supplied) for multi-page documents.
//   fixed: repeat the header on every page (multi-page documents).
export function PdfHeader({ logoSrc, meta = [], sys, contactLines, compact = false, fixed = false }) {
  const lines = contactLines || (compact ? [] : [
    `${COMPANY.address} · ${COMPANY.website}`,
    `${COMPANY.email} · ${COMPANY.phone}`,
  ]);
  return (
    <View style={h.wrap} fixed={fixed}>
      <View style={h.topRow}>
        <View style={h.left}>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoSrc} style={compact ? h.logoSm : h.logo} />
          ) : null}
          <View style={h.text}>
            {!logoSrc && (
              <Text style={h.brand}>QALIBRATED <Text style={h.brandGold}>SYSTEMS</Text></Text>
            )}
            <Text style={h.accred}>KENAS · ISO/IEC 17025:2017 · ISO 9001:2015 · ILAC-MRA</Text>
            {lines.map((ln, i) => (
              <Text key={i} style={h.contact}>{ln}</Text>
            ))}
          </View>
        </View>
        <View style={h.right}>
          {sys ? <Text style={h.sys}>{sys}</Text> : null}
          {meta.map((m, i) => (
            <View key={i} style={h.metaLine}>
              {m.k ? <Text style={h.metaK}>{m.k}</Text> : null}
              <Text style={m.mono ? h.metaVMono : h.metaV}>{m.v}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={compact ? h.ruleThin : h.rule} />
    </View>
  );
}

export function PdfFooter({ children }) {
  return (
    <View style={h.footer} fixed>
      <Text style={h.footText}>{children}</Text>
    </View>
  );
}
