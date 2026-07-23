"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Brand } from "./ui";
import OutboxSync from "./OutboxSync";
import InstallPrompt from "./InstallPrompt";
import FeedbackPrompt from "./FeedbackPrompt";
import NotificationBell from "./NotificationBell";
import OfflineBadge from "./OfflineBadge";
import PasswordPrompt from "./PasswordPrompt";
import { ROLE_LABEL } from "@/lib/theme";
import { canFileReports, canManageUsers, canManageTasks, canPrepareQuotes, canManageTraining, canManageWeighbridges, canManageProjects, canSeeQuotations, isClientOnly, rolesOf } from "@/lib/roles";
import { COMPANY } from "@/lib/company";

export default function AppShell({ user, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const canFile = canFileReports(user);
  const roles = rolesOf(user);
  const isAdmin = roles.includes("ADMIN");
  const showUsers = canManageUsers(user);
  const clientOnly = isClientOnly(user);
  const showTraining = canManageTraining(user);
  // Only managers/admin own projects, contracts and customer feedback.
  const showProjects = canManageProjects(user);
  // Equipment Users may register weighbridges (admins too).
  const showWeighbridges = canManageWeighbridges(user);
  // PM / TM / admin manage quotations + calibration; clients and Equipment Users
  // get a scoped read-only view. Everyone else sees neither.
  const showQuotes = canSeeQuotations(user) || isAdmin;
  // The dashboard (charts) is the landing page for everyone.
  const homeHref = "/overview";

  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [menuOpen, setMenuOpen] = useState(false); // profile dropdown
  const [collapsed, setCollapsed] = useState(false); // desktop icon-rail
  const menuRef = useRef(null);

  // Restore the collapsed preference (desktop icon rail) after mount.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("qsl:navCollapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const nv = !v;
      try { localStorage.setItem("qsl:navCollapsed", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };

  // Close the profile menu on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Primary sidebar destinations (Account lives in the profile menu now).
  const nav = clientOnly
    ? [
        { href: "/overview", label: "Dashboard", icon: "dashboard" },
        { href: "/calibration-requests", label: "Calibration requests", icon: "gauge" },
        { href: "/quotations", label: "Quotations", icon: "quote" },
      ]
    : [
        { href: "/overview", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard", label: "Report registry", icon: "reports" },
        { href: "/schedule", label: "Schedule", icon: "schedule" },
        { href: "/tasks", label: "Tasks", icon: "tasks" },
        showQuotes && { href: "/quotations", label: "Quotations", icon: "quote" },
        showQuotes && { href: "/calibration-requests", label: "Calibration requests", icon: "gauge" },
        showProjects && { href: "/projects", label: "Projects", icon: "projects" },
        showProjects && { href: "/contracts", label: "Contracts", icon: "contract" },
        showProjects && { href: "/customer-feedback", label: "Customer feedback", icon: "chat" },
        showTraining && { href: "/training-feedback", label: "Training feedback", icon: "training" },
        showUsers && { href: "/users", label: "Users", icon: "users" },
        showWeighbridges && { href: "/weighbridges", label: "Weighbridges", icon: "scale" },
        isAdmin && { href: "/sites", label: "Sites", icon: "pin" },
        isAdmin && { href: "/feedback", label: "Feedback", icon: "star" },
        isAdmin && { href: "/audit", label: "Audit log", icon: "audit" },
      ].filter(Boolean);

  // Bottom tab bar (mobile) — the primary destinations as a native-style bar.
  const tabs = clientOnly
    ? [
        { href: "/calibration-requests", label: "Calibration", icon: "reports", match: (p) => p.startsWith("/calibration-requests") },
        { href: "/quotations", label: "Quotes", icon: "schedule", match: (p) => p.startsWith("/quotations") },
        { href: "/account", label: "Account", icon: "account" },
      ]
    : [
        { href: "/overview", label: "Dashboard", icon: "dashboard", match: (p) => p.startsWith("/overview") },
        { href: "/dashboard", label: "Reports", icon: "reports", match: (p) => p.startsWith("/dashboard") || (p.startsWith("/reports") && p !== "/reports/new") },
        canFile && { href: "/reports/new", label: "New", icon: "plus", primary: true },
        { href: "/schedule", label: "Schedule", icon: "schedule" },
        { href: "/account", label: "Account", icon: "account" },
      ].filter(Boolean);

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");
  const isTabActive = (t) => (t.match ? t.match(pathname) : pathname === t.href || pathname.startsWith(t.href + "/"));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="has-tabbar app-body" style={{ minHeight: "100dvh" }}>
      {user.passwordDue && <PasswordPrompt />}
      {/* ---- Sidebar ---- */}
      <aside className={`sidebar${navOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`} aria-label="Primary navigation">
        <div className="stripe" />
        <div className="sidebar-brand">
          <Link href={homeHref} onClick={() => setNavOpen(false)} className="brand-link" style={{ textDecoration: "none", color: "#fff" }} title={COMPANY.name}>
            <span className="brand-mark" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mark.svg" alt="" width={22} height={22} style={{ display: "block" }} />
            </span>
            <span className="brand-text">QALIBRATED <b style={{ color: "var(--gold)", letterSpacing: ".08em" }}>SYSTEMS</b></span>
          </Link>
          <button className="collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`side-link${isActive(item.href) ? " active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
              title={item.label}
            >
              <span className="side-ic" aria-hidden><NavIcon name={item.icon} /></span>
              <span className="side-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {canFile && (
          <div className="sidebar-cta">
            <Link href="/reports/new" className="btn btn-primary" title="New report" style={{ width: "100%", justifyContent: "center", display: "flex", fontSize: 13 }}>
              <span className="cta-full">+ New report</span>
              <span className="cta-mini" aria-hidden>+</span>
            </Link>
          </div>
        )}

        <div className="sidebar-foot">
          <div style={{ fontWeight: 800, fontSize: 12 }}>{COMPANY.name}</div>
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>KENAS ISO/IEC 17025 + 17020</div>
        </div>
      </aside>

      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden />}

      {/* ---- Main column ---- */}
      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          {pathname !== homeHref && (
            <button className="icon-btn" aria-label="Go back" title="Back" onClick={() => router.back()}>
              <NavIcon name="back" />
            </button>
          )}
          <button className="icon-btn" aria-label="Refresh this page" title="Refresh" onClick={() => window.location.reload()}>
            <NavIcon name="refresh" />
          </button>
          <div className="topbar-brand">
            <Link href={homeHref} style={{ textDecoration: "none" }}><Brand small /></Link>
          </div>
          <div style={{ flex: 1 }} />
          {canFile && (
            <Link href="/reports/new" className="btn btn-primary newreport-btn" title="File a new report">
              <span aria-hidden style={{ fontWeight: 900, fontSize: 16, lineHeight: 1 }}>+</span>
              <span className="newreport-label">New report</span>
            </Link>
          )}
          <NotificationBell />
          <div className="profile-menu" ref={menuRef}>
            <button className="profile-trigger" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
              <span className="avatar" aria-hidden>{initials(user.name)}</span>
              <span className="profile-text">
                <span className="profile-name">{user.name}</span>
                <span className="profile-role">{ROLE_LABEL[user.role] || user.role}</span>
              </span>
              <svg className="caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>

            {menuOpen && (
              <div className="profile-pop" role="menu">
                <div className="profile-pop-head">
                  <span className="avatar lg" aria-hidden>{initials(user.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{user.name}</div>
                    {user.email && <div style={{ fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>}
                  </div>
                </div>
                <div className="profile-pop-roles">
                  {roles.map((r) => (
                    <span key={r} className="role-chip">{ROLE_LABEL[r] || r}</span>
                  ))}
                </div>
                <Link href="/account" className="profile-pop-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <NavIcon name="account" /> <span>View profile &amp; account</span>
                </Link>
                <button className="profile-pop-item danger" role="menuitem" onClick={logout}>
                  <NavIcon name="logout" /> <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
          <button className="btn signout-btn" onClick={logout} style={{ padding: "6px 12px", fontSize: 12 }}>Sign out</button>
        </header>
        <OfflineBadge />

        <main className="app-content">{children}</main>

        <footer className="wrap" style={{ padding: "24px 4px 40px", borderTop: "3px solid var(--gold)", marginTop: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{COMPANY.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>{COMPANY.address} · {COMPANY.website}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>{COMPANY.email} · {COMPANY.phone}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>KENAS ISO/IEC 17025 + 17020 · ILAC-MRA</div>
        </footer>
      </div>

      <OutboxSync />
      <InstallPrompt />
      <FeedbackPrompt />

      {/* Native-style bottom tab bar — shown on phones only (see globals.css) */}
      <nav className="tabbar" aria-label="Primary">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`${isTabActive(t) ? "active" : ""} ${t.primary ? "tab-primary" : ""}`.trim()} aria-current={isTabActive(t) ? "page" : undefined}>
            <span className="tab-ic" aria-hidden><NavIcon name={t.icon} /></span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Amber/line icons for the sidebar + tab bar. Colour comes from `currentColor`.
function NavIcon({ name }) {
  const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "dashboard":
      return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="11" width="7" height="10" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></svg>);
    case "reports":
      return (<svg {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 15.5h6M9 8.5h2" /></svg>);
    case "schedule":
      return (<svg {...p}><rect x="4" y="5" width="16" height="16" rx="1.6" /><path d="M4 9.5h16M8 3v4M16 3v4" /></svg>);
    case "tasks":
      return (<svg {...p}><path d="M4 6h9M4 12h9M4 18h9" /><path d="M16.5 6l1.5 1.5L21 4M16.5 12l1.5 1.5L21 10M16.5 18l1.5 1.5L21 16" /></svg>);
    case "quote":
      return (<svg {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M12 10.5c-1.2 0-2 .6-2 1.5s.8 1.2 2 1.5 2 .6 2 1.5-.8 1.5-2 1.5M12 9.5v1M12 16v1" /></svg>);
    case "gauge":
      return (<svg {...p}><path d="M4 15a8 8 0 0 1 16 0" /><path d="M12 15l4-3" /><circle cx="12" cy="15" r="1" /></svg>);
    case "projects":
      return (<svg {...p}><path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>);
    case "contract":
      return (<svg {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M9 13l1.5 1.5L14 11" /></svg>);
    case "chat":
      return (<svg {...p}><path d="M4 5h16v11H9l-4 3v-3H4z" /><path d="M8 9h8M8 12h5" /></svg>);
    case "training":
      return (<svg {...p}><path d="M12 4l9 4-9 4-9-4 9-4z" /><path d="M6 10v4c0 1.5 3 2.5 6 2.5s6-1 6-2.5v-4" /><path d="M21 8v5" /></svg>);
    case "users":
      return (<svg {...p}><circle cx="9" cy="9" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 6.2a3 3 0 0 1 0 5.6M20.5 19c0-2.2-1.2-4-3-4.6" /></svg>);
    case "scale":
      return (<svg {...p}><path d="M12 4v16M6 20h12" /><path d="M12 6l-6 2 3 5a3 3 0 0 1-6 0l3-5M12 6l6 2-3 5a3 3 0 0 0 6 0l-3-5" /></svg>);
    case "pin":
      return (<svg {...p}><path d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>);
    case "star":
      return (<svg {...p}><path d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.9 7.4 18.3l.9-5.1L4.5 9.5l5.2-.8z" /></svg>);
    case "audit":
      return (<svg {...p}><rect x="5" y="4" width="14" height="17" rx="1.6" /><path d="M9 4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4" /><path d="M8.5 13.5l2.2 2.2 4.3-4.3" /></svg>);
    case "account":
      return (<svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>);
    case "logout":
      return (<svg {...p}><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" /><path d="M10 12H3M6 8l-3 4 3 4" /></svg>);
    case "plus":
      return (<svg {...p}><path d="M12 6v12M6 12h12" /></svg>);
    case "back":
      return (<svg {...p}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>);
    case "refresh":
      return (<svg {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
    default:
      return null;
  }
}
