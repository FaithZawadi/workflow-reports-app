"use client";
import { useCallback, useEffect, useState } from "react";
import { COAL, GOLD, INK, MUTE, PAPER, LINE, ROLE_LABEL } from "@/lib/theme";
import { assignableRoles } from "@/lib/roles";

export default function UsersAdmin({ profile }) {
  const roleOptions = assignableRoles(profile.role);
  const isAdmin = profile.role === "ADMIN";
  const [users, setUsers] = useState(null);
  const [allWbs, setAllWbs] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (!res.ok) {
      setErr("Could not load users.");
      return;
    }
    setUsers((await res.json()).users || []);
  }, []);

  useEffect(() => {
    load();
    if (isAdmin) {
      fetch("/api/weighbridges?manage=1").then((r) => r.json()).then((d) => setAllWbs(d.weighbridges || [])).catch(() => {});
    }
  }, [load, isAdmin]);

  const shown = (users || []).filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.name, u.email, u.role, u.client, u.site].some((v) => String(v || "").toLowerCase().includes(s));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Users &amp; access</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12 }}>
            {showAdd ? "Close" : "+ Add user"}
          </button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {showAdd && <AddUser roleOptions={roleOptions} onCreated={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search name, email, role, client…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {users === null && <div className="muted">Loading users…</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((u) => (
          <div key={u.id} className="card" style={{ padding: 14, opacity: u.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>
                  {u.name}{" "}
                  {u.id === profile.id && <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>(you)</span>}
                  {!u.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · deactivated</span>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {ROLE_LABEL[u.role] || u.role}
                  {u.client ? ` · ${u.client}` : ""}{u.site ? ` — ${u.site}` : ""}
                </div>
              </div>
              <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === u.id ? null : u.id)}>
                {editing === u.id ? "Cancel" : "Manage"}
              </button>
            </div>
            {editing === u.id && <EditUser user={u} roleOptions={roleOptions} allWbs={allWbs} isSelf={u.id === profile.id} onSaved={() => { setEditing(null); load(); }} />}
          </div>
        ))}
        {users && shown.length === 0 && <div className="muted">No users match.</div>}
      </div>
    </div>
  );
}

function AddUser({ roleOptions, onCreated }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: roleOptions[0] || "TECHNICIAN", clientName: "", site: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr("");
    if (!f.name.trim() || !f.email.trim() || !f.password) return setErr("Name, email and password are required.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not create user.");
    onCreated();
  };

  return (
    <div className="card" style={{ padding: 16, marginTop: 12, borderColor: GOLD }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New user</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Full name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
        <L label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
        <L label="Temporary password"><input className="input" type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="min 8 chars — user can change it" /></L>
        <L label="Role">
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
            {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
          </select>
        </L>
        <L label="Client / plant (technicians)"><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. TATA Chemicals Magadi" /></L>
        <L label="Site (technicians)"><input className="input" value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="e.g. Plant Gate 1" /></L>
        <L label="Phone (optional)"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
      </div>
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginTop: 6 }}>
        {busy ? "Creating…" : "Create user"}
      </button>
    </div>
  );
}

function EditUser({ user, roleOptions, allWbs = [], isSelf, onSaved }) {
  const [role, setRole] = useState(user.role);
  const [site, setSite] = useState(user.site || "");
  const [clientName, setClientName] = useState(user.client || "");
  const [wbs, setWbs] = useState(() => new Set((user.weighbridges || []).map((w) => w.id)));
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const toggleWb = (id) => setWbs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const patch = async (partial, okMsg) => {
    setBusy(true); setErr(""); setMsg("");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(partial),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error || "Could not save."); return false; }
    if (okMsg) setMsg(okMsg);
    return true;
  };

  const saveDetails = async () => {
    const payload = { role, site, clientName };
    if (allWbs.length > 0) payload.weighbridgeIds = [...wbs];
    if (await patch(payload, "Saved.")) onSaved();
  };
  const resetPw = async () => {
    if (pw.length < 8) return setErr("New password must be at least 8 characters.");
    if (await patch({ newPassword: pw }, "Password reset.")) setPw("");
  };
  const toggleActive = async () => {
    if (await patch({ active: !user.active })) onSaved();
  };

  return (
    <div style={{ marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 }}>
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
            {(roleOptions.includes(role) ? roleOptions : [role, ...roleOptions]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
          </select>
        </L>
        <L label="Client / plant"><input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} /></L>
        <L label="Site"><input className="input" value={site} onChange={(e) => setSite(e.target.value)} /></L>
      </div>
      {allWbs.length > 0 && (
        <div className="field">
          <span className="label">Assigned weighbridges ({wbs.size})</span>
          <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 4, padding: 8, background: "#fff", display: "grid", gap: 4 }}>
            {allWbs.filter((w) => w.active).map((w) => (
              <label key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={wbs.has(w.id)} onChange={() => toggleWb(w.id)} />
                <span>{w.label} <span style={{ color: MUTE }}>· {w.client}{w.site ? ` — ${w.site}` : ""}</span></span>
              </label>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>Supervisors/managers can be responsible for several weighbridges and sites.</span>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
        <L label="Reset password to" style={{ flex: "1 1 220px" }}>
          <input className="input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password (min 8)" />
        </L>
        <button className="btn" style={{ fontSize: 12 }} disabled={busy || !pw} onClick={resetPw}>Reset password</button>
      </div>
      {err && <div className="err" style={{ margin: "8px 0 0" }}>{err}</div>}
      {msg && <div style={{ color: "#2E7D46", fontWeight: 700, fontSize: 13, margin: "8px 0 0" }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" style={{ fontSize: 13 }} disabled={busy} onClick={saveDetails}>Save changes</button>
        {!isSelf && (
          <button className="btn" style={{ fontSize: 13, color: user.active ? "#B03A2E" : "#2E7D46" }} disabled={busy} onClick={toggleActive}>
            {user.active ? "Deactivate" : "Reactivate"}
          </button>
        )}
      </div>
    </div>
  );
}

function L({ label, children, style }) {
  return (
    <label className="field" style={style}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
