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

export default function Dashboard({ profile }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return setErr("Could not load dashboard.");
      setD(await res.json());
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

  const s = d.reportsByStatus;
  const pending = (s.PENDING_SUPERVISOR || 0) + (s.PENDING_MANAGER || 0);
  const statusSegments = [
    { label: "Supervisor review", value: s.PENDING_SUPERVISOR || 0, color: "#C79A2E", href: "/dashboard?status=PENDING_SUPERVISOR" },
    { label: "Manager approval", value: s.PENDING_MANAGER || 0, color: GOLD, href: "/dashboard?status=PENDING_MANAGER" },
    { label: "Approved", value: s.APPROVED || 0, color: PASS, href: "/dashboard?status=APPROVED" },
    { label: "Rejected", value: s.REJECTED || 0, color: FAIL, href: "/dashboard?status=REJECTED" },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <p className="eyebrow">{ROLE_LABEL[d.role] || d.role}</p>
      <h1 className="h1">{greeting()}, {(d.name || "").split(" ")[0]}</h1>
      <p className="muted" style={{ fontSize: 13 }}>Live overview · updates automatically</p>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 14 }}>
        {d.awaitingMe > 0 && <StatTile label="Awaiting you" value={d.awaitingMe} tone="wait" icon="⏳" sub="to review / approve" />}
        {!d.isClient && <StatTile label="Total reports" value={d.totalReports} icon="📄" href="/dashboard" />}
        {!d.isClient && <StatTile label="Approved" value={s.APPROVED || 0} tone="pass" icon="✓" href="/dashboard?status=APPROVED" />}
        {!d.isClient && <StatTile label="Pending" value={pending} tone="wait" icon="•" href="/dashboard?status=PENDING_SUPERVISOR" />}
        {d.satisfaction && <StatTile label="Satisfaction" value={d.satisfaction.average ? `${d.satisfaction.average}/5` : "—"} tone="gold" icon="★" sub={`${d.satisfaction.count} surveys`} />}
        {d.schedulesDue != null && <StatTile label="Due in 7 days" value={d.schedulesDue} tone={d.schedulesDue > 0 ? "wait" : "ink"} icon="🗓" sub="maintenance" />}
        {d.quotations && <StatTile label="Quotes accepted" value={d.quotations.ACCEPTED || 0} tone="pass" icon="💷" />}
      </div>

      {/* charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 12 }}>
        {!d.isClient && (
          <Card title="Reports · last 14 days">
            <TrendArea points={d.reportsTrend} />
          </Card>
        )}
        {!d.isClient && (
          <Card title="Report status">
            <Donut segments={statusSegments} centerLabel="reports" />
          </Card>
        )}
        {!d.isClient && d.reportsByTemplate.length > 0 && (
          <Card title="By form type" action={<span style={{ fontSize: 11, color: MUTE }}>tap to filter</span>}>
            <BarList items={d.reportsByTemplate.map((t) => ({ label: t.name, value: t.count, href: `/dashboard?template=${t.code}` }))} />
          </Card>
        )}

        {d.quotations && (
          <Card title="Quotations" action={<Link href="/quotations" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: "none" }}>Open →</Link>}>
            <Donut
              centerLabel="quotes"
              segments={[
                { label: "Requested", value: d.quotations.REQUESTED || 0, color: WAIT, href: "/quotations" },
                { label: "Quoted", value: d.quotations.QUOTED || 0, color: COAL, href: "/quotations" },
                { label: "Accepted", value: d.quotations.ACCEPTED || 0, color: PASS, href: "/quotations" },
                { label: "Declined", value: d.quotations.DECLINED || 0, color: FAIL, href: "/quotations" },
              ]}
            />
          </Card>
        )}
        {d.calibrationRequests && (
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
        {d.satisfaction && (
          <Card title="Customer satisfaction">
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Gauge value={d.satisfaction.average} max={5} label={`${d.satisfaction.count} survey${d.satisfaction.count === 1 ? "" : "s"}`} />
            </div>
          </Card>
        )}
      </div>

      {/* recent activity */}
      {d.recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Card title="Recent activity">
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
    </div>
  );
}
