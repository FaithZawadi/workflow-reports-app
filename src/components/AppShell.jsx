"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "./ui";
import { ROLE_LABEL, GOLD, COAL } from "@/lib/theme";

export default function AppShell({ user, children }) {
  const router = useRouter();
  const canFile = user.role === "TECHNICIAN" || user.role === "ENGINEER" || user.role === "ADMIN";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div style={{ minHeight: "100dvh" }}>
      <header style={{ background: COAL, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        <div className="stripe" />
        <div
          className="wrap"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", gap: 12 }}
        >
          <Link href="/dashboard" style={{ textDecoration: "none", color: "#fff" }}>
            <span style={{ color: "#fff" }}>
              <Brand small onDark />
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{ROLE_LABEL[user.role] || user.role}</div>
            </div>
            <button className="btn" onClick={logout} style={{ padding: "6px 10px", fontSize: 12 }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="wrap" style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        <Link href="/dashboard" className="btn" style={{ fontSize: 13 }}>
          Report registry
        </Link>
        <Link href="/schedule" className="btn" style={{ fontSize: 13 }}>
          Schedule
        </Link>
        {canFile && (
          <Link href="/reports/new" className="btn btn-dark" style={{ fontSize: 13 }}>
            + New report
          </Link>
        )}
      </nav>

      <main className="wrap" style={{ padding: "8px 16px 48px" }}>
        {children}
      </main>

      <footer className="wrap" style={{ padding: "24px 16px 40px", borderTop: "3px solid var(--gold)", marginTop: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--mute)" }}>
          QALIBRATED SYSTEMS LIMITED · KENAS ISO/IEC 17025 + 17020 · ILAC-MRA · info@qalibrated.co.ke · +254 714 999 996
        </div>
      </footer>
    </div>
  );
}
