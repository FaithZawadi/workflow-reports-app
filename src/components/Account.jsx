"use client";
import { useState } from "react";
import PasswordInput from "./PasswordInput";
import { INK, MUTE, GOLD, ROLE_LABEL } from "@/lib/theme";

export default function Account({ profile }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (next.length < 8) return setErr("New password must be at least 8 characters.");
    if (next !== confirm) return setErr("New password and confirmation do not match.");
    setBusy(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not change password.");
    setOk("Password changed. Use it next time you sign in.");
    setCurrent(""); setNext(""); setConfirm("");
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <p className="eyebrow" style={{ marginTop: 12 }}>My account</p>
      <h1 className="h1">Account</h1>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <Row k="Name" v={profile.name} />
        <Row k="Email" v={profile.email} />
        <Row k="Role" v={ROLE_LABEL[profile.role] || profile.role} />
        {profile.clientName && <Row k="Client" v={profile.clientName} />}
        {profile.site && <Row k="Site" v={profile.site} />}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>Change password</div>
        <form onSubmit={submit}>
          <label className="field">
            <span className="label">Current password</span>
            <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">New password</span>
            <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="at least 8 characters" />
          </label>
          <label className="field">
            <span className="label">Confirm new password</span>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
          {ok && <div style={{ color: "#2E7D46", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{ok}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </form>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: MUTE }}>{k}</span>
      <span style={{ fontSize: 14, color: INK, textAlign: "right" }}>{v}</span>
    </div>
  );
}
