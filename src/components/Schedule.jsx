"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COAL, GOLD, INK, MUTE, PAPER, LINE } from "@/lib/theme";
import { TEMPLATES } from "@/lib/templates";
import {
  FREQUENCIES,
  FREQUENCY_KEYS,
  DEFAULT_FREQUENCY,
  STATUS_META,
  duePhrase,
} from "@/lib/schedule";
import { canManageSchedulesRole, canFileReports } from "@/lib/roles";

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}
function isoDate(d) {
  const x = new Date(d);
  if (isNaN(x)) return "";
  return x.toISOString().slice(0, 10);
}

function StatusTag({ state }) {
  const m = STATUS_META[state] || STATUS_META.SCHEDULED;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        color: "#fff",
        background: m.color,
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}

export default function Schedule({ profile }) {
  const canManage = canManageSchedulesRole(profile);
  const canFile = canFileReports(profile);

  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // schedule id
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch("/api/schedules?" + params.toString());
    const d = await res.json();
    setData(d);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const schedules = data?.schedules || [];
  const summary = data?.summary || { overdue: 0, dueSoon: 0, scheduled: 0, total: 0 };

  const shown = useMemo(() => {
    if (stateFilter === "all") return schedules;
    return schedules.filter((s) => s.dueState === stateFilter);
  }, [schedules, stateFilter]);

  const markDone = async (s) => {
    setBusyId(s.id);
    setErr("");
    try {
      const res = await fetch(`/api/schedules/${s.id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) setErr((await res.json()).error || "Could not update.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const removeSchedule = async (s) => {
    if (!confirm(`Delete the ${s.template} schedule for ${s.weighbridgeId} at ${s.clientName}?`)) return;
    setBusyId(s.id);
    try {
      await fetch(`/api/schedules/${s.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Preventive maintenance</p>
          <h1 className="h1">Maintenance schedule</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          {canManage && (
            <button className="btn btn-dark" onClick={() => setShowForm((v) => !v)} style={{ fontSize: 12 }}>
              {showForm ? "Close" : "+ New schedule"}
            </button>
          )}
        </div>
      </div>

      {/* summary tiles */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "14px 0" }}>
        {[
          ["OVERDUE", "Overdue", summary.overdue],
          ["DUE_SOON", "Due soon", summary.dueSoon],
          ["SCHEDULED", "Scheduled", summary.scheduled],
        ].map(([key, label, n]) => {
          const m = STATUS_META[key];
          const active = stateFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStateFilter(active ? "all" : key)}
              className="card"
              style={{ textAlign: "left", padding: 14, borderColor: active ? m.color : LINE, borderWidth: active ? 2 : 1 }}
            >
              <div style={{ fontSize: 30, fontWeight: 900, color: m.color, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 4, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
            </button>
          );
        })}
      </div>

      {showForm && canManage && <ScheduleForm profile={profile} onCreated={() => { setShowForm(false); load(); }} />}

      <input className="input" placeholder="Search client, site, weighbridge or assignee…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "6px 0 12px" }} />
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {data === null && <div className="muted">Loading schedule…</div>}
      {data && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {summary.total === 0 ? "No maintenance schedules yet." : "Nothing matches this filter."}
          {canManage && summary.total === 0 && " Use “New schedule” to add the first weighbridge."}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
        {shown.map((s) => {
          const freq = FREQUENCIES[s.frequency]?.label || s.frequency;
          const canFileThis = canFile && (profile.role === "ADMIN" || TEMPLATES.find((t) => t.code === s.template));
          const fileHref =
            `/reports/new?template=${s.template}` +
            `&weighbridgeId=${encodeURIComponent(s.weighbridgeId || "")}` +
            `&client=${encodeURIComponent(s.clientName || "")}` +
            `&site=${encodeURIComponent(s.site || "")}` +
            `&scheduleId=${s.id}`;
          return (
            <div key={s.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", gap: 0 }}>
                <div style={{ width: 5, background: (STATUS_META[s.dueState] || STATUS_META.SCHEDULED).color }} />
                <div style={{ padding: 14, flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{s.template}</span>
                      <span style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 14, color: INK }}>{s.templateName}</span>
                      {!s.active && <span style={{ fontSize: 11, fontWeight: 700, color: MUTE }}>(paused)</span>}
                    </div>
                    <StatusTag state={s.dueState} />
                  </div>

                  <div className="muted" style={{ marginTop: 6, fontSize: 13, color: INK }}>
                    <strong>{s.weighbridgeId}</strong> · {s.clientName}{s.site ? " — " + s.site : ""}
                  </div>
                  <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                    {freq} · next due {fmtDate(s.nextDueAt)} (<span style={{ color: (STATUS_META[s.dueState] || {}).color, fontWeight: 700 }}>{duePhrase(s.dueDays)}</span>)
                    {" · "}last done {fmtDate(s.lastDoneAt)}
                    {s.assignedName ? ` · ${s.assignedName}` : ""}
                    {s.lastReportSerial ? (
                      <> · last: <Link href={`/reports/${s.lastReportSerial}`} style={{ color: GOLD, fontWeight: 700 }}>{s.lastReportSerial}</Link></>
                    ) : null}
                  </div>
                  {s.notes && <div className="muted" style={{ marginTop: 4, fontSize: 12, fontStyle: "italic" }}>{s.notes}</div>}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {canFileThis && s.active && (
                      <Link href={fileHref} className="btn btn-primary" style={{ fontSize: 12, padding: "6px 10px" }}>File report</Link>
                    )}
                    <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} disabled={busyId === s.id} onClick={() => markDone(s)}>
                      {busyId === s.id ? "…" : "Mark done"}
                    </button>
                    {canManage && (
                      <>
                        <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === s.id ? null : s.id)}>
                          {editing === s.id ? "Cancel" : "Edit"}
                        </button>
                        <button className="btn" style={{ fontSize: 12, padding: "6px 10px", color: "#B03A2E" }} disabled={busyId === s.id} onClick={() => removeSchedule(s)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  {editing === s.id && canManage && (
                    <EditRow schedule={s} onSaved={() => { setEditing(null); load(); }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditRow({ schedule, onSaved }) {
  const [frequency, setFrequency] = useState(schedule.frequency);
  const [intervalDays, setIntervalDays] = useState(schedule.intervalDays || 14);
  const [nextDueAt, setNextDueAt] = useState(isoDate(schedule.nextDueAt));
  const [assignedName, setAssignedName] = useState(schedule.assignedName || "");
  const [assignedEmail, setAssignedEmail] = useState(schedule.assignedEmail || "");
  const [active, setActive] = useState(schedule.active);
  const [notes, setNotes] = useState(schedule.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/schedules/${schedule.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frequency, intervalDays, nextDueAt, assignedName, assignedEmail, active, notes }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  return (
    <div style={{ marginTop: 10, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 }}>
      <div className="grid md-2" style={{ gap: 8 }}>
        <label className="field">
          <span className="label">Frequency</span>
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCY_KEYS.map((k) => <option key={k} value={k}>{FREQUENCIES[k].label}</option>)}
          </select>
        </label>
        {frequency === "CUSTOM" && (
          <label className="field">
            <span className="label">Every N days</span>
            <input className="input" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="label">Next due</span>
          <input className="input" type="date" value={nextDueAt} onChange={(e) => setNextDueAt(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Assignee name</span>
          <input className="input" value={assignedName} onChange={(e) => setAssignedName(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Assignee email</span>
          <input className="input" type="email" value={assignedEmail} onChange={(e) => setAssignedEmail(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="label">Notes</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
      <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

function ScheduleForm({ profile, onCreated }) {
  const manageable = useMemo(() => {
    if (["ADMIN", "SUPERVISOR", "MANAGER"].includes(profile.role)) return TEMPLATES;
    if (profile.role === "PROJECT_MANAGER") return TEMPLATES.filter((t) => t.who === "Site Technician");
    if (profile.role === "TECHNICAL_MANAGER") return TEMPLATES.filter((t) => t.who === "QSL Engineer");
    return [];
  }, [profile.role]);

  const [template, setTemplate] = useState(manageable[0]?.code || "");
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY[manageable[0]?.code] || "MONTHLY");
  const [intervalDays, setIntervalDays] = useState(14);
  const [clientName, setClientName] = useState("");
  const [site, setSite] = useState("");
  const [weighbridgeId, setWeighbridgeId] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [firstDueAt, setFirstDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [clients, setClients] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [weighbridges, setWeighbridges] = useState([]);
  const [wbManual, setWbManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/users/directory").then((r) => r.json()).then((d) => setAssignees(d.assignees || [])).catch(() => {});
    fetch("/api/weighbridges").then((r) => r.json()).then((d) => setWeighbridges(d.weighbridges || [])).catch(() => {});
  }, []);

  const pickTemplate = (code) => {
    setTemplate(code);
    setFrequency(DEFAULT_FREQUENCY[code] || "MONTHLY");
  };

  const submit = async () => {
    setErr("");
    if (!template) return setErr("Choose a form.");
    if (!clientName.trim()) return setErr("Choose the client (plant).");
    if (!weighbridgeId.trim()) return setErr("Enter the weighbridge ID.");
    setBusy(true);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template, frequency, intervalDays, clientName, site, weighbridgeId, assignedName, assignedEmail, firstDueAt, notes }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not create schedule.");
    onCreated();
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: GOLD }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New maintenance schedule</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        <label className="field">
          <span className="label">Form</span>
          <select className="input" value={template} onChange={(e) => pickTemplate(e.target.value)}>
            {manageable.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">How often</span>
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCY_KEYS.map((k) => <option key={k} value={k}>{FREQUENCIES[k].label}</option>)}
          </select>
        </label>
        {frequency === "CUSTOM" && (
          <label className="field">
            <span className="label">Every N days</span>
            <input className="input" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="label">Client (plant)</span>
          <input className="input" list="sched-clients" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. TATA Chemicals Magadi" />
          <datalist id="sched-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </label>
        <label className="field">
          <span className="label">Site / location</span>
          <input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. Dispatch gate" />
        </label>
        <label className="field">
          <span className="label">Weighbridge</span>
          {(() => {
            const list = weighbridges.filter((w) => { const c = clientName.trim().toLowerCase(); return !c || (w.client || "").toLowerCase() === c; });
            if (list.length === 0 || wbManual) {
              return <input className="input" value={weighbridgeId} onChange={(e) => setWeighbridgeId(e.target.value)} placeholder="e.g. WB-1" />;
            }
            const sel = list.find((w) => w.label === weighbridgeId);
            return (
              <select className="input" value={sel ? sel.id : ""} onChange={(e) => {
                if (e.target.value === "__other") { setWbManual(true); setWeighbridgeId(""); return; }
                const w = list.find((x) => x.id === e.target.value);
                if (w) setWeighbridgeId(w.label);
              }}>
                <option value="">— choose weighbridge —</option>
                {list.map((w) => <option key={w.id} value={w.id}>{w.label}{w.site ? ` — ${w.site}` : ""}</option>)}
                <option value="__other">Other (type it)…</option>
              </select>
            );
          })()}
        </label>
        <label className="field">
          <span className="label">First due (optional)</span>
          <input className="input" type="date" value={firstDueAt} onChange={(e) => setFirstDueAt(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Assign to</span>
          {assignees.length > 0 ? (
            <select
              className="input"
              value={assignedEmail}
              onChange={(e) => {
                const email = e.target.value;
                const p = assignees.find((a) => a.email === email);
                setAssignedEmail(email);
                setAssignedName(p ? p.name : "");
              }}
            >
              <option value="">— Unassigned —</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.email}>
                  {a.name} · {a.role === "TECHNICIAN" ? "Technician" : "Engineer"}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={assignedName} onChange={(e) => setAssignedName(e.target.value)} placeholder="assignee name" />
          )}
        </label>
      </div>
      <label className="field">
        <span className="label">Notes (optional)</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginTop: 6 }}>
        {busy ? "Creating…" : "Create schedule"}
      </button>
    </div>
  );
}
