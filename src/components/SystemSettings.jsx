"use client";
import { useEffect, useState } from "react";
import { PaperCard, SectionBar, Field, Textarea } from "./ui";
import { PASS, FAIL, WAIT, MUTE, GOLD, COAL, INK } from "@/lib/theme";

// Admin System Settings — every application-wide switch in one place, grouped
// into four tabs. Each tab saves its own group so one edit never disturbs
// another. Values are read live by reports, quotations, emails and approvals.
const TABS = [
  { k: "company", label: "Company & branding" },
  { k: "finance", label: "Quotations & finance" },
  { k: "reports", label: "Reports & site checks" },
  { k: "workflow", label: "Workflow & notifications" },
];

function Toggle({ label, hint, on, onChange }) {
  return (
    <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #efe9db", cursor: "pointer" }}>
      <button
        type="button"
        role="switch"
        aria-checked={!!on}
        onClick={() => onChange(!on)}
        style={{
          flex: "0 0 auto", width: 44, height: 26, borderRadius: 999, border: "1px solid",
          borderColor: on ? COAL : "#cfc8ba", background: on ? COAL : "#efe9db",
          position: "relative", transition: "background .15s", marginTop: 2, cursor: "pointer",
        }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: on ? GOLD : "#fff", transition: "left .15s" }} />
      </button>
      <span>
        <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 12, color: MUTE, marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
}

export default function SystemSettings() {
  const [tab, setTab] = useState("company");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || null))
      .catch(() => setMsg({ ok: false, text: "Could not load settings." }))
      .finally(() => setLoading(false));
  }, []);

  const set = (group, key, value) =>
    setSettings((s) => ({ ...s, [group]: { ...s[group], [key]: value } }));

  const save = async (group) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [group]: settings[group] }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || "Could not save." });
      } else {
        setSettings(d.settings);
        setMsg({ ok: true, text: "Saved." });
      }
    } catch {
      setMsg({ ok: false, text: "Network problem — please try again." });
    }
    setBusy(false);
  };

  if (loading) return <PaperCard><p className="muted">Loading settings…</p></PaperCard>;
  if (!settings) return <PaperCard><p style={{ color: FAIL }}>{msg?.text || "Settings unavailable."}</p></PaperCard>;

  const c = settings.company, f = settings.finance, r = settings.reports, w = settings.workflow;

  return (
    <div>
      <PaperCard>
        <p className="eyebrow">Administration</p>
        <h1 className="h1">System settings</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          Application-wide controls. Changes take effect immediately across reports, quotations, PDFs, emails and approvals.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "14px 0 4px" }}>
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => { setTab(t.k); setMsg(null); }}
              style={{
                fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 2, border: "1px solid",
                borderColor: tab === t.k ? COAL : "#cfc8ba",
                background: tab === t.k ? COAL : "#fff",
                color: tab === t.k ? GOLD : INK, cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PaperCard>

      <PaperCard>
        {tab === "company" && (
          <div>
            <SectionBar>Company & branding</SectionBar>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Shown on report and quotation PDFs and in outgoing emails.
            </p>
            <div className="grid md-2">
              <Field label="Company name" value={c.name} onChange={(v) => set("company", "name", v)} />
              <Field label="Tagline" value={c.tagline} onChange={(v) => set("company", "tagline", v)} />
            </div>
            <Field label="Postal / physical address" value={c.postal} onChange={(v) => set("company", "postal", v)} />
            <div className="grid md-2">
              <Field label="City / area" value={c.address} onChange={(v) => set("company", "address", v)} />
              <Field label="KRA PIN" value={c.pin} onChange={(v) => set("company", "pin", v)} />
            </div>
            <div className="grid md-2">
              <Field label="Email" type="email" value={c.email} onChange={(v) => set("company", "email", v)} />
              <Field label="Phone" value={c.phone} onChange={(v) => set("company", "phone", v)} />
            </div>
            <Field label="Website" value={c.website} onChange={(v) => set("company", "website", v)} />
            <SaveRow group="company" />
          </div>
        )}

        {tab === "finance" && (
          <div>
            <SectionBar>Quotations & finance</SectionBar>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Defaults applied to new quotations (each quote can still override them).
            </p>
            <div className="grid md-2">
              <Field label="Default currency" value={f.currency} onChange={(v) => set("finance", "currency", v)} placeholder="KES" />
              <Field label="Default VAT %" type="number" value={f.vatRate} onChange={(v) => set("finance", "vatRate", v)} />
            </div>
            <div className="grid md-2">
              <Field label="Quote validity (days)" type="number" value={f.quoteValidityDays} onChange={(v) => set("finance", "quoteValidityDays", v)} />
              <Field label="Quotation number prefix" value={f.quotePrefix} onChange={(v) => set("finance", "quotePrefix", v)} placeholder="Q" />
            </div>
            <Textarea label="Default payment details (printed on quotations)" rows={5} value={f.paymentDetails} onChange={(v) => set("finance", "paymentDetails", v)} />
            <Textarea label="Default terms of sale" rows={3} value={f.quoteTerms} onChange={(v) => set("finance", "quoteTerms", v)} />
            <SaveRow group="finance" />
          </div>
        )}

        {tab === "reports" && (
          <div>
            <SectionBar>Reports & site checks</SectionBar>
            <Toggle label="Require at least one photo" hint="Reports can't be submitted without a site photo." on={r.requirePhotos} onChange={(v) => set("reports", "requirePhotos", v)} />
            <Toggle label="Require on-site filing (geofence)" hint="Reject a report filed outside the site's fence, or with no location captured." on={r.requireOnSite} onChange={(v) => set("reports", "requireOnSite", v)} />
            <div style={{ marginTop: 12, maxWidth: 260 }}>
              <Field label="Default geofence radius (metres)" type="number" value={r.defaultGeofenceRadius} onChange={(v) => set("reports", "defaultGeofenceRadius", v)} />
              <p className="muted" style={{ fontSize: 12 }}>Used when a site has no radius of its own.</p>
            </div>
            <SaveRow group="reports" />
          </div>
        )}

        {tab === "workflow" && (
          <div>
            <SectionBar>Workflow & notifications</SectionBar>
            <Toggle label="New clients need approval" hint="Clients a technician registers stay pending until a manager approves them. Off = auto-approved." on={w.clientApprovalRequired} onChange={(v) => set("workflow", "clientApprovalRequired", v)} />
            <Toggle label="Send email notifications" hint="Master switch for all outgoing email (report reviews, quotes, approvals). SMTP must also be configured." on={w.emailEnabled} onChange={(v) => set("workflow", "emailEnabled", v)} />
            <div className="grid md-2" style={{ marginTop: 12 }}>
              <Field label="Escalate overdue after (days)" type="number" value={w.escalateAfterDays} onChange={(v) => set("workflow", "escalateAfterDays", v)} />
              <Field label="Contract reminder days" value={w.contractReminderDays} onChange={(v) => set("workflow", "contractReminderDays", v)} placeholder="30,14,7,1" />
              <Field label="Quote follow-up after (days)" type="number" value={w.quoteFollowupDays} onChange={(v) => set("workflow", "quoteFollowupDays", v)} />
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Reminder days are days-before-expiry, comma-separated. Quote follow-up nudges the preparer to record accepted/declined after that many days (0 = off).</p>
            <SaveRow group="workflow" />
          </div>
        )}
      </PaperCard>
    </div>
  );

  function SaveRow({ group }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => save(group)} disabled={busy} style={{ padding: "11px 22px" }}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? PASS : FAIL }}>{msg.text}</span>}
        {!msg && <span style={{ fontSize: 12, color: WAIT }}>Takes effect immediately.</span>}
      </div>
    );
  }
}
