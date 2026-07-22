"use client";
import { useState } from "react";
import { GOLD, COAL, INK, MUTE, PASS } from "@/lib/theme";
import PasswordInput from "./PasswordInput";

// Shown after login when the user's password is due for its ~2-monthly change.
// They can change it now, or choose "Remind me later" (reappears next sign-in).
export default function PasswordPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (dismissed || done) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 8) return setErr("New password must be at least 8 characters.");
    if (next !== confirm) return setErr("New password and confirmation do not match.");
    if (next === current) return setErr("New password must be different from the current one.");
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "Could not change password."); setBusy(false); return; }
      setDone(true);
    } catch {
      setErr("Network problem. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 0, overflow: "hidden" }}>
        <div className="stripe" style={{ height: 6 }} />
        <form onSubmit={submit} style={{ padding: 22 }}>
          <div style={{ fontSize: 22 }} aria-hidden>🔒</div>
          <h2 style={{ margin: "6px 0 2px", fontSize: 20, fontWeight: 900, color: INK }}>Time to update your password</h2>
          <p style={{ margin: 0, fontSize: 13.5, color: MUTE, lineHeight: 1.5 }}>
            For security, passwords are changed every two months. Please set a new one to continue — you&apos;ll be
            reminded again in two months.
          </p>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Current password</span>
              <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">New password</span>
              <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="at least 8 characters" />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">Confirm new password</span>
              <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          </div>

          {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ flex: 1 }}>
              {busy ? "Saving…" : "Change password"}
            </button>
            <button className="btn" type="button" onClick={() => setDismissed(true)} style={{ fontSize: 13 }}>
              Remind me later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
