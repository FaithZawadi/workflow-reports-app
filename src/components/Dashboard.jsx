"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatTile, Donut, BarList, TrendArea, Gauge, Bars } from "./charts";
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

// One uniform panel. Every chart/list sits in the same shell so the grid reads
// as a single system: same header, same body height, chart vertically centred.
const Panel = ({ title, action, children, span, center = false, minH = 300 }) => (
  <section
    className="card"
    style={{
      padding: 0,
      gridColumn: span ? `span ${span}` : undefined,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}
  >
    {title && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: INK }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: GOLD, transform: "rotate(45deg)" }} />
          {title}
        </div>
        {action}
      </div>
    )}
    <div
      style={{
        flex: 1,
        padding: 16,
        minHeight: minH - 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "stretch",
      }}
    >
      {children}
    </div>
  </section>
);

// A small labelled metric for the strips.
const Mini = ({ label, value, sub, color, accent }) => (
  <div style={{ height: "100%", minWidth: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 15px", paddingLeft: 16, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent || "#cfc8ba" }} />
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: MUTE }}>{label}</div>
    <div style={{ fontSize: 25, fontWeight: 900, color: color || INK, marginTop: 4, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 11.5, color: MUTE, marginTop: "auto", paddingTop: 4 }}>{sub || " "}</div>
  </div>
);

// Uniform strip grid — every card equal height and width.
const stripGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gridAutoRows: "1fr", gap: 12 };

const MEDAL = ["#D4AF37", "#B8B8B8", "#CD7F32"];

// Staff merit leaderboard — a ranked score bar with the contributing counts.
function MeritBoard({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.score || 0));
  return (
    <div style={{ display: "grid", gap: 12, width: "100%" }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 900, textAlign: "center", color: MEDAL[i] || "#b6ab93", fontFamily: "var(--mono)" }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: INK, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              <b style={{ flexShrink: 0, color: COAL }}>{r.score}</b>
            </div>
            <div style={{ height: 8, background: "#F0EADD", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (r.score / max) * 100)}%`, height: "100%", background: i < 3 ? GOLD : COAL, borderRadius: 5, transition: "width .5s ease" }} />
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

const Empty = ({ children }) => (
  <div style={{ color: MUTE, fontSize: 13, fontStyle: "italic", textAlign: "center", margin: "auto" }}>{children || "No data yet."}</div>
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

  const gridCharts = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 };

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div style={{ order: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">{ROLE_LABEL[d.role] || d.role}</p>
          <h1 className="h1">{greeting()}, {(d.name || "").split(" ")[0]}</h1>
          <p className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: PASS, display: "inline-block" }} />
            Live overview · {rel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <Link href="/reports-summary" className="btn" style={{ textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Full analytics →</Link>
          )}
          {canFile && (
            <Link href="/reports/new" className="btn btn-primary" style={{ textDecoration: "none", fontWeight: 800 }}>+ New report</Link>
          )}
        </div>
      </div>

      {/* KPI tiles — equal height + width */}
      <div style={{ order: 3, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gridAutoRows: "1fr", gap: 12, marginTop: 16 }}>
        {tiles}
      </div>

      {/* Admin: business at a glance */}
      {isAdmin && d.business && (
        <div style={{ order: 4, marginTop: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: MUTE, marginBottom: 8 }}>Business at a glance</div>
          <div style={stripGrid}>
            <Mini label="Active clients" value={d.business.activeClients} sub={`${d.business.activeSites} sites`} accent={COAL} />
            <Mini label="Weighbridges" value={d.activeWeighbridges ?? "—"} sub="in service" accent={COAL} />
            <Mini label="Open tasks" value={d.business.openTasks} sub={`${d.business.overdueTasks} overdue`} color={d.business.overdueTasks ? FAIL : INK} accent={d.business.overdueTasks ? FAIL : "#cfc8ba"} />
            <Mini label="Contracts" value={d.business.activeContracts} sub="service agreements" accent={COAL} />
            <Mini label="Quote pipeline" value={money(d.business.pipelineValue)} sub="awaiting decision" color="#8a6d00" accent={GOLD} />
            <Mini label="Won (accepted)" value={money(d.business.wonValue)} sub="accepted quotes" color={PASS} accent={PASS} />
          </div>
        </div>
      )}

      {/* Quality / volume strip (non-client) */}
      {!isClient && !isAdmin && (
        <div style={{ ...stripGrid, order: 5, marginTop: 12 }}>
          <Mini label="This week" value={d.reportsThisWeek ?? 0} sub="reports filed" />
          <Mini label="This month" value={d.reportsThisMonth ?? 0} sub="reports filed" />
          <Mini label="Approval rate" value={`${d.approvalRate ?? 0}%`} sub={`${s.APPROVED || 0} of ${d.totalReports}`} color={PASS} accent={PASS} />
          <Mini label="Pending review" value={pending} sub="awaiting sign-off" color={pending ? WAIT : INK} accent={pending ? WAIT : "#cfc8ba"} />
        </div>
      )}

      {/* Charts — one uniform grid (leads the dashboard) */}
      <div style={{ ...gridCharts, order: 2 }}>
        {!isClient && (
          <Panel title="Reports · last 14 days" span={2} center>
            {d.reportsTrend?.some((p) => p.count) ? <div style={{ width: "100%" }}><TrendArea points={d.reportsTrend} /></div> : <Empty>No reports filed in the last 14 days.</Empty>}
          </Panel>
        )}
        {!isClient && (
          <Panel title="Report status" center>
            {statusSegments.length ? <Donut segments={statusSegments} centerLabel="reports" /> : <Empty />}
          </Panel>
        )}
        {!isClient && d.monthlyTrend?.length > 0 && (
          <Panel title="Reports · by month" center>
            {d.monthlyTrend.some((m) => m.count) ? <div style={{ width: "100%" }}><Bars bars={d.monthlyTrend.map((m) => ({ label: m.label, value: m.count }))} /></div> : <Empty>No reports in the last 6 months.</Empty>}
          </Panel>
        )}
        {!isClient && (
          <Panel title="By form type" action={<span style={{ fontSize: 11, color: MUTE }}>tap to filter</span>}>
            {d.reportsByTemplate.length ? <BarList items={d.reportsByTemplate.map((t) => ({ label: t.name, value: t.count, href: `/dashboard?template=${t.code}` }))} /> : <Empty />}
          </Panel>
        )}

        {d.quotations && Object.values(d.quotations).some((v) => v > 0) && (
          <Panel title="Quotations" action={<Link href="/quotations" style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>Open →</Link>} center>
            <Donut
              centerLabel="quotes"
              segments={[
                { label: "Requested", value: d.quotations.REQUESTED || 0, color: WAIT, href: "/quotations" },
                { label: "Quoted", value: d.quotations.QUOTED || 0, color: COAL, href: "/quotations" },
                { label: "Accepted", value: d.quotations.ACCEPTED || 0, color: PASS, href: "/quotations" },
                { label: "Declined", value: d.quotations.DECLINED || 0, color: FAIL, href: "/quotations" },
              ].filter((x) => x.value > 0)}
            />
          </Panel>
        )}
        {d.calibrationRequests && Object.values(d.calibrationRequests).some((v) => v > 0) && (
          <Panel title="Calibration requests" action={<Link href="/calibration-requests" style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>Open →</Link>}>
            <BarList
              items={[
                { label: "Submitted", value: d.calibrationRequests.SUBMITTED || 0, color: WAIT, href: "/calibration-requests" },
                { label: "Accepted", value: d.calibrationRequests.ACCEPTED || 0, color: PASS, href: "/calibration-requests" },
                { label: "Not accepted", value: d.calibrationRequests.REJECTED || 0, color: FAIL, href: "/calibration-requests" },
              ]}
            />
          </Panel>
        )}
        {d.satisfaction && d.satisfaction.count > 0 && (
          <Panel title="Customer satisfaction" center>
            <Gauge value={d.satisfaction.average} max={5} label={`${d.satisfaction.count} survey${d.satisfaction.count === 1 ? "" : "s"}`} />
          </Panel>
        )}
      </div>

      {/* Admin: staff merits + top clients (uniform grid) */}
      {isAdmin && (d.staffMerits?.length || d.topClients?.length) && (
        <div style={{ ...gridCharts, order: 6 }}>
          {d.staffMerits?.length ? (
            <Panel title="Staff merits · last 120 days" span={2} action={<Link href="/reports-summary" style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>Full report →</Link>}>
              <MeritBoard rows={d.staffMerits} />
            </Panel>
          ) : null}
          {d.topClients?.length ? (
            <Panel title="Top clients · by reports">
              <BarList items={d.topClients.map((c) => ({ label: c.name, value: c.count, href: `/dashboard?q=${encodeURIComponent(c.name)}` }))} />
            </Panel>
          ) : null}
        </div>
      )}

      {/* Recent activity */}
      {d.recent.length > 0 && (
        <div style={{ order: 7, marginTop: 16 }}>
          <Panel title="Recent activity" minH={0} action={<Link href="/dashboard" style={{ fontSize: 11, color: "#8a6d00", fontWeight: 700, textDecoration: "none" }}>All reports →</Link>}>
            <div style={{ display: "grid", gap: 2, width: "100%" }}>
              {d.recent.map((r) => (
                <Link key={r.serial} href={r.link} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", textDecoration: "none", borderTop: "1px solid #f0ebde" }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, background: COAL, color: GOLD, padding: "2px 6px" }}>{r.serial}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: MUTE }}>{r.subtitle}</div>
                  </div>
                  <Pill status={r.status} />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Client empty-state help */}
      {isClient && d.recent.length === 0 && (
        <div className="card" style={{ order: 8, padding: 20, marginTop: 12, textAlign: "center", color: MUTE }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>Welcome</div>
          <p style={{ fontSize: 13, marginTop: 6 }}>Request a calibration or a quotation from the menu — you&apos;ll see their status update here.</p>
        </div>
      )}
    </div>
  );
}
