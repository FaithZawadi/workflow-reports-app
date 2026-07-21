"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COAL, GOLD, INK, MUTE, PAPER, LINE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_META = {
  OPEN: { label: "Open", color: MUTE },
  IN_PROGRESS: { label: "In progress", color: WAIT },
  BLOCKED: { label: "Blocked", color: FAIL },
  DONE: { label: "Done", color: PASS },
};
const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITY_COLOR = { HIGH: FAIL, MEDIUM: WAIT, LOW: MUTE };

// Bold status tiles (like a field-service board) — coloured to sit alongside the
// QSL gold/coal brand. Each tile fetches its count from the tasks in the
// database and filters the list when tapped. The last two are derived buckets.
const TILES = [
  { key: "OPEN", label: "Open", color: "#B07A16", icon: "hourglass" },
  { key: "IN_PROGRESS", label: "In progress", color: "#2E6DA4", icon: "gear" },
  { key: "BLOCKED", label: "Blocked", color: "#B03A2E", icon: "pause" },
  { key: "DONE", label: "Done", color: "#2E7D46", icon: "check" },
  { key: "UNASSIGNED", label: "Unassigned", color: "#5A4B8A", icon: "user" },
  { key: "OVERDUE", label: "Overdue", color: "#8A2D2D", icon: "alert" },
];

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return null; }
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.OPEN;
  return <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "#fff", background: m.color, padding: "2px 8px", borderRadius: 999 }}>{m.label}</span>;
}

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("project"); // project | client | assignee
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [weighbridges, setWeighbridges] = useState([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (!res.ok) return setErr("Could not load tasks.");
    const d = await res.json();
    setTasks(d.tasks || []);
    setCanManage(!!d.canManage);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || [])).catch(() => {});
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/users/directory").then((r) => r.json()).then((d) => setAssignees([...(d.assignees || []), ...(d.supervisors || []), ...(d.managers || [])])).catch(() => {});
    fetch("/api/weighbridges").then((r) => r.json()).then((d) => setWeighbridges(d.weighbridges || [])).catch(() => {});
  }, [load]);

  const setStatus = async (t, status) => {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) setErr((await res.json()).error || "Could not update.");
      await load();
    } finally { setBusyId(null); }
  };

  const removeTask = async (t) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    setBusyId(t.id);
    try { await fetch(`/api/tasks/${t.id}`, { method: "DELETE" }); await load(); } finally { setBusyId(null); }
  };

  const isOverdue = (t) => t.dueAt && t.status !== "DONE" && new Date(t.dueAt) < new Date(new Date().toDateString());
  const isUnassigned = (t) => !t.assignedName && !t.assignedToId;

  const shown = useMemo(() => {
    let list = tasks || [];
    if (statusFilter === "UNASSIGNED") list = list.filter(isUnassigned);
    else if (statusFilter === "OVERDUE") list = list.filter(isOverdue);
    else if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((t) => [t.title, t.description, t.project, t.clientName, t.assignedName, t.weighbridgeId].some((v) => String(v || "").toLowerCase().includes(s)));
    return list;
  }, [tasks, statusFilter, q]);

  // Cluster the list by the chosen dimension.
  const groups = useMemo(() => {
    const keyFor = (t) => groupBy === "project" ? (t.project || "No project") : groupBy === "client" ? (t.clientName || "No company") : (t.assignedName || "Unassigned");
    const map = new Map();
    for (const t of shown) {
      const k = keyFor(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown, groupBy]);

  const counts = useMemo(() => {
    const c = { OPEN: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0, UNASSIGNED: 0, OVERDUE: 0 };
    const today = new Date(new Date().toDateString());
    (tasks || []).forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
      if (!t.assignedName && !t.assignedToId) c.UNASSIGNED += 1;
      if (t.dueAt && t.status !== "DONE" && new Date(t.dueAt) < today) c.OVERDUE += 1;
    });
    return c;
  }, [tasks]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Work tracking</p>
          <h1 className="h1">Tasks</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          {canManage && (
            <button className="btn btn-dark" onClick={() => setShowForm((v) => !v)} style={{ fontSize: 12 }}>
              {showForm ? "Close" : "+ New task"}
            </button>
          )}
        </div>
      </div>

      {/* status board — bold tiles, each fetching its count from the tasks in the
          database and filtering the list when tapped */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "14px 0" }}>
        {TILES.map((tile) => {
          const active = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => setStatusFilter(active ? "all" : tile.key)}
              aria-pressed={active}
              className="task-tile"
              style={{
                position: "relative",
                textAlign: "left",
                border: "none",
                borderRadius: 12,
                padding: 16,
                minHeight: 116,
                color: "#fff",
                background: tile.color,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                overflow: "hidden",
                boxShadow: active ? `0 0 0 3px #fff, 0 0 0 5px ${tile.color}` : "0 6px 16px rgba(22,19,16,.14)",
                transform: active ? "translateY(-2px)" : "none",
                transition: "transform .15s ease, box-shadow .15s ease",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 10, right: 10,
                  minWidth: 26, height: 26, padding: "0 8px",
                  borderRadius: 999, background: "rgba(255,255,255,.92)", color: tile.color,
                  fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {counts[tile.key] || 0}
              </span>
              <span style={{ position: "absolute", top: 12, left: 14, opacity: 0.9 }} aria-hidden>
                <TileIcon name={tile.icon} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: ".01em" }}>{tile.label}</span>
            </button>
          );
        })}
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      {showForm && canManage && (
        <TaskForm projects={projects} clients={clients} assignees={assignees} weighbridges={weighbridges} onSaved={() => { setShowForm(false); load(); }} />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "6px 0 12px" }}>
        <input className="input" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 220px" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: MUTE }}>
          Group by
          <select className="input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ width: "auto" }}>
            <option value="project">Project</option>
            <option value="client">Company</option>
            <option value="assignee">Assignee</option>
          </select>
        </label>
      </div>

      {tasks === null && <div className="muted">Loading tasks…</div>}
      {tasks && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          {(tasks || []).length === 0 ? (canManage ? "No tasks yet. Use “New task” to assign the first one." : "No tasks assigned to you.") : "Nothing matches this filter."}
        </div>
      )}

      {groups.map(([groupName, items]) => (
        <ClusterGroup key={groupName} name={groupName} count={items.length}>
          {items.map((t) => (
            <TaskCard
              key={t.id}
              t={t}
              canManage={canManage}
              busy={busyId === t.id}
              onStatus={(s) => setStatus(t, s)}
              onEdit={() => setEditing(editing === t.id ? null : t.id)}
              editingOpen={editing === t.id}
              onDelete={() => removeTask(t)}
              editForm={
                editing === t.id && canManage ? (
                  <TaskForm task={t} projects={projects} clients={clients} assignees={assignees} weighbridges={weighbridges} onSaved={() => { setEditing(null); load(); }} />
                ) : null
              }
            />
          ))}
        </ClusterGroup>
      ))}
    </div>
  );
}

// White line icons for the status tiles (colour = currentColor = white).
function TileIcon({ name }) {
  const p = { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "hourglass":
      return (<svg {...p}><path d="M7 3h10M7 21h10" /><path d="M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9" /></svg>);
    case "gear":
      return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>);
    case "pause":
      return (<svg {...p}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
    case "check":
      return (<svg {...p}><path d="M4 12.5l5 5L20 6.5" /></svg>);
    case "user":
      return (<svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>);
    case "alert":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>);
    default:
      return null;
  }
}

function ClusterGroup({ name, count, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", background: COAL, color: "#fff", border: 0, borderRadius: 4, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: ".03em" }}>{name}</span>
        <span style={{ fontSize: 12, color: GOLD }}>{count} · {open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function TaskCard({ t, canManage, busy, onStatus, onEdit, editingOpen, onDelete, editForm }) {
  const due = fmtDate(t.dueAt);
  const overdue = t.dueAt && t.status !== "DONE" && new Date(t.dueAt) < new Date(new Date().toDateString());
  const meta = [t.clientName, t.weighbridgeId, t.assignedName ? `→ ${t.assignedName}` : "Unassigned"].filter(Boolean).join(" · ");
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 5, background: (STATUS_META[t.status] || STATUS_META.OPEN).color }} />
        <div style={{ padding: 14, flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>{t.title}</span>
              {t.priority && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fff", background: PRIORITY_COLOR[t.priority] || MUTE, padding: "1px 6px", borderRadius: 3 }}>{t.priority}</span>}
            </div>
            <StatusPill status={t.status} />
          </div>
          {t.description && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.description}</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {t.project ? <b>{t.project}</b> : <span style={{ color: MUTE }}>No project</span>}{meta ? " · " + meta : ""}
            {due ? <> · <span style={{ color: overdue ? FAIL : MUTE, fontWeight: overdue ? 700 : 400 }}>due {due}{overdue ? " (overdue)" : ""}</span></> : ""}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
            <select className="input" value={t.status} disabled={busy} onChange={(e) => onStatus(e.target.value)} style={{ width: "auto", fontSize: 12, padding: "6px 8px" }}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            {canManage && (
              <>
                <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={onEdit}>{editingOpen ? "Cancel" : "Edit"}</button>
                <button className="btn" style={{ fontSize: 12, padding: "6px 10px", color: "#B03A2E" }} disabled={busy} onClick={onDelete}>Delete</button>
              </>
            )}
          </div>
          {editForm}
        </div>
      </div>
    </div>
  );
}

function TaskForm({ task, projects, clients, assignees, weighbridges, onSaved }) {
  const [f, setF] = useState(
    task
      ? { title: task.title || "", description: task.description || "", projectId: task.projectId || "", clientName: task.clientName || "", weighbridgeId: task.weighbridgeId || "", assignedEmail: task.assignedEmail || "", priority: task.priority || "", dueAt: task.dueAt ? String(task.dueAt).slice(0, 10) : "" }
      : { title: "", description: "", projectId: "", clientName: "", weighbridgeId: "", assignedEmail: "", priority: "", dueAt: "" }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setErr("");
    if (!f.title.trim()) return setErr("A task title is required.");
    setBusy(true);
    const res = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  const wbList = weighbridges.filter((w) => { const c = f.clientName.trim().toLowerCase(); return !c || (w.client || "").toLowerCase() === c; });
  const wrap = task ? { marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 } : { padding: 16, marginBottom: 14, borderColor: GOLD };

  return (
    <div className={task ? "" : "card"} style={wrap}>
      {!task && <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New task</div>}
      <L label="Title"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} spellCheck placeholder="e.g. Replace load cell #3 at Dispatch Gate" /></L>
      <L label="Description (optional)"><textarea className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} spellCheck style={{ resize: "vertical" }} /></L>
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Project">
          <select className="input" value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">— No project —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}</option>)}
          </select>
        </L>
        <L label="Company (client)">
          <input className="input" list="task-clients" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="optional" />
          <datalist id="task-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </L>
        <L label="Weighbridge">
          {wbList.length > 0 ? (
            <select className="input" value={f.weighbridgeId} onChange={(e) => set("weighbridgeId", e.target.value)}>
              <option value="">— none —</option>
              {wbList.map((w) => <option key={w.id} value={w.label}>{w.label}{w.site ? ` — ${w.site}` : ""}</option>)}
            </select>
          ) : (
            <input className="input" value={f.weighbridgeId} onChange={(e) => set("weighbridgeId", e.target.value)} placeholder="optional" />
          )}
        </L>
        <L label="Assign to">
          <select className="input" value={f.assignedEmail} onChange={(e) => set("assignedEmail", e.target.value)}>
            <option value="">— Unassigned —</option>
            {assignees.map((a) => <option key={a.id} value={a.email}>{a.name}</option>)}
          </select>
        </L>
        <L label="Priority">
          <select className="input" value={f.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="">— none —</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </L>
        <L label="Due date"><input className="input" type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} /></L>
      </div>
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <button className="btn btn-primary" onClick={save} disabled={busy} style={{ marginTop: 8 }}>{busy ? "Saving…" : task ? "Save changes" : "Create task"}</button>
    </div>
  );
}

function L({ label, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
