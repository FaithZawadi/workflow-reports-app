import { TECH_TEMPLATES, ENGINEER_TEMPLATES } from "./templates";
import { rolesOf } from "./roles";

const norm = (v) => (v || "").trim().toLowerCase();

// Build a Prisma `where` clause limiting reports to what this user may see.
// A user may hold several roles; the visible set is the UNION of what each role
// allows.
export function reportScope(user) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN")) return {};

  const clauses = [];
  const routedToMe = () => {
    clauses.push({ supervisorEmail: { equals: user.email, mode: "insensitive" } });
    clauses.push({ managerEmail: { equals: user.email, mode: "insensitive" } });
  };

  if (roles.includes("PROJECT_MANAGER")) clauses.push({ template: { in: TECH_TEMPLATES } });
  if (roles.includes("TECHNICAL_MANAGER")) clauses.push({ template: { in: ENGINEER_TEMPLATES } });
  if (roles.includes("SUPERVISOR") || roles.includes("MANAGER")) routedToMe();

  // Field staff (and any other role) also see their own reports plus anything
  // routed to them for review.
  if (roles.some((r) => ["TECHNICIAN", "ENGINEER"].includes(r)) || clauses.length === 0) {
    clauses.push({ authorId: user.sub });
    routedToMe();
  }

  return { OR: clauses };
}

// A user is the routed reviewer for a report if their email is on it.
function isReviewer(report, user) {
  const email = norm(user.email);
  return !!email && (norm(report.supervisorEmail) === email || norm(report.managerEmail) === email);
}

export function canView(report, user) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("PROJECT_MANAGER") && TECH_TEMPLATES.includes(report.template)) return true;
  if (roles.includes("TECHNICAL_MANAGER") && ENGINEER_TEMPLATES.includes(report.template)) return true;
  if (isReviewer(report, user)) return true;
  return report.authorId === user.sub;
}

// Who may edit a submitted report to correct an error. Admins may edit any
// report; the author may edit their own until it is fully approved (so genuine
// mistakes can be fixed, but a closed/approved record can only be touched by an
// admin). Every edit is recorded on the trail with who and when.
export function canEdit(report, user) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN")) return true;
  return report.authorId === user.sub && report.status !== "APPROVED";
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

  const roles = rolesOf(user);
  const email = norm(user.email);

  if (roles.includes("ADMIN")) return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (roles.includes("PROJECT_MANAGER") && TECH_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";
  if (roles.includes("TECHNICAL_MANAGER") && ENGINEER_TEMPLATES.includes(report.template))
    return pendingSup ? "SUPERVISOR" : "MANAGER";

  if (pendingSup && email && norm(report.supervisorEmail) === email) return "SUPERVISOR";
  if (pendingMgr && email && norm(report.managerEmail) === email) return "MANAGER";
  return null;
}
