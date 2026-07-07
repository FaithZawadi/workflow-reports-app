"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const SSTATUS = {
  OVERDUE: { label: "OVERDUE", color: FAIL },
  DUE_SOON: { label: "DUE NOW", color: WAIT },
  NO_RECORD: { label: "NO RECORD YET", color: "#7a7364" },
  OK: { label: "ON TRACK", color: PASS },
};

const FILTERS = [
  ["attention", "Needs attention"],
  ["all", "Everything"],
];

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export default function ScheduleBoard({ profile }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("attention");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/schedule");
    const data = await res.json();
    setItems(data.items || []);
  };
  useEffect(() => {
    load();
  }, []);

  const sendReminders = async () => {
    setBusy(true);
    setNote("Sending reminders…");
    try {
      const res = await fetch("/api/schedule/reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setNote(data.error || "Could not send reminders.");
      else {
        const sent = (data.emails || []).filter((e) => e.sent).length;
        setNote(
          `${data.overdue} overdue, ${data.dueSoon} due soon — ${
            sent ? `${sent} reminder email(s) sent.` : "no emails sent (email off or no recipients)."
          }`
        );
      }
    } catch {
      setNote("Network problem. Try again.");
    }
    setBusy(false);
  };

  const shown = (items || []).filter((i) => (filter === "attention" ? i.status !== "OK" : true));
  const counts = { OVERDUE: 0, DUE_SOON: 0, NO_RECORD: 0, OK: 0 };
  for (const i of items || []) counts[i.status]++;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Maintenance planner</p>
          <h1 className="h1">Schedule</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          {profile.role === "ADMIN" && (
            <button className="btn btn-dark" onClick={sendReminders} disabled={busy} style={{ fontSize: 12 }}>
              Email reminders now
            </button>
          )}
        </div>
      </div>

      <p className="muted" style={{ margin: "6px 0 12px" }}>
        Daily (WB01), weekly (WB02) and monthly (WB03) site checks, quarterly engineer service (WB04) and yearly
        calibration (WB06), tracked from the last filed report for each plant and site.
      </p>

      {items && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 12px" }}>
          {Object.entries(SSTATUS).map(([k, v]) => (
            <span key={k} className="pill" style={{ background: v.color }}>
              {counts[k]} {v.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="btn"
            style={filter === k ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}
          >
            {l}
          </button>
        ))}
      </div>

      {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{note}</div>}
      {items === null && <div className="muted">Working out what is due…</div>}
      {items && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {filter === "attention" ? "Nothing needs attention — every routine is on track." : "No scheduled items yet."}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {shown.map((i, idx) => {
          const st = SSTATUS[i.status];
          return (
            <div key={idx} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 4, background: st.color }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>
                    {i.template}
                  </span>
                  <span className="pill" style={{ background: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, marginTop: 8, color: INK }}>
                  {i.templateName}
                </div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {i.clientName}
                  {i.site ? " - " + i.site : ""}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {i.lastSerial ? (
                    <>
                      Last:{" "}
                      <Link href={`/reports/${i.lastSerial}`} style={{ fontWeight: 700 }}>
                        {i.lastSerial}
                      </Link>{" "}
                      on {fmtDate(i.lastAt)}
                    </>
                  ) : (
                    "Never filed"
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: i.status === "OVERDUE" ? FAIL : INK }}>
                  {i.dueAt
                    ? i.status === "OVERDUE"
                      ? `Was due ${fmtDate(i.dueAt)} (${Math.abs(i.daysLeft)} day${Math.abs(i.daysLeft) === 1 ? "" : "s"} late)`
                      : `Next due ${fmtDate(i.dueAt)}`
                    : `Every ${i.cadenceDays} day${i.cadenceDays === 1 ? "" : "s"} once the first report is filed`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
