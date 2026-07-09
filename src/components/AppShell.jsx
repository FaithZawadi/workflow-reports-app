"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Brand } from "./ui";
import OutboxSync from "./OutboxSync";
import InstallPrompt from "./InstallPrompt";
import OfflineBadge from "./OfflineBadge";
import { ROLE_LABEL, GOLD, COAL } from "@/lib/theme";
import { canFileReports, canManageUsers } from "@/lib/roles";
import { COMPANY } from "@/lib/company";

export default function AppShell({ user, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const canFile = canFileReports(user.role);
  const isAdmin = user.role === "ADMIN";
  const showUsers = canManageUsers(user.role);

  // Bottom tab bar (mobile) — the primary destinations as a native-style bar.
  const tabs = [
    { href: "/dashboard", label: "Reports", icon: "📋", match: (p) => p.startsWith("/dashboard") || (p.startsWith("/reports") && p !== "/reports/new") },
    { href: "/schedule", label: "Schedule", icon: "🗓️" },
    canFile && { href: "/reports/new", label: "New", icon: "＋", primary: true },
    showUsers && { href: "/users", label: "Users", icon: "👥" },
    isAdmin && { href: "/audit", label: "Audit", icon: "🧾" },
    { href: "/account", label: "Account", icon: "👤" },
  ].filter(Boolean);
  const isActive = (t) => (t.match ? t.match(pathname) : pathname === t.href || pathname.startsWith(t.href + "/"));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="has-tabbar" style={{ minHeight: "100dvh" }}>
      <header className="app-header" style={{ background: COAL, color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
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
            <Link href="/account" title="My account" style={{ textAlign: "right", lineHeight: 1.2, textDecoration: "none", color: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{ROLE_LABEL[user.role] || user.role}</div>
            </Link>
            <button className="btn" onClick={logout} style={{ padding: "6px 10px", fontSize: 12 }}>
              Sign out
            </button>
          </div>
        </div>
        <OfflineBadge />
      </header>

      <nav className="wrap topnav" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 0" }}>
        <Link href="/dashboard" className="btn" style={{ fontSize: 13 }}>
          Report registry
        </Link>
        <Link href="/schedule" className="btn" style={{ fontSize: 13 }}>
          Schedule
        </Link>
        {showUsers && (
          <Link href="/users" className="btn" style={{ fontSize: 13 }}>
            Users
          </Link>
        )}
        {isAdmin && (
          <Link href="/audit" className="btn" style={{ fontSize: 13 }}>
            Audit log
          </Link>
        )}
        <Link href="/account" className="btn" style={{ fontSize: 13 }}>
          Account
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

      <OutboxSync />
      <InstallPrompt />

      {/* Native-style bottom tab bar — shown on phones only (see globals.css) */}
      <nav className="tabbar" aria-label="Primary">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`${isActive(t) ? "active" : ""} ${t.primary ? "tab-primary" : ""}`.trim()} aria-current={isActive(t) ? "page" : undefined}>
            <span className="tab-ic" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>

      <footer className="wrap" style={{ padding: "24px 16px 40px", borderTop: "3px solid var(--gold)", marginTop: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{COMPANY.name}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
          {COMPANY.address} · {COMPANY.website}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
          {COMPANY.email} · {COMPANY.phone}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
          KENAS ISO/IEC 17025 + 17020 · ILAC-MRA
        </div>
      </footer>
    </div>
  );
}
