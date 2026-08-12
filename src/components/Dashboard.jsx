"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatTile, Donut, BarList, TrendArea, Gauge } from "./charts";
import { Pill } from "./ui";
import { ROLE_LABEL, COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// Compact money for KPI tiles: 1.2M / 340k / 900.
const money = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return v.toLocaleString();
};

const MEDAL = ["#D4AF37", "#B8B8B8", "#CD7F32"];

// Staff merit leaderboard — a ranked score bar with the contributing counts.
function MeritBoard({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.score || 0));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 900, textAlign: "center", color: MEDAL[i] || "#b6ab93", fontFamily: "var(--mono)" }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: INK, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              <b style={{ flexShrink: 0, color: COAL }}>{r.score}</b>
            </div>
            <div style={{ height: 7, background: "#F0EADD", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (r.score / max) * 100)}%`, height: "100%", background: i < 3 ? GOLD : COAL, borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>
              {r.filed} filed · {r.approved} approved{r.approvals ? ` · ${r.approvals} sign-offs` : ""}{r.photos ? ` · ${r.photos} photos` : ""}{r.rejections ? ` · ${r.rejections} returned` : ""}
            </div>
          </div>
          <span aria-hidden style={{ fontSize: 16 }}>{i === 0 ? "🏆" : i < 3 ? "🎖" : ""}</span>
        </div>
      ))}
    </div>
  );
}

const Card = ({ title, action, children, span }) => (
  <div className="card" style={{ padding: 16, gridColumn: span ? `span ${span}` : undefined }}>
    {title && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: INK }}>{title}</div>
        {action}
      </div>
    )}
    {children}
  </div>
);

// A small labelled metric for the quality strip.
const Mini = ({ label, value, sub, color }) => (
  <div style={{ flex: "1 1 120px", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: MUTE }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: color || INK, marginTop: 3, lineHeight: 1 }}>{value}</div>
    {sub ? <div style={{ fontSize: 11.5, color: MUTE, marginTop: 4 }}>{sub}</div> : null}
  </div>
);

export default function Dashboard({ profile }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return setErr("Could not load dashboard.");
      setD(await res.json());
      setUpdatedAt(Date.now());
    } catch {
      setErr("Could not load dashboard.");
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (err) return <div className="err" style={{ marginTop: 16 }}>{err}</div>;
  if (!d) return <div className="muted" style={{ marginTop: 24 }}>Loading dashboard…</div>;

  const roles = profile?.roles?.length ? profile.roles : [profile?.role].filter(Boolean);
  const isAdmin = roles.includes("ADMIN");
  const isClient = d.isClient;
  const isReviewer = roles.some((r) => ["SUPERVISOR", "MANAGER"].includes(r));
  const canFile = !isClient && roles.some((r) => ["TECHNICIAN", "ENGINEER", "SUPERVISOR", "MANAGER", "ADMIN"].includes(r));

  const s = d.reportsByStatus;
  const pending = (s.PENDING_SUPERVISOR || 0) + (s.PENDING_MANAGER || 0);
  const statusSegments = [
    { label: "Supervisor review", value: s.PENDING_SUPERVISOR || 0, color: "#C79A2E", href: "/dashboard?status=PENDING_SUPERVISOR" },
    { label: "Manager approval", value: s.PENDING_MANAGER || 0, color: GOLD, href: "/dashboard?status=PENDING_MANAGER" },
    { label: "Approved", value: s.APPROVED || 0, color: PASS, href: "/dashboard?status=APPROVED" },
    { label: "Rejected", value: s.REJECTED || 0, color: FAIL, href: "/dashboard?status=REJECTED" },
  ].filter((x) => x.value > 0);

  // Role-specific KPI tiles.
  const tiles = [];
  if (d.awaitingMe > 0) tiles.push(<StatTile key="await" label="Awaiting you" value={d.awaitingMe} tone="wait" icon="⏳" sub="to review / approve" href="/dashboard?status=PENDING_SUPERVISOR" />);
  if (!isClient) tiles.push(<StatTile key="total" label={isReviewer ? "Reports in scope" : "Total reports"} value={d.totalReports} icon="📄" href="/dashboard" />);
  if (!isClient) tiles.push(<StatTile key="appr" label="Approved" value={s.APPROVED || 0} tone="pass" icon="✓" href="/dashboard?status=APPROVED" />);
  if (!isClient) tiles.push(<StatTile key="pend" label="Pending" value={pending} tone="wait" icon="•" href="/dashboard?status=PENDING_SUPERVISOR" />);
  if (!isClient && d.approvalRate != null) tiles.push(<StatTile key="rate" label="Approval rate" value={`${d.approvalRate}%`} tone="pass" icon="📈" sub={`${d.reportsThisWeek || 0} filed this week`} />);
  if (d.activeWeighbridges != null) tiles.push(<StatTile key="wb" label="Active weighbridges" value={d.activeWeighbridges} icon="⚖" href="/weighbridges" />);
  if (d.schedulesDue != null) tiles.push(<StatTile key="due" label="Due in 7 days" value={d.schedulesDue} tone={d.schedulesDue > 0 ? "wait" : "ink"} icon="🗓" sub="maintenance" href="/schedule" />);
  if (d.satisfaction) tiles.push(<StatTile key="sat" label="Satisfaction" value={d.satisfaction.average ? `${d.satisfaction.average}/5` : "—"} tone="gold" icon="★" sub={`${d.satisfaction.count} surveys`} />);
  if (d.quotations) tiles.push(<StatTile key="q" label="Quotes accepted" value={d.quotations.ACCEPTED || 0} tone="pass" icon="💷" href="/quotations" />);
  if (isClient && d.calibrationRequests) tiles.push(<StatTile key="cr" label="Calibration requests" value={Object.values(d.calibrationRequests).reduce((a, b) => a + b, 0)} icon="🛠" href="/calibration-requests" />);

  const rel = updatedAt ? `updated ${Math.max(1, Math.round((Date.now() - updatedAt) / 1000))}s ago` : "";

  return (
    <div style={{ marginTop: 12 }}>
      {/* Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">{ROLE_LABEL[d.role] || d.role}</p>
          <h1 className="h1">{greeting()}, {(d.name || "").split(" ")[0]}</h1>
          <p className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: PASS, display: "inline-block" }} />
            Live overview · {rel}
          </p>
        </div>
        {canFile && (
          <Link href="/reports/new" className="btn btn-primary" style={{ textDecoration: "none", fontWeight: 800 }}>+ New report</Link>
        )}
      </div>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 14 }}>
        {tiles}
      </div>

      {/* Quality / volume strip (non-client) */}
      {!isClient && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <Mini label="This week" value={d.reportsThisWeek ?? 0} sub="reports filed" />
          <Mini label="This month" value={d.reportsThisMonth ?? 0} sub="reports filed" />
          <Mini label="Approval rate" value={`${d.approvalRate ?? 0}%`} sub={`${s.APPROVED || 0} of ${d.totalReports}`} color={PASS} />
          <Mini label="Pending review" value={pending} sub="awaiting sign-off" color={pending ? WAIT : INK} />
          {s.REJECTED ? <Mini label="Returned" value={s.REJECTED} sub="need rework" color={FAIL} /> : null}
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 12 }}>
        {!isClient && (
          <Card title="Reports · last 14 days" span={2}>
            <TrendArea points={d.reportsTrend} />
          </Card>
        )}
        {!isClient && statusSegments.length > 0 && (
          <Card title="Report status">
            <Donut segments={statusSegments} centerLabel="reports" />
          </Card>
        )}
        {!isClient && d.reportsByTemplate.length > 0 && (
          <Card title="By form type" action={<span style={{ fontSize: 11, color: MUTE }}>tap to filter</span>}>
            <BarList items={d.reportsByTemplate.map((t) => ({ label: t.name, value: t.count, href: `/dashboard?template=${t.code}` }))} />
          </Card>
        )}

        {d.quotations && Object.values(d.quotations).some((v) => v > 0) && (
          <Card title="Quotations" action={<Link href="/quotations" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: "none" }}>Open →</Link>}>
            <Donut
              centerLabel="quotes"
              segments={[
                { label: "Requested", value: d.quotations.REQUESTED || 0, color: WAIT, href: "/quotations" },
                { label: "Quoted", value: d.quotations.QUOTED || 0, color: COAL, href: "/quotations" },
                { label: "Accepted", value: d.quotations.ACCEPTED || 0, color: PASS, href: "/quotations" },
                { label: "Declined", value: d.quotations.DECLINED || 0, color: FAIL, href: "/quotations" },
              ].filter((x) => x.value > 0)}
            />
          </Card>
        )}
        {d.calibrationRequests && Object.values(d.calibrationRequests).some((v) => v > 0) && (
          <Card title="Calibration requests" action={<Link href="/calibration-requests" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: "none" }}>Open →</Link>}>
            <BarList
              items={[
                { label: "Submitted", value: d.calibrationRequests.SUBMITTED || 0, color: WAIT, href: "/calibration-requests" },
                { label: "Accepted", value: d.calibrationRequests.ACCEPTED || 0, color: PASS, href: "/calibration-requests" },
                { label: "Not accepted", value: d.calibrationRequests.REJECTED || 0, color: FAIL, href: "/calibration-requests" },
              ]}
            />
          </Card>
        )}
        {d.satisfaction && d.satisfaction.count > 0 && (
          <Card title="Customer satisfaction">
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Gauge value={d.satisfaction.average} max={5} label={`${d.satisfaction.count} survey${d.satisfaction.count === 1 ? "" : "s"}`} />
            </div>
          </Card>
        )}
      </div>

      {/* Admin: business at a glance + staff merits */}
      {isAdmin && d.business && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: MUTE, marginBottom: 8 }}>Business at a glance</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Mini label="Active clients" value={d.business.activeClients} sub={`${d.business.activeSites} sites`} />
            <Mini label="Active weighbridges" value={d.activeWeighbridges ?? "—"} sub="in service" />
            <Mini label="Open tasks" value={d.business.openTasks} sub={`${d.business.overdueTasks} overdue`} color={d.business.overdueTasks ? FAIL : INK} />
            <Mini label="Active contracts" value={d.business.activeContracts} sub="service agreements" />
            <Mini label="Quote pipeline" value={money(d.business.pipelineValue)} sub="issued, awaiting decision" color={GOLD} />
            <Mini label="Won (accepted)" value={money(d.business.wonValue)} sub="accepted quotes" color={PASS} />
          </div>
        </div>
      )}

      {isAdmin && (d.staffMerits?.length || d.topClients?.length) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 12 }}>
          {d.staffMerits?.length ? (
            <Card title="Staff merits · last 120 days" span={2} action={<Link href="/reports-summary" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: "none" }}>Full report →</Link>}>
              <MeritBoard rows={d.staffMerits} />
            </Card>
          ) : null}
          {d.topClients?.length ? (
            <Card title="Top clients · by reports">
              <BarList items={d.topClients.map((c) => ({ label: c.name, value: c.count, href: `/dashboard?q=${encodeURIComponent(c.name)}` }))} />
            </Card>
          ) : null}
        </div>
      )}

      {/* Recent activity */}
      {d.recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Card title="Recent activity" action={<Link href="/dashboard" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: "none" }}>All reports →</Link>}>
            <div style={{ display: "grid", gap: 2 }}>
              {d.recent.map((r) => (
                <Link key={r.serial} href={r.link} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", textDecoration: "none", borderTop: "1px solid #f0ebde" }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: MUTE }}>{r.subtitle}</div>
                  </div>
                  <Pill status={r.status} />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Client empty-state help */}
      {isClient && d.recent.length === 0 && (
        <div className="card" style={{ padding: 20, marginTop: 12, textAlign: "center", color: MUTE }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>Welcome</div>
          <p style={{ fontSize: 13, marginTop: 6 }}>Request a calibration or a quotation from the menu — you&apos;ll see their status update here.</p>
        </div>
      )}
    </div>
  );
}
