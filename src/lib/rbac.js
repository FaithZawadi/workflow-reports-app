import { TECH_TEMPLATES, ENGINEER_TEMPLATES } from "./templates";

// Build a Prisma `where` clause limiting reports to what this user may see.
export function reportScope(user) {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "PROJECT_MANAGER":
      return { template: { in: TECH_TEMPLATES } };
    case "TECHNICAL_MANAGER":
      return { template: { in: ENGINEER_TEMPLATES } };
    case "SUPERVISOR":
      return { supervisorEmail: { equals: user.email, mode: "insensitive" } };
    case "MANAGER":
      return { managerEmail: { equals: user.email, mode: "insensitive" } };
    case "TECHNICIAN":
    case "ENGINEER":
    default:
      return { authorId: user.sub };
  }
}

export function canView(report, user) {
  if (user.role === "ADMIN") return true;
  if (user.role === "PROJECT_MANAGER") return TECH_TEMPLATES.includes(report.template);
  if (user.role === "TECHNICAL_MANAGER") return ENGINEER_TEMPLATES.includes(report.template);
  if (user.role === "SUPERVISOR")
    return (report.supervisorEmail || "").toLowerCase() === (user.email || "").toLowerCase();
  if (user.role === "MANAGER")
    return (report.managerEmail || "").toLowerCase() === (user.email || "").toLowerCase();
  return report.authorId === user.sub;
}

// Who can approve / reject a report at its current stage.
export function canAct(report, user) {
  const pendingSup = report.status === "PENDING_SUPERVISOR";
  const pendingMgr = report.status === "PENDING_MANAGER";
  if (!pendingSup && !pendingMgr) return null;

  if (user.role === "ADMIN") return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (user.role === "PROJECT_MANAGER" && TECH_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (user.role === "TECHNICAL_MANAGER" && ENGINEER_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (
    pendingSup &&
    user.role === "SUPERVISOR" &&
    (report.supervisorEmail || "").toLowerCase() === (user.email || "").toLowerCase()
  )
    return "SUPERVISOR";
  if (
    pendingMgr &&
    user.role === "MANAGER" &&
    (report.managerEmail || "").toLowerCase() === (user.email || "").toLowerCase()
  )
    return "MANAGER";
  return null;
}
