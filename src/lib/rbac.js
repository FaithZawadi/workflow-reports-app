import { TECH_TEMPLATES, ENGINEER_TEMPLATES } from "./templates";

const norm = (v) => (v || "").trim().toLowerCase();

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
    case "MANAGER":
      // Reviewers see everything routed to them at either stage.
      return {
        OR: [
          { supervisorEmail: { equals: user.email, mode: "insensitive" } },
          { managerEmail: { equals: user.email, mode: "insensitive" } },
        ],
      };
    case "TECHNICIAN":
    case "ENGINEER":
    default:
      // Field staff also see anything routed to them for review, plus their own.
      return {
        OR: [
          { authorId: user.sub },
          { supervisorEmail: { equals: user.email, mode: "insensitive" } },
          { managerEmail: { equals: user.email, mode: "insensitive" } },
        ],
      };
  }
}

// A user is the routed reviewer for a report if their email is on it.
function isReviewer(report, user) {
  const email = norm(user.email);
  return !!email && (norm(report.supervisorEmail) === email || norm(report.managerEmail) === email);
}

export function canView(report, user) {
  if (user.role === "ADMIN") return true;
  if (user.role === "PROJECT_MANAGER") return TECH_TEMPLATES.includes(report.template);
  if (user.role === "TECHNICAL_MANAGER") return ENGINEER_TEMPLATES.includes(report.template);
  if (isReviewer(report, user)) return true;
  return report.authorId === user.sub;
}

// Who can approve / reject a report at its current stage. Returns the stage the
// user is acting as ("SUPERVISOR" | "MANAGER") or null.
//
// Admins and the matching oversight managers can always act. Otherwise, whoever
// the report was routed to for the CURRENT stage (by email) may act — regardless
// of their exact role label — so the assigned supervisor/manager always gets the
// Approve/Reject buttons.
export function canAct(report, user) {
  const pendingSup = report.status === "PENDING_SUPERVISOR";
  const pendingMgr = report.status === "PENDING_MANAGER";
  if (!pendingSup && !pendingMgr) return null;

  const email = norm(user.email);

  if (user.role === "ADMIN") return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (user.role === "PROJECT_MANAGER" && TECH_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (user.role === "TECHNICAL_MANAGER" && ENGINEER_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";

  if (pendingSup && email && norm(report.supervisorEmail) === email) return "SUPERVISOR";
  if (pendingMgr && email && norm(report.managerEmail) === email) return "MANAGER";
  return null;
}
