import { addCycle } from "./schedule";

const DAY = 86400000;
const appUrl = () => process.env.APP_URL || "http://localhost:3000";
export const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / DAY);

// Lead-times (days before due) at which a service reminder is sent. At least
// three, per requirement. Override with CONTRACT_REMINDER_DAYS="30,14,7,1".
export function reminderLeadDays() {
  const raw = process.env.CONTRACT_REMINDER_DAYS;
  let days = raw
    ? raw.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0)
    : [];
  if (days.length < 3) days = [30, 14, 7, 1];
  return [...new Set(days)].sort((a, b) => b - a); // descending
}

// How many days a report may sit at one approval stage before it is escalated.
export function escalateAfterDays() {
  const n = parseInt(process.env.ESCALATE_AFTER_DAYS || "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

// Next service date after the current one is completed / passes.
export function advanceContract(contract) {
  return addCycle(new Date(contract.nextServiceAt), contract.frequency, contract.intervalDays);
}

export function contractReminderEmail(to, contract, daysUntil) {
  const due = new Date(contract.nextServiceAt).toDateString();
  const when =
    daysUntil < 0 ? `${-daysUntil} day(s) OVERDUE (was due ${due})`
    : daysUntil === 0 ? `due TODAY (${due})`
    : `due in ${daysUntil} day(s) (on ${due})`;
  return {
    to,
    subject: `SERVICE DUE: ${contract.name} — ${contract.clientName} — ${when}`,
    text: `Maintenance service reminder.

Contract: ${contract.name}
Client:   ${contract.clientName}
Service:  ${when}

Please arrange the service before it falls due. This is one of several reminders sent ahead of the due date.

Contract schedule: ${appUrl()}/contracts

- QSL Maintenance Management System`,
  };
}

export function escalationEmail(to, report, daysPending) {
  const stage = report.status === "PENDING_SUPERVISOR" ? "Equipment User review" : "Client/Manager approval";
  return {
    to,
    subject: `ESCALATION: ${report.serial} awaiting ${stage} for ${daysPending} day(s)`,
    text: `A report has been waiting for ${stage} for ${daysPending} day(s) and has not been actioned.

Serial:     ${report.serial}
Form:       ${report.templateName}
Client:     ${report.clientName}${report.site ? " - " + report.site : ""}
Filed by:   ${report.authorName}

Please action it, or reassign the reviewer:
${appUrl()}/reports/${report.serial}

- QSL Maintenance Management System`,
  };
}
