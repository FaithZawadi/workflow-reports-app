import React from "react";
import { Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

// ============================================================================
// Refined document design system — one shared visual language for every QSL PDF
// (reports, quotations, invoices, statements, requests, surveys, logs). Each
// document type carries a thin ACCENT bar at the very top; everything else —
// letterhead, coal title pill, gold-square section heads, zebra tables, coal
// totals bar, payment grid and the ISO footer — is shared so the family reads
// as one. Gold on light backgrounds uses GOLD_DK so it still reads in grayscale.
// ============================================================================

export const R = {
  GOLD: "#F5A800",
  GOLD_DK: "#8A6A00",
  COAL: "#161310",
  INK: "#26221C",
  MUTE: "#6B6355",
  FAINT: "#9A927F",
  PASS: "#2E7D46",
  FAIL: "#B03A2E",
  WAIT: "#946B00",
  LINE: "#E4DCCB",
  HAIR: "#D9D2C3",
  CREAM: "#F6F1E4",
  // Per-document accent colours + a very light tint for zebra striping.
  ACCENT: {
    report: { bar: "#1E6B63", tint: "#EDF5F3" },
    quotation: { bar: "#2E5E8E", tint: "#EBF2F8" },
    invoice: { bar: "#8A5A1E", tint: "#FistBronze" }, // overridden below
    statement: { bar: "#5A4A7A", tint: "#F1EEF6" },
    management: { bar: "#2F6E4F", tint: "#ECF4EF" },
    calibration: { bar: "#1E6B63", tint: "#EDF5F3" },
    survey: { bar: "#8A5A1E", tint: "#FAF3E9" },
    training: { bar: "#2F6E4F", tint: "#ECF4EF" },
    audit: { bar: "#444039", tint: "#F2F0EC" },
    default: { bar: "#161310", tint: "#F5F2EB" },
  },
};
R.ACCENT.invoice.tint = "#FAF3E9";

export function accentOf(kind) {
  return R.ACCENT[kind] || R.ACCENT.default;
}

const s = StyleSheet.create({
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 13 },

  // ---- header -------------------------------------------------------------
  header: {},
  hRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 14 },
  logoBox: { width: 62, height: 62, borderWidth: 0.8, borderColor: R.HAIR, borderRadius: 4, padding: 4, marginRight: 11, alignItems: "center", justifyContent: "center" },
  logo: { width: 52, height: 52, objectFit: "contain" },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", color: R.COAL, letterSpacing: 0.3 },
  brandGold: { color: R.GOLD_DK },
  hText: { flex: 1, paddingTop: 3 },
  contact: { fontSize: 7.3, color: R.INK, marginTop: 1.5, lineHeight: 1.35 },
  contactGold: { fontSize: 7.3, color: R.GOLD_DK, marginTop: 1.5, fontFamily: "Helvetica-Bold" },
  hRight: { minWidth: 210 },
  metaRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 3.5, justifyContent: "flex-end" },
  metaK: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.6, textTransform: "uppercase", width: 52, textAlign: "right", marginRight: 10 },
  metaV: { fontSize: 8.6, fontFamily: "Helvetica-Bold", color: R.COAL, width: 148, textAlign: "left" },
  metaVMono: { fontSize: 8.4, fontFamily: "Courier-Bold", color: R.COAL, width: 148, textAlign: "left" },
  headRule: { borderBottomWidth: 1.4, borderBottomColor: R.GOLD_DK, marginTop: 8 },

  // ---- title pill ---------------------------------------------------------
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 10 },
  pill: { backgroundColor: R.COAL, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 3 },
  pillText: { fontSize: 15, fontFamily: "Helvetica-Bold", color: R.GOLD, letterSpacing: 2.5, textTransform: "uppercase" },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 3 },
  badgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, textTransform: "uppercase" },

  // ---- section head -------------------------------------------------------
  secHead: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: R.GOLD_DK, paddingBottom: 3, marginBottom: 6 },
  secSquare: { width: 6, height: 6, backgroundColor: R.GOLD, marginRight: 6 },
  secLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: R.MUTE, letterSpacing: 1, textTransform: "uppercase" },
  secCount: { fontSize: 7.5, color: R.FAINT, fontFamily: "Helvetica-Bold", marginLeft: 4 },

  // ---- key/value table ----------------------------------------------------
  kv: {},
  kvRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: R.HAIR, minHeight: 17, alignItems: "stretch" },
  kvK: { backgroundColor: "#F7F4EC", paddingVertical: 4, paddingHorizontal: 7, fontSize: 7, fontFamily: "Helvetica-Bold", color: R.MUTE, letterSpacing: 0.4, textTransform: "uppercase", justifyContent: "center" },
  kvV: { paddingVertical: 4, paddingHorizontal: 8, fontSize: 8.6, color: R.INK, justifyContent: "center", flex: 1 },

  // ---- items table --------------------------------------------------------
  itHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: R.COAL, paddingBottom: 4, paddingTop: 2 },
  itHeadCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 5 },
  itRow: { flexDirection: "row", alignItems: "stretch", minHeight: 20, borderBottomWidth: 0.5, borderBottomColor: R.HAIR },
  itCell: { fontSize: 8.4, color: R.INK, paddingVertical: 5, paddingHorizontal: 5, justifyContent: "center" },
  itCellNum: { fontSize: 8.2, color: R.INK, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, justifyContent: "center", textAlign: "right" },
  itNo: { fontSize: 8, color: R.FAINT, fontFamily: "Courier", paddingVertical: 5, paddingHorizontal: 5, justifyContent: "center", textAlign: "center" },

  // ---- totals -------------------------------------------------------------
  totWrap: { width: "48%" },
  totRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: R.HAIR },
  totK: { fontSize: 8.6, color: R.MUTE },
  totKStrong: { fontSize: 8.8, color: R.INK, fontFamily: "Helvetica-Bold" },
  totV: { fontSize: 8.8, color: R.INK, fontFamily: "Courier" },
  totVStrong: { fontSize: 8.8, color: R.INK, fontFamily: "Courier-Bold" },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: R.COAL, paddingVertical: 8, paddingHorizontal: 12, marginTop: 4 },
  grandK: { fontSize: 11, color: R.GOLD, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  grandV: { fontSize: 13, color: "#fff", fontFamily: "Helvetica-Bold" },

  // ---- QR summary ---------------------------------------------------------
  qrSum: { flexDirection: "row", alignItems: "flex-start", width: "46%" },
  qrImg: { width: 72, height: 72, marginRight: 10 },
  qrTitle: { fontSize: 8.6, fontFamily: "Helvetica-Bold", color: R.INK },
  qrSub: { fontSize: 7.4, color: R.MUTE, marginTop: 3, lineHeight: 1.35 },

  // ---- payment grid -------------------------------------------------------
  payLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  payGrid: { borderWidth: 0.6, borderColor: R.HAIR, borderRadius: 2 },
  payBand: { flexDirection: "row" },
  payCell: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", paddingVertical: 6, paddingHorizontal: 7, borderRightWidth: 0.5, borderRightColor: R.HAIR },
  payCK: { fontSize: 6.4, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.5, textTransform: "uppercase", marginRight: 5 },
  payCV: { fontSize: 8.4, fontFamily: "Helvetica-Bold", color: R.COAL },

  // ---- terms --------------------------------------------------------------
  termsLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 },
  termRow: { flexDirection: "row", marginBottom: 4 },
  termNo: { fontSize: 8.4, fontFamily: "Helvetica-Bold", color: R.COAL, width: 16 },
  termText: { fontSize: 8.4, color: R.INK, flex: 1, lineHeight: 1.35 },

  // ---- footer -------------------------------------------------------------
  footer: { position: "absolute", bottom: 20, left: 34, right: 34 },
  footRule: { borderBottomWidth: 1.2, borderBottomColor: R.GOLD_DK, marginBottom: 5 },
  footIso: { fontSize: 7, fontFamily: "Helvetica-Bold", color: R.COAL, textAlign: "center", letterSpacing: 0.3 },
  footSub: { fontSize: 6.6, fontFamily: "Courier", color: R.FAINT, textAlign: "center", marginTop: 3 },
  footNote: { fontSize: 6.6, color: R.MUTE, textAlign: "center", marginTop: 3 },
  verifyBox: { position: "absolute", bottom: 54, right: 34, alignItems: "center" },
  verifyQr: { width: 46, height: 46 },
  verifyTxt: { fontSize: 5.8, fontFamily: "Helvetica-Bold", color: R.FAINT, letterSpacing: 0.6, marginTop: 2 },
});

// A thin full-width accent bar pinned to the very top of every page.
export function TopBar({ kind = "default", color }) {
  const c = color || accentOf(kind).bar;
  return <View fixed style={[s.topBar, { backgroundColor: c }]} />;
}

// Standard letterhead: boxed logo + contact lines on the left, right-aligned
// LABEL / value meta rows, closed by a gold rule. meta: [{ k, v, mono? }].
export function RefinedHeader({ logoSrc, meta = [], contactLines }) {
  const lines = contactLines || [
    COMPANY.postal || COMPANY.address,
    `${COMPANY.phone}`,
  ];
  return (
    <View style={s.header}>
      <View style={s.hRow}>
        <View style={s.hLeft}>
          {logoSrc ? (
            <View style={s.logoBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={logoSrc} style={s.logo} />
            </View>
          ) : null}
          <View style={s.hText}>
            {!logoSrc && <Text style={s.brand}>QALIBRATED <Text style={s.brandGold}>SYSTEMS</Text></Text>}
            {lines.map((ln, i) => (
              <Text key={i} style={s.contact}>{ln}</Text>
            ))}
            <Text style={s.contactGold}>{COMPANY.email} · {COMPANY.website}</Text>
          </View>
        </View>
        <View style={s.hRight}>
          {meta.map((m, i) => (
            <View key={i} style={s.metaRow}>
              <Text style={s.metaK}>{m.k}</Text>
              <Text style={m.mono ? s.metaVMono : s.metaV}>{m.v}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.headRule} />
    </View>
  );
}

// Coal title pill with gold text + an optional coloured status badge.
export function TitlePill({ title, status }) {
  return (
    <View style={s.titleRow}>
      <View style={s.pill}><Text style={s.pillText}>{title}</Text></View>
      {status ? (
        <View style={[s.badge, { backgroundColor: status.bg || R.COAL }]}>
          <Text style={[s.badgeText, { color: status.color || "#fff" }]}>{status.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Gold-square section header with a gold underline. `count` prints "· N".
export function SectionHead({ children, count, style }) {
  return (
    <View style={[s.secHead, style]}>
      <View style={s.secSquare} />
      <Text style={s.secLabel}>{children}</Text>
      {count != null ? <Text style={s.secCount}>· {count}</Text> : null}
    </View>
  );
}

// Key/value table. rows: [{ k, v, gold?, strong?, fail? }]. keyWidth is a %.
export function KVTable({ rows, keyWidth = "34%" }) {
  return (
    <View style={s.kv}>
      {rows.map((r, i) => (
        <View key={i} style={[s.kvRow, i === rows.length - 1 ? { borderBottomWidth: 0 } : null]}>
          <Text style={[s.kvK, { width: keyWidth }, r.gold ? { color: R.GOLD_DK } : null]}>{r.k}</Text>
          <Text style={[s.kvV, r.strong ? { fontFamily: "Helvetica-Bold" } : null, r.fail ? { color: R.FAIL, fontFamily: "Helvetica-Bold" } : null]}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

// Totals block: rows [{ k, v, strong?, muted? }] then a coal grand-total bar.
export function Totals({ rows = [], grand }) {
  return (
    <View style={s.totWrap}>
      {rows.map((r, i) => (
        <View key={i} style={s.totRow}>
          <Text style={r.strong ? s.totKStrong : s.totK}>{r.k}</Text>
          <Text style={r.strong ? s.totVStrong : s.totV}>{r.v}</Text>
        </View>
      ))}
      {grand ? (
        <View style={s.grand}>
          <Text style={s.grandK}>{grand.k}</Text>
          <Text style={s.grandV}>{grand.v}</Text>
        </View>
      ) : null}
    </View>
  );
}

// The "Document summary" QR block shown to the left of the totals.
export function QrSummary({ qrSrc, title = "Document summary", text }) {
  if (!qrSrc) return <View style={s.qrSum} />;
  return (
    <View style={s.qrSum}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={qrSrc} style={s.qrImg} />
      <View style={{ flex: 1 }}>
        <Text style={s.qrTitle}>{title}</Text>
        <Text style={s.qrSub}>{text || "Scan for the reference, client and total. Encoded in the code itself — no network needed."}</Text>
      </View>
    </View>
  );
}

// Payment-details grid. pairs: [{ label, value }] laid out in balanced bands.
export function PaymentGrid({ pairs, perRow = 4 }) {
  if (!pairs || pairs.length === 0) return null;
  const bands = [];
  for (let i = 0; i < pairs.length; i += perRow) bands.push(pairs.slice(i, i + perRow));
  return (
    <View wrap={false}>
      <Text style={s.payLabel}>Payment details</Text>
      <View style={s.payGrid}>
        {bands.map((band, bi) => {
          const w = `${100 / band.length}%`;
          return (
            <View key={bi} style={[s.payBand, bi < bands.length - 1 ? { borderBottomWidth: 0.5, borderBottomColor: R.HAIR } : null]}>
              {band.map((p, ci) => (
                <View key={ci} style={[s.payCell, { width: w }, ci === band.length - 1 ? { borderRightWidth: 0 } : null]}>
                  <Text style={s.payCK}>{p.label}</Text>
                  <Text style={s.payCV}>{p.value}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// "Terms & notes" numbered list. items: string[].
export function TermsNotes({ items, label = "Terms & notes" }) {
  if (!items || items.length === 0) return null;
  return (
    <View wrap={false}>
      <Text style={s.termsLabel}>{label}</Text>
      {items.map((t, i) => (
        <View key={i} style={s.termRow}>
          <Text style={s.termNo}>{i + 1}.</Text>
          <Text style={s.termText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

// ISO footer, repeated on every page. `serial` prints in the sub-line with the
// page number; `note` is an optional centred line above it.
export function RefinedFooter({ serial, note }) {
  return (
    <View style={s.footer} fixed>
      {note ? <Text style={[s.footNote, { marginTop: 0, marginBottom: 5 }]}>{note}</Text> : null}
      <View style={s.footRule} />
      <Text style={s.footIso}>ISO 9001:2015 CERTIFIED (TNV)  |  ISO/IEC 17025:2017 ACCREDITED (KENAS)  |  ILAC-MRA</Text>
      <Text
        style={s.footSub}
        render={({ pageNumber, totalPages }) =>
          `${COMPANY.name} · ${serial || ""} · System-generated · Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// Small "SCAN TO VERIFY" QR pinned bottom-right, above the footer (page 1 only).
export function VerifyQr({ qrSrc }) {
  if (!qrSrc) return null;
  return (
    <View
      fixed
      style={s.verifyBox}
      render={({ pageNumber }) => (pageNumber === 1 ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrSrc} style={s.verifyQr} />
          <Text style={s.verifyTxt}>SCAN TO VERIFY</Text>
        </>
      ) : null)}
    />
  );
}

// Shared helpers.
export function fmtDate(d, withTime) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    }).replace(",", " ·") + (withTime ? " EAT" : "");
  } catch { return String(d); }
}
export const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
