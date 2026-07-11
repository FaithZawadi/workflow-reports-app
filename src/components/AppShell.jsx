"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Brand } from "./ui";
import OutboxSync from "./OutboxSync";
import InstallPrompt from "./InstallPrompt";
import FeedbackPrompt from "./FeedbackPrompt";
import OfflineBadge from "./OfflineBadge";
import { ROLE_LABEL, GOLD, COAL } from "@/lib/theme";
import { canFileReports, canManageUsers, rolesOf } from "@/lib/roles";
import { COMPANY } from "@/lib/company";

export default function AppShell({ user, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const canFile = canFileReports(user);
  const isAdmin = rolesOf(user).includes("ADMIN");
  const showUsers = canManageUsers(user);

  // Bottom tab bar (mobile) — the primary destinations as a native-style bar.
  const tabs = [
    { href: "/dashboard", label: "Reports", icon: "reports", match: (p) => p.startsWith("/dashboard") || (p.startsWith("/reports") && p !== "/reports/new") },
    { href: "/schedule", label: "Schedule", icon: "schedule" },
    canFile && { href: "/reports/new", label: "New", icon: "plus", primary: true },
    showUsers && { href: "/users", label: "Users", icon: "users" },
    isAdmin && { href: "/audit", label: "Audit", icon: "audit" },
    { href: "/account", label: "Account", icon: "account" },
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
          <Link href="/weighbridges" className="btn" style={{ fontSize: 13 }}>
            Weighbridges
          </Link>
        )}
        {isAdmin && (
          <Link href="/sites" className="btn" style={{ fontSize: 13 }}>
            Sites
          </Link>
        )}
        {isAdmin && (
          <Link href="/feedback" className="btn" style={{ fontSize: 13 }}>
            Feedback
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
      <FeedbackPrompt />

      {/* Native-style bottom tab bar — shown on phones only (see globals.css) */}
      <nav className="tabbar" aria-label="Primary">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`${isActive(t) ? "active" : ""} ${t.primary ? "tab-primary" : ""}`.trim()} aria-current={isActive(t) ? "page" : undefined}>
            <span className="tab-ic" aria-hidden><TabIcon name={t.icon} /></span>
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

// Amber line icons for the bottom tab bar. Colour comes from `currentColor`
// (amber, brightening to gold when the tab is active — see globals.css).
function TabIcon({ name }) {
  const p = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (name) {
    case "reports":
      return (
        <svg {...p}>
          <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 15.5h6M9 8.5h2" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="1.6" />
          <path d="M4 9.5h16M8 3v4M16 3v4" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 6v12M6 12h12" />
        </svg>
      );
    case "users":
      return (
        <svg {...p}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6M20.5 19c0-2.2-1.2-4-3-4.6" />
        </svg>
      );
    case "audit":
      return (
        <svg {...p}>
          <rect x="5" y="4" width="14" height="17" rx="1.6" />
          <path d="M9 4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4" />
          <path d="M8.5 13.5l2.2 2.2 4.3-4.3" />
        </svg>
      );
    case "account":
      return (
        <svg {...p}>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      );
    default:
      return null;
  }
}
