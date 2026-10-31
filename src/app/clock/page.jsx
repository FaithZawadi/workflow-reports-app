import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageAttendance } from "@/lib/roles";
import ClockStation from "@/components/ClockStation";

export const metadata = { title: "Clocking station — Qalibrated" };
export const dynamic = "force-dynamic";

// The clocking kiosk lives OUTSIDE the app shell (full screen, no nav). Only a
// manager (a registered workflow user) may open it; the workers who clock in/out
// are not system users.
export default async function ClockPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login?next=/clock");
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.active) redirect("/login?next=/clock");
  const roles = user.roles && user.roles.length ? user.roles : [user.role];
  if (!canManageAttendance({ roles })) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", background: "#161310", color: "#fff" }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Clocking station</h1>
          <p style={{ color: "#c9c1b0" }}>Only a manager can open the clocking station. Please sign in with a manager account.</p>
          <a href="/" style={{ color: "#F5A800", fontWeight: 700, textDecoration: "none", display: "inline-block", marginTop: 14 }}>← Back to the app</a>
        </div>
      </div>
    );
  }
  return <ClockStation manager={{ name: user.name }} />;
}
