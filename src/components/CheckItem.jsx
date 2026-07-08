"use client";
import { PASS, FAIL, INK } from "@/lib/theme";

// Shared column layout so the header row and every result row line up as a
// real table (Item | Result | Remarks). Kept in one place and exported so the
// header in ReportForm uses exactly the same tracks.
export const CHECK_COLS = "minmax(150px,1fr) 188px minmax(150px,1.1fr)";
export const CHECK_TABLE_MINWIDTH = 620;

const cellBase = {
  padding: "8px 10px",
  borderRight: "1px solid #e6e0d2",
  borderBottom: "1px solid #e6e0d2",
  display: "flex",
  alignItems: "center",
};

export function CheckHeader({ yes = "OK", no = "NEEDS ATTENTION" }) {
  const th = {
    ...cellBase,
    background: "#161310",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: ".03em",
    textTransform: "uppercase",
    borderRightColor: "#2c2720",
    borderBottom: 0,
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: CHECK_COLS }}>
      <span style={th}>Item</span>
      <span style={{ ...th, justifyContent: "center" }}>
        Result — {yes} / {no}
      </span>
      <span style={{ ...th, borderRight: 0 }}>Remarks</span>
    </div>
  );
}

export default function CheckItem({ text, yes = "OK", no = "NEEDS ATTENTION", val, onChange }) {
  const state = val?.state;
  const isProblem = state === "problem";

  const pillBtn = (active, color, label, onClick, showTick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 12,
        fontWeight: 800,
        padding: "8px 6px",
        borderRadius: 2,
        border: "1px solid",
        borderColor: active ? color : "#cfc8ba",
        background: active ? color : "#fff",
        color: active ? "#fff" : color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      {showTick && <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>✓</span>}
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: CHECK_COLS }}>
      <span style={{ ...cellBase, fontSize: 14, color: INK }}>{text}</span>
      <div style={{ ...cellBase, gap: 6 }}>
        {pillBtn(state === "ok", PASS, yes, () => onChange({ ...val, state: "ok" }), true)}
        {pillBtn(isProblem, FAIL, no, () => onChange({ ...val, state: "problem" }), false)}
      </div>
      <div style={{ ...cellBase, borderRight: 0 }}>
        <input
          className="input"
          style={isProblem ? { borderColor: FAIL, background: "#fdf1ef" } : undefined}
          placeholder={isProblem ? "What needs attention — your supervisor will read it" : "Remark (optional)"}
          value={val?.remark || ""}
          onChange={(e) => onChange({ ...val, remark: e.target.value })}
        />
      </div>
    </div>
  );
}
