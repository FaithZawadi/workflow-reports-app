"use client";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

// A short, playful landing shown before sign-in. Brand-forward (coal + gold),
// lightly animated, and a single clear way in. Authenticated visitors never see
// it — middleware sends them straight to the dashboard.
const FEATURES = [
  { icon: "📋", label: "Digital inspections" },
  { icon: "⚖️", label: "ISO/IEC 17025 calibration" },
  { icon: "✅", label: "Approvals & scheduling" },
  { icon: "📄", label: "Branded PDF reports" },
];

export default function Welcome() {
  return (
    <main className="welcome">
      <div className="welcome-stripe welcome-stripe--top" aria-hidden />
      <div className="welcome-glow" aria-hidden />

      <section className="welcome-inner">
        <div className="welcome-badge">
          <span className="welcome-ring" aria-hidden />
          <span className="welcome-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="Qalibrated Systems" />
          </span>
        </div>

        {COMPANY.tagline ? <p className="welcome-tagline welcome-rise" style={{ animationDelay: "0.15s" }}>{COMPANY.tagline}</p> : null}

        <h1 className="welcome-title welcome-rise" style={{ animationDelay: "0.28s" }}>
          Weighbridge &amp; scale maintenance,
          <br />
          <span className="welcome-title-gold">done right.</span>
        </h1>

        <p className="welcome-sub welcome-rise" style={{ animationDelay: "0.42s" }}>
          Digital inspections, ISO/IEC 17025 calibration records, approvals, scheduling and
          branded reports — on the web and installable on your phone.
        </p>

        <div className="welcome-chips">
          {FEATURES.map((f, i) => (
            <span key={f.label} className="welcome-chip-pill welcome-rise" style={{ animationDelay: `${0.55 + i * 0.11}s` }}>
              <span className="welcome-chip-ic" aria-hidden>{f.icon}</span>
              {f.label}
            </span>
          ))}
        </div>

        <div className="welcome-cta welcome-rise" style={{ animationDelay: "1.05s" }}>
          <Link href="/login" className="welcome-enter">
            Enter the system <span aria-hidden>→</span>
          </Link>
          <p className="welcome-hint">Accounts are created by your QSL administrator.</p>
        </div>

        <p className="welcome-foot welcome-rise" style={{ animationDelay: "1.2s" }}>
          {COMPANY.name} · {COMPANY.accreditation}
        </p>
      </section>

      <div className="welcome-stripe welcome-stripe--bottom" aria-hidden />
    </main>
  );
}
