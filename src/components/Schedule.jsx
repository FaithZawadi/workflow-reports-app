"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COAL, GOLD, INK, MUTE, PAPER, LINE } from "@/lib/theme";
import { TEMPLATES, TECH_TEMPLATES, ENGINEER_TEMPLATES } from "@/lib/templates";
import { activityGroups, activityByKey } from "@/lib/activities";
import {
  FREQUENCIES,
  FREQUENCY_KEYS,
  DEFAULT_FREQUENCY,
  STATUS_META,
  duePhrase,
} from "@/lib/schedule";
import { canManageSchedulesRole, canFileReports, rolesOf } from "@/lib/roles";

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
  const [openTasks, setOpenTasks] = useState(null); // schedule id whose tasks panel is open
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
    if (!confirm(`Delete the ${s.templateName} schedule${s.weighbridgeId ? ` for ${s.weighbridgeId}` : ""} at ${s.clientName}?`)) return;
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
          <p className="eyebrow">Planning</p>
          <h1 className="h1">Activity schedule</h1>
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
          const canFileThis = canFile && (rolesOf(profile).includes("ADMIN") || TEMPLATES.find((t) => t.code === s.template));
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
                    {s.weighbridgeId ? <><strong>{s.weighbridgeId}</strong> · </> : null}{s.clientName}{s.site ? " — " + s.site : ""}
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
                      <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpenTasks(openTasks === s.id ? null : s.id)}>
                        {openTasks === s.id ? "Hide tasks" : "Assign tasks"}
                      </button>
                    )}
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

                  {openTasks === s.id && canManage && <SubTasks schedule={s} />}

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

// The exact tasks that make up a schedule's activity — each assigned to someone.
function SubTasks({ schedule }) {
  const [tasks, setTasks] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [dueAt, setDueAt] = useState(schedule.nextDueAt ? isoDate(schedule.nextDueAt) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch(`/api/tasks?scheduleId=${schedule.id}`).then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => setTasks([]));
  }, [schedule.id]);
  useEffect(() => {
    load();
    fetch("/api/users/directory").then((r) => r.json()).then((d) => setAssignees(d.assignees || [])).catch(() => {});
  }, [load]);

  const add = async () => {
    setErr("");
    if (!title.trim()) return setErr("Enter the task.");
    const a = assignees.find((x) => x.email === email);
    setBusy(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        scheduleId: schedule.id,
        clientName: schedule.clientName,
        weighbridgeId: schedule.weighbridgeId || "",
        assignedEmail: email || undefined,
        assignedName: a ? a.name : undefined,
        dueAt: dueAt || undefined,
        description: `From the ${schedule.templateName} schedule for ${schedule.clientName}${schedule.site ? " — " + schedule.site : ""}.`,
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || "Could not add the task.");
    setTitle("");
    load();
  };

  const toggleDone = async (t) => {
    await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: t.status === "DONE" ? "OPEN" : "DONE" }) });
    load();
  };

  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 12.5, color: INK, marginBottom: 6 }}>Tasks for this activity — assign each to someone</div>
      {tasks === null ? (
        <div className="muted" style={{ fontSize: 12 }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>No tasks yet — add the exact jobs and assign each to a person.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, background: "#fbf8f1", border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 8px" }}>
              <input type="checkbox" checked={t.status === "DONE"} onChange={() => toggleDone(t)} style={{ width: 16, height: 16 }} title="Mark done" />
              <span style={{ flex: 1, minWidth: 0, textDecoration: t.status === "DONE" ? "line-through" : "none", color: t.status === "DONE" ? MUTE : INK }}>{t.title}</span>
              <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t.assignedName || "Unassigned"}{t.dueAt ? ` · ${fmtDate(t.dueAt)}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <input className="input" placeholder="Task (e.g. Replace load cell no. 3)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 13 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select className="input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ fontSize: 12, flex: "1 1 160px" }}>
            <option value="">— assign to —</option>
            {assignees.map((a) => <option key={a.id} value={a.email}>{a.name}{a.role ? ` · ${a.role === "TECHNICIAN" ? "Technician" : a.role === "ENGINEER" ? "Engineer" : a.role}` : ""}</option>)}
          </select>
          <input className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={{ fontSize: 12, flex: "0 0 150px" }} />
          <button className="btn btn-dark" style={{ fontSize: 12 }} disabled={busy} onClick={add}>{busy ? "Adding…" : "Add & assign"}</button>
        </div>
      </div>
      {err && <div className="err" style={{ fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function ScheduleForm({ profile, onCreated }) {
  // The activities this user may schedule: report-form activities are limited by
  // role; the general activities (maintenance, calibration, …) are open to any
  // schedule manager.
  const groups = useMemo(() => {
    const roles = rolesOf(profile);
    const isBroad = roles.some((r) => ["ADMIN", "SUPERVISOR", "MANAGER"].includes(r));
    const allowed = new Set();
    if (isBroad) TEMPLATES.filter((t) => !t.hidden).forEach((t) => allowed.add(t.code));
    else {
      if (roles.includes("PROJECT_MANAGER")) TECH_TEMPLATES.forEach((c) => allowed.add(c));
      if (roles.includes("TECHNICAL_MANAGER")) ENGINEER_TEMPLATES.forEach((c) => allowed.add(c));
    }
    return activityGroups()
      .map((g) => ({ group: g.group, items: g.group === "Report forms" ? g.items.filter((i) => allowed.has(i.key)) : g.items }))
      .filter((g) => g.items.length);
  }, [profile]);
  const firstActivity = groups[0]?.items[0] || null;

  const [activity, setActivity] = useState(firstActivity?.key || "");
  const activityDef = activityByKey(activity);
  const [frequency, setFrequency] = useState((firstActivity?.template && DEFAULT_FREQUENCY[firstActivity.template]) || "MONTHLY");
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

  const pickActivity = (key) => {
    setActivity(key);
    const def = activityByKey(key);
    if (def?.template && DEFAULT_FREQUENCY[def.template]) setFrequency(DEFAULT_FREQUENCY[def.template]);
  };

  const submit = async () => {
    setErr("");
    if (!activity) return setErr("Choose an activity.");
    if (!clientName.trim()) return setErr("Choose the client (plant).");
    if (activityDef?.needsWeighbridge && !weighbridgeId.trim()) return setErr("Enter the weighbridge ID.");
    setBusy(true);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activity, frequency, intervalDays, clientName, site, weighbridgeId, assignedName, assignedEmail, firstDueAt, notes }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not create schedule.");
    onCreated();
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: GOLD }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New activity schedule</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        <label className="field">
          <span className="label">Activity</span>
          <select className="input" value={activity} onChange={(e) => pickActivity(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
              </optgroup>
            ))}
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
          <span className="label">Weighbridge{activityDef?.needsWeighbridge ? "" : " (optional)"}</span>
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
