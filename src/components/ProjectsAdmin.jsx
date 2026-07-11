"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, PAPER, LINE } from "@/lib/theme";

const BLANK = { name: "", clientName: "", description: "" };

export default function ProjectsAdmin() {
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/projects?manage=1");
    if (!res.ok) return setErr("Could not load projects.");
    setRows((await res.json()).projects || []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, [load]);

  const shown = (rows || []).filter((p) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [p.name, p.client, p.description].some((v) => String(v || "").toLowerCase().includes(t));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Projects</h1>
          <p className="muted">Group work by project and company. Tasks are classified under a project when created.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12 }}>
            {showAdd ? "Close" : "+ Add project"}
          </button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {showAdd && <ProjectForm clients={clients} onSaved={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search project or company…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {rows === null && <div className="muted">Loading projects…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No projects yet. Use “Add project” to register the first one.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((p) => (
          <div key={p.id} className="card" style={{ padding: 14, opacity: p.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>
                  {p.name}
                  {!p.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · archived</span>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{p.client || "All companies"}{typeof p.tasks === "number" ? ` · ${p.tasks} task${p.tasks === 1 ? "" : "s"}` : ""}</div>
                {p.description && <div className="muted" style={{ fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{p.description}</div>}
              </div>
              <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === p.id ? null : p.id)}>
                {editing === p.id ? "Cancel" : "Edit"}
              </button>
            </div>
            {editing === p.id && (
              <ProjectForm clients={clients} project={p} onSaved={() => { setEditing(null); load(); }} onDeleted={() => { setEditing(null); load(); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectForm({ clients, project, onSaved, onDeleted }) {
  const [f, setF] = useState(
    project ? { name: project.name || "", clientName: project.client || "", description: project.description || "", active: project.active } : { ...BLANK, active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("Project name is required.");
    setBusy(true);
    const res = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
      method: project ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete project ${project.name}? Its tasks are kept but un-linked.`)) return;
    setBusy(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted && onDeleted();
  };

  const wrap = project
    ? { marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 }
    : { padding: 16, marginTop: 12, borderColor: GOLD };

  return (
    <div className={project ? "" : "card"} style={wrap}>
      {!project && <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New project</div>}
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Project name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Magadi 2026 recalibration" /></L>
        <L label="Company (client) — optional">
          <input className="input" list="proj-clients" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Blank = all companies" />
          <datalist id="proj-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </L>
      </div>
      <L label="Description (optional)"><input className="input" value={f.description} onChange={(e) => set("description", e.target.value)} spellCheck /></L>
      {project && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
      )}
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : project ? "Save changes" : "Add project"}</button>
        {project && <button className="btn" onClick={remove} disabled={busy} style={{ fontSize: 13, color: "#B03A2E" }}>Delete</button>}
      </div>
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
