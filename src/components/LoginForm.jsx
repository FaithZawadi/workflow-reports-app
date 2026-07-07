"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand, Stripe } from "./ui";
import { GOLD, COAL, INK, MUTE } from "@/lib/theme";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (/access code/i.test(data.error || "")) setNeedsCode(true);
        setErr(data.error || "Could not sign in.");
        setBusy(false);
        return;
      }
      const next = params.get("next") || "/dashboard";
      router.replace(next);
    } catch {
      setErr("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <Stripe />
        <div className="paper" style={{ padding: 24 }}>
          <Brand />
          <h1 className="h1" style={{ marginTop: 16 }}>
            Sign in
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Maintenance Management System — weighbridge reports, approvals and calibration records.
          </p>

          <form onSubmit={submit} style={{ marginTop: 16 }}>
            <label className="field">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {needsCode && (
              <label className="field">
                <span className="label">Manager access code</span>
                <input
                  className="input"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Required for oversight roles"
                />
              </label>
            )}
            {err && (
              <div className="err" style={{ marginBottom: 10 }}>
                {err}
              </div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            Accounts are created by your QSL administrator. If you can&apos;t sign in, contact QSL on
            +254&nbsp;714&nbsp;999&nbsp;996.
          </p>
        </div>
        <Stripe />
      </div>
    </div>
  );
}
