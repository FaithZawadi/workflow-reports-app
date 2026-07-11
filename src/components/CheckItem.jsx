"use client";
import { PASS, FAIL, WAIT, MUTE, INK } from "@/lib/theme";

// A checklist supports 2 or 3 result states. Default is the OK / problem pair;
// engineer forms pass explicit states such as OK / ATTN / N/A or PASS / ADJ / FAIL.
export function defaultStates(yes = "OK", no = "NEEDS ATTENTION") {
  return [
    { key: "ok", label: yes, color: PASS },
    { key: "problem", label: no, color: FAIL },
  ];
}

const STATE_COLORS = { ok: PASS, pass: PASS, attn: WAIT, adj: WAIT, na: MUTE, problem: FAIL, fail: FAIL };
export function colorFor(key) {
  return STATE_COLORS[key] || FAIL;
}

const gridCols = (n) => `minmax(150px,1fr) ${n >= 3 ? 264 : 190}px minmax(150px,1.1fr)`;
export const CHECK_TABLE_MINWIDTH = 700;

const cellBase = {
  padding: "8px 10px",
  borderRight: "1px solid #e6e0d2",
  borderBottom: "1px solid #e6e0d2",
  display: "flex",
  alignItems: "center",
};

export function CheckHeader({ states }) {
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
    <div style={{ display: "grid", gridTemplateColumns: gridCols(states.length) }}>
      <span style={th}>Item</span>
      <span style={{ ...th, justifyContent: "center" }}>Result — {states.map((s) => s.label).join(" / ")}</span>
      <span style={{ ...th, borderRight: 0 }}>Remarks</span>
    </div>
  );
}

export default function CheckItem({ text, states, val, onChange }) {
  const active = val?.state;
  // A remark is expected on anything that isn't the first ("good") state.
  const isFlagged = active && active !== states[0].key;

  const pill = (s) => {
    const on = active === s.key;
    const showTick = s.key === "ok" || s.key === "pass";
    const col = colorFor(s.key);
    return (
      <button
        key={s.key}
        type="button"
        onClick={() => onChange({ ...val, state: s.key })}
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 800,
          padding: "8px 4px",
          borderRadius: 2,
          border: "1px solid",
          borderColor: on ? col : "#cfc8ba",
          background: on ? col : "#fff",
          color: on ? "#fff" : col,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {on && showTick && <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>✓</span>}
        {s.label}
      </button>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: gridCols(states.length) }}>
      <span style={{ ...cellBase, fontSize: 14, color: INK }}>{text}</span>
      <div style={{ ...cellBase, gap: 6 }}>{states.map(pill)}</div>
      <div style={{ ...cellBase, borderRight: 0 }}>
        <input
          className="input"
          spellCheck
          autoCapitalize="sentences"
          style={isFlagged ? { borderColor: FAIL, background: "#fdf1ef" } : undefined}
          placeholder={isFlagged ? "What needs attention — your Equipment User will read it" : "Remark (optional)"}
          value={val?.remark || ""}
          onChange={(e) => onChange({ ...val, remark: e.target.value })}
        />
      </div>
    </div>
  );
}
