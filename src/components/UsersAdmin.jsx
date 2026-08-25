"use client";
import { useCallback, useEffect, useState } from "react";
import { COAL, GOLD, INK, MUTE, PAPER, LINE, PASS, ROLE_LABEL } from "@/lib/theme";
import { assignableRoles, rolesOf } from "@/lib/roles";

const rolesOfUser = (u) => (u.roles && u.roles.length ? u.roles : u.role ? [u.role] : []);
const roleNames = (u) => rolesOfUser(u).map((r) => ROLE_LABEL[r] || r).join(", ");

// Home-organisation chip: gold for QSL, coal for an external client's staff.
function OrgBadge({ orgType, orgName }) {
  const qsl = (orgType || "QSL") !== "CLIENT";
  return (
    <span
      title={qsl ? "Qalibrated Systems staff" : `Employed by ${orgName || "a client"}`}
      style={{
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        padding: "2px 7px",
        borderRadius: 999,
        background: qsl ? GOLD : COAL,
        color: qsl ? COAL : GOLD,
      }}
    >
      {qsl ? "QSL" : orgName || "Client"}
    </span>
  );
}

// Shared Organisation (home) + Serving-client controls used by add & edit forms.
function OrgServingFields({ orgType, setOrgType, clientName, setClientName, servingClientId, setServingClientId, clients }) {
  return (
    <>
      <L label="Home organisation">
        <select className="input" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          <option value="QSL">Qalibrated Systems (internal staff)</option>
          <option value="CLIENT">A client organisation</option>
        </select>
      </L>
      {orgType === "CLIENT" ? (
        <L label="Employer (client they work for)">
          <input className="input" list="qsl-clients" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. TATA Chemicals" />
        </L>
      ) : (
        <div />
      )}
      <L label="Serving client (deployed to)">
        <select className="input" value={servingClientId || ""} onChange={(e) => setServingClientId(e.target.value)}>
          <option value="">— none / internal —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </L>
      <datalist id="qsl-clients">
        {clients.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
    </>
  );
}

// A checkbox group for picking one or more roles.
function RolePicker({ options, value, onChange }) {
  const toggle = (r) => {
    const has = value.includes(r);
    onChange(has ? value.filter((x) => x !== r) : [...value, r]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((r) => {
        const on = value.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid",
              borderColor: on ? COAL : LINE,
              background: on ? COAL : "#fff",
              color: on ? GOLD : INK,
              cursor: "pointer",
            }}
          >
            {on ? "✓ " : ""}{ROLE_LABEL[r] || r}
          </button>
        );
      })}
    </div>
  );
}

export default function UsersAdmin({ profile }) {
  const roleOptions = assignableRoles(profile);
  const isAdmin = rolesOf(profile).includes("ADMIN");
  const [users, setUsers] = useState(null);
  const [allWbs, setAllWbs] = useState([]);
  const [clients, setClients] = useState([]);
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
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    if (isAdmin) {
      fetch("/api/weighbridges?manage=1").then((r) => r.json()).then((d) => setAllWbs(d.weighbridges || [])).catch(() => {});
    }
  }, [load, isAdmin]);

  const shown = (users || []).filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.name, u.email, roleNames(u), u.client, u.orgName, u.servingClient, u.site].some((v) => String(v || "").toLowerCase().includes(s));
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
      {showAdd && <AddUser roleOptions={roleOptions} clients={clients} onCreated={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search name, email, role, client…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {users === null && <div className="muted">Loading users…</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((u) => (
          <div key={u.id} className="card" style={{ padding: 14, opacity: u.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>{u.name}</span>
                  <OrgBadge orgType={u.orgType} orgName={u.orgName || u.client} />
                  {u.id === profile.id && <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>(you)</span>}
                  {!u.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}>· deactivated</span>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {roleNames(u)}
                  {u.servingClient ? <> · <span style={{ color: "#8a6d00", fontWeight: 700 }}>serving {u.servingClient}</span></> : ""}
                  {u.site ? ` — ${u.site}` : ""}
                </div>
              </div>
              <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === u.id ? null : u.id)}>
                {editing === u.id ? "Cancel" : "Manage"}
              </button>
            </div>
            {editing === u.id && <EditUser user={u} roleOptions={roleOptions} allWbs={allWbs} clients={clients} isSelf={u.id === profile.id} onSaved={() => { setEditing(null); load(); }} />}
          </div>
        ))}
        {users && shown.length === 0 && <div className="muted">No users match.</div>}
      </div>
    </div>
  );
}

function AddUser({ roleOptions, clients = [], onCreated }) {
  const [f, setF] = useState({ name: "", email: "", password: "", roles: [roleOptions[0] || "TECHNICIAN"], orgType: "QSL", clientName: "", servingClientId: "", site: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { email, tempPassword, emailed }
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr("");
    if (!f.name.trim() || !f.email.trim()) return setErr("Name and email are required.");
    if (f.password && f.password.length < 8) return setErr("If you set a password it must be at least 8 characters.");
    if (!f.roles.length) return setErr("Choose at least one role.");
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "Could not create user.");
    setResult({ email: f.email.trim(), tempPassword: d.tempPassword, emailed: d.emailed });
  };

  // Success panel — shows the temp password and whether the invitation was emailed.
  if (result) {
    return (
      <div className="card" style={{ padding: 16, marginTop: 12, borderColor: PASS }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: INK }}>✓ {result.email} invited</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {result.emailed
            ? "An invitation email was sent with the temporary password. They'll be asked to set their own password on first sign-in."
            : "Email is not configured, so share the temporary password below with them directly. They'll be asked to set their own password on first sign-in."}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Temporary password</span>
          <code style={{ fontSize: 15, fontWeight: 800, background: "#F3EFE6", padding: "6px 12px", borderRadius: 8, letterSpacing: 0.5 }}>{result.tempPassword}</code>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => navigator.clipboard?.writeText(result.tempPassword)}>Copy</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => { setResult(null); setF({ name: "", email: "", password: "", roles: [roleOptions[0] || "TECHNICIAN"], orgType: "QSL", clientName: "", servingClientId: "", site: "", phone: "" }); }}>Invite another</button>
          <button className="btn" onClick={onCreated}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 12, borderColor: GOLD }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>Invite user</div>
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Full name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
        <L label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
        <L label="Temporary password (optional)"><input className="input" type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="leave blank to auto-generate" /></L>
        <L label="Roles (choose one or more)">
          <RolePicker options={roleOptions} value={f.roles} onChange={(v) => set("roles", v)} />
        </L>
        <OrgServingFields
          orgType={f.orgType}
          setOrgType={(v) => set("orgType", v)}
          clientName={f.clientName}
          setClientName={(v) => set("clientName", v)}
          servingClientId={f.servingClientId}
          setServingClientId={(v) => set("servingClientId", v)}
          clients={clients}
        />
        <L label="Site (e.g. plant gate)"><input className="input" value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="e.g. Plant Gate 1" /></L>
        <L label="Phone (optional)"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>An invitation email is sent with a temporary password. The user must set their own password on first sign-in.</p>
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginTop: 6 }}>
        {busy ? "Inviting…" : "Send invitation"}
      </button>
    </div>
  );
}

function EditUser({ user, roleOptions, allWbs = [], clients = [], isSelf, onSaved }) {
  const [roles, setRoles] = useState(rolesOfUser(user));
  const [site, setSite] = useState(user.site || "");
  const [orgType, setOrgType] = useState(user.orgType || "QSL");
  const [clientName, setClientName] = useState(user.client || "");
  const [servingClientId, setServingClientId] = useState(user.servingClientId || "");
  const [wbs, setWbs] = useState(() => new Set((user.weighbridges || []).map((w) => w.id)));
  const [assigned, setAssigned] = useState(() => new Set(user.assignedClientIds || []));
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const toggleWb = (id) => setWbs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleClient = (id) => setAssigned((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
    if (!roles.length) { setErr("A user must have at least one role."); return; }
    const payload = { roles, site, orgType, clientName, servingClientId, assignedClientIds: [...assigned] };
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
        <L label="Roles (choose one or more)">
          {isSelf ? (
            <div className="muted" style={{ fontSize: 13 }}>{roles.map((r) => ROLE_LABEL[r] || r).join(", ")} <span style={{ color: MUTE }}>· you can&apos;t change your own role</span></div>
          ) : (
            <RolePicker options={[...new Set([...roleOptions, ...roles])]} value={roles} onChange={setRoles} />
          )}
        </L>
        <OrgServingFields
          orgType={orgType}
          setOrgType={setOrgType}
          clientName={clientName}
          setClientName={setClientName}
          servingClientId={servingClientId}
          setServingClientId={setServingClientId}
          clients={clients}
        />
        <L label="Site"><input className="input" value={site} onChange={(e) => setSite(e.target.value)} /></L>
      </div>
      {clients.length > 0 && (
        <div className="field">
          <span className="label">Assigned clients ({assigned.size}) — which clients this person may file reports for</span>
          <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 4, padding: 8, background: "#fff", display: "grid", gap: 4 }}>
            {clients.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={assigned.has(c.id)} onChange={() => toggleClient(c.id)} />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>Tick every client this technician works for. They pick one when filing a report (any template). Leave empty to fall back to their serving client / weighbridges.</span>
        </div>
      )}
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
