import nodemailer from "nodemailer";

let transporter = null;

function getTransport() {
  if (process.env.EMAIL_ENABLED !== "true") return null;
  if (transporter) return transporter;
  // No SMTP_USER → don't attempt AUTH (e.g. a Google Workspace SMTP relay that
  // authorises by the server's IP instead of a username/password).
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth,
  });
  return transporter;
}

// Returns { sent: boolean, reason?: string }. Never throws — a failed email
// must not break the workflow; the event is still recorded in the audit trail.
export async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (!t) return { sent: false, reason: "email disabled" };
  if (!to) return { sent: false, reason: "no recipient" };
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err?.message || "send failed" };
  }
}

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

export function reviewRequestEmail(report) {
  return {
    to: report.supervisorEmail,
    subject: `REVIEW NEEDED: ${report.serial} - ${report.templateName} (${report.clientName}${report.site ? " - " + report.site : ""})`,
    text: `${report.authorName} submitted a ${report.templateName} for ${report.clientName}${report.site ? " - " + report.site : ""}.

Serial: ${report.serial}
Weighbridge: ${report.weighbridgeId || "-"}

Open the report to review and approve or reject it:
${appUrl()}/reports/${report.serial}

When you approve, it moves to the manager (${report.managerEmail}) automatically.

- QSL Maintenance Management System`,
  };
}

export function approvalRequestEmail(report, supervisorName) {
  return {
    to: report.managerEmail,
    subject: `APPROVAL NEEDED: ${report.serial} - ${report.templateName} (${report.clientName}${report.site ? " - " + report.site : ""})`,
    text: `Supervisor ${supervisorName} reviewed and approved ${report.serial} (${report.templateName}, submitted by ${report.authorName}).

Give final approval here:
${appUrl()}/reports/${report.serial}

- QSL Maintenance Management System`,
  };
}

export function scheduleAssignedEmail(to, schedule) {
  const due = new Date(schedule.nextDueAt).toDateString();
  return {
    to,
    subject: `SCHEDULED: ${schedule.templateName} — ${schedule.clientName} (${schedule.weighbridgeId})`,
    text: `You've been assigned a recurring maintenance check.

Form:        ${schedule.templateName} (${schedule.template})
Client:      ${schedule.clientName}${schedule.site ? " - " + schedule.site : ""}
Weighbridge: ${schedule.weighbridgeId}
Frequency:   ${schedule.frequency}
First due:   ${due}

Open the schedule:
${appUrl()}/schedule

- QSL Maintenance Management System`,
  };
}

export function failureAlertEmail(to, report, reasons) {
  return {
    to,
    subject: `ATTENTION: ${report.serial} — ${reasons.join("; ")} (${report.clientName}${report.site ? " - " + report.site : ""})`,
    text: `A report just filed by ${report.authorName} needs attention:

${reasons.map((r) => "• " + r).join("\n")}

Serial:      ${report.serial}
Form:        ${report.templateName}
Weighbridge: ${report.weighbridgeId || "-"}

Open it:
${appUrl()}/reports/${report.serial}

- QSL Maintenance Management System`,
  };
}

export function decisionEmail(report, toEmail, word, byName, comment) {
  return {
    to: toEmail,
    subject: `${word}: ${report.serial} - ${report.templateName}`,
    text: `Your report ${report.serial} was ${word.toLowerCase()} by ${byName}${comment ? `.\nComment: ${comment}` : "."}

${appUrl()}/reports/${report.serial}

- QSL Maintenance Management System`,
  };
}
