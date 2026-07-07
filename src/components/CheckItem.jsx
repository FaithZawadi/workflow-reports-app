"use client";
import { PASS, FAIL, INK } from "@/lib/theme";

export default function CheckItem({ text, yes = "OK", no = "NEEDS ATTENTION", val, onChange }) {
  const state = val?.state;
  const pillBtn = (active, color, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 12,
        fontWeight: 800,
        padding: "9px 10px",
        borderRadius: 2,
        border: "1px solid",
        borderColor: active ? color : "#cfc8ba",
        background: active ? color : "#fff",
        color: active ? "#fff" : color,
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: INK, flex: "1 1 220px" }}>{text}</span>
          <div style={{ display: "flex", gap: 6, minWidth: 180 }}>
            {pillBtn(state === "ok", PASS, yes, () => onChange({ ...val, state: "ok" }))}
            {pillBtn(state === "problem", FAIL, no, () => onChange({ ...val, state: "problem" }))}
          </div>
        </div>
        {state === "problem" && (
          <input
            className="input"
            style={{ borderColor: FAIL, background: "#fdf1ef" }}
            placeholder="Write what needs attention — your supervisor will read it"
            value={val?.remark || ""}
            onChange={(e) => onChange({ ...val, remark: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
