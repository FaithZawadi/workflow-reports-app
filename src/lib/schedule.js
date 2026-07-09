// Maintenance scheduling helpers — frequency maths, due-status and access rules.
import { TECH_TEMPLATES, ENGINEER_TEMPLATES } from "./templates";

// How soon (in days) before the due date an item is flagged "due soon".
export const FREQUENCIES = {
  DAILY: { label: "Daily", soon: 1, months: 0, days: 1 },
  WEEKLY: { label: "Weekly", soon: 2, months: 0, days: 7 },
  MONTHLY: { label: "Monthly", soon: 7, months: 1, days: 0 },
  QUARTERLY: { label: "Quarterly", soon: 14, months: 3, days: 0 },
  SEMIANNUAL: { label: "Every 6 months", soon: 21, months: 6, days: 0 },
  ANNUAL: { label: "Annual", soon: 30, months: 12, days: 0 },
  CUSTOM: { label: "Custom", soon: 7, months: 0, days: 0 },
};

export const FREQUENCY_KEYS = Object.keys(FREQUENCIES);

// The default frequency suggested for each form when creating a schedule.
export const DEFAULT_FREQUENCY = {
  WB01: "DAILY",
  WB02: "WEEKLY",
  WB03: "MONTHLY",
  WB04: "SEMIANNUAL",
  WB05: "CUSTOM",
  WB06: "ANNUAL",
};

// Advance a date forward by one cycle of the given frequency.
export function addCycle(from, frequency, intervalDays) {
  const d = new Date(from);
  const f = FREQUENCIES[frequency] || FREQUENCIES.CUSTOM;
  if (frequency === "CUSTOM") {
    const n = Number(intervalDays) > 0 ? Number(intervalDays) : 7;
    d.setDate(d.getDate() + n);
    return d;
  }
  if (f.months) d.setMonth(d.getMonth() + f.months);
  if (f.days) d.setDate(d.getDate() + f.days);
  return d;
}

// Given a due date, classify it relative to "now".
// Returns { status: OVERDUE|DUE_SOON|SCHEDULED, days } where days is the signed
// number of whole days until due (negative = overdue).
export function dueStatus(nextDueAt, frequency, now = new Date()) {
  const due = new Date(nextDueAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);
  const days = Math.round((startOfDue - startOfToday) / 86400000);
  const soon = (FREQUENCIES[frequency] || FREQUENCIES.CUSTOM).soon;
  let status = "SCHEDULED";
  if (days < 0) status = "OVERDUE";
  else if (days <= soon) status = "DUE_SOON";
  return { status, days };
}

export const STATUS_META = {
  OVERDUE: { label: "Overdue", color: "#B03A2E", rank: 0 },
  DUE_SOON: { label: "Due soon", color: "#946B00", rank: 1 },
  SCHEDULED: { label: "Scheduled", color: "#2E7D46", rank: 2 },
};

// Human phrasing for the day offset.
export function duePhrase(days) {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `in ${days} days`;
}

// Which templates a user may see/manage in the scheduler.
export function scheduleTemplateScope(role) {
  if (role === "ADMIN") return null; // all
  if (role === "PROJECT_MANAGER" || role === "TECHNICIAN") return TECH_TEMPLATES;
  if (role === "TECHNICAL_MANAGER" || role === "ENGINEER") return ENGINEER_TEMPLATES;
  return null; // supervisors/managers: view all
}

// Prisma `where` clause limiting schedules to what this user may list.
export function scheduleScope(user) {
  const where = { AND: [] };
  const tpls = scheduleTemplateScope(user.role);
  if (tpls) where.AND.push({ template: { in: tpls } });
  // Technicians see their own plant's schedules plus anything assigned to them.
  if (user.role === "TECHNICIAN") {
    const or = [{ assignedEmail: { equals: user.email, mode: "insensitive" } }];
    if (user.clientId) or.push({ clientId: user.clientId });
    where.AND.push({ OR: or });
  }
  return where.AND.length ? where : {};
}

// Who may create / edit / delete schedules (and for which templates).
export function canManageSchedules(role) {
  return ["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "SUPERVISOR", "MANAGER"].includes(role);
}

export function canManageTemplate(role, template) {
  if (!canManageSchedules(role)) return false;
  if (role === "ADMIN" || role === "SUPERVISOR" || role === "MANAGER") return true;
  if (role === "PROJECT_MANAGER") return TECH_TEMPLATES.includes(template);
  if (role === "TECHNICAL_MANAGER") return ENGINEER_TEMPLATES.includes(template);
  return false;
}

// Build the daily "maintenance due" digest for one recipient. `overdue` and
// `dueSoon` are Schedule rows (each carrying dueDays from dueStatus()).
export function scheduleReminderEmail(to, overdue, dueSoon) {
  const line = (i) => {
    const due = new Date(i.nextDueAt);
    const when =
      i.dueDays < 0
        ? `${Math.abs(i.dueDays)} day(s) overdue (was due ${due.toDateString()})`
        : `due ${due.toDateString()}`;
    return (
      `- ${i.templateName} (${i.template}) — ${i.clientName}${i.site ? " / " + i.site : ""}` +
      ` · ${i.weighbridgeId || "—"}: ${when}` +
      (i.lastReportSerial ? ` — last: ${i.lastReportSerial}` : "")
    );
  };
  const url = (process.env.APP_URL || "http://localhost:3000") + "/schedule";
  return {
    to,
    subject: `MAINTENANCE DUE: ${overdue.length} overdue, ${dueSoon.length} due soon — QSL schedule`,
    text:
      `QSL maintenance schedule update\n\n` +
      (overdue.length ? `OVERDUE:\n${overdue.map(line).join("\n")}\n\n` : "") +
      (dueSoon.length ? `DUE SOON:\n${dueSoon.map(line).join("\n")}\n\n` : "") +
      `Open the schedule: ${url}\n\n— QSL Maintenance Management System`,
  };
}
