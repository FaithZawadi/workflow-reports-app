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
export async function sendMail({ to, subject, text, html }) {
  const t = getTransport();
  if (!t) return { sent: false, reason: "email disabled" };
  if (!to) return { sent: false, reason: "no recipient" };
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err?.message || "send failed" };
  }
}

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

// A block of one-click action links for the routed reviewer. `links` comes from
// createApprovalLinks(report, stage); when tokens are unavailable it falls back
// to the plain app deep-link, so the email is always actionable.
function actionBlock(links, report) {
  if (!links) return `Open the report to review and approve or reject it:\n${appUrl()}/reports/${report.serial}`;
  if (!links.hasToken)
    return `Open the report to review and approve or reject it:\n${links.review}`;
  return `Review the report, then approve or reject it (you can add a comment) — no sign-in needed:

  ✓ APPROVE:  ${links.approve}
  ✗ REJECT:   ${links.reject}

Or open the full report first:
  ${links.open}

(These links are private to you and expire in 14 days.)`;
}

// ---- HTML email (branded, button-driven — no raw links on show) -------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function emailShell(headline, innerHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Arial,sans-serif;color:#26221c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(22,19,16,.10);">
      <tr><td style="height:6px;background:repeating-linear-gradient(45deg,#f5a800 0 12px,#161310 12px 24px);"></td></tr>
      <tr><td style="background:#161310;padding:16px 22px;color:#ffffff;font-weight:800;font-size:15px;">QALIBRATED <span style="color:#f5a800;">SYSTEMS</span></td></tr>
      <tr><td style="padding:22px;">
        <div style="font-size:18px;font-weight:800;color:#26221c;margin:0 0 12px;">${headline}</div>
        ${innerHtml}
      </td></tr>
      <tr><td style="padding:14px 22px;border-top:2px solid #f5a800;color:#6b6355;font-size:11px;">QSL Maintenance Management System · Qalibrated Systems Limited</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Approve / Reject buttons (and a quiet "open report" link) — the URLs are on the
// buttons, never shown as text.
function actionButtons(links, report) {
  const review = links?.review || `${appUrl()}/reports/${report.serial}`;
  if (!links || !links.hasToken) {
    return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${esc(review)}" style="display:inline-block;background:#161310;color:#f5a800;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:8px;">Open report to review</a></td>
    </tr></table>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;"><a href="${esc(links.approve)}" style="display:inline-block;background:#2E7D46;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:8px;">✓ Approve</a></td>
      <td><a href="${esc(links.reject)}" style="display:inline-block;background:#B03A2E;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:8px;">✗ Reject</a></td>
    </tr></table>
    <div style="margin-top:12px;"><a href="${esc(links.open)}" style="color:#6b6355;font-size:12.5px;">Open the full report first →</a></div>
    <div style="margin-top:10px;color:#6b6355;font-size:11px;">These buttons are private to you and expire in 14 days. You can add a comment before rejecting.</div>`;
}

function metaRows(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#6b6355;font-size:12.5px;padding:2px 12px 2px 0;">${esc(k)}</td><td style="color:#26221c;font-size:12.5px;font-weight:700;padding:2px 0;">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}

export function reviewRequestEmail(report, links) {
  const html = emailShell(
    "A report needs your review",
    `<p style="margin:0 0 14px;color:#26221c;font-size:14px;">${esc(report.authorName)} submitted a <b>${esc(report.templateName)}</b>. Review it, then approve or reject — no sign-in needed.</p>
     ${metaRows([["Serial", report.serial], ["Client", `${report.clientName}${report.site ? " - " + report.site : ""}`], ["Weighbridge", report.weighbridgeId || "-"]])}
     ${actionButtons(links, report)}
     <p style="margin:16px 0 0;color:#6b6355;font-size:12px;">When you approve, it moves to the manager automatically.</p>`
  );
  return {
    to: report.supervisorEmail,
    subject: `REVIEW NEEDED: ${report.serial} - ${report.templateName} (${report.clientName}${report.site ? " - " + report.site : ""})`,
    text: `${report.authorName} submitted a ${report.templateName} for ${report.clientName}${report.site ? " - " + report.site : ""}.

Serial: ${report.serial}
Weighbridge: ${report.weighbridgeId || "-"}

${actionBlock(links, report)}

When you approve, it moves to the manager (${report.managerEmail}) automatically.

- QSL Maintenance Management System`,
    html,
  };
}

export function approvalRequestEmail(report, supervisorName, links) {
  const html = emailShell(
    "A report needs your approval",
    `<p style="margin:0 0 14px;color:#26221c;font-size:14px;">${esc(supervisorName)} reviewed and approved <b>${esc(report.serial)}</b> (${esc(report.templateName)}, submitted by ${esc(report.authorName)}). Give the final approval, or reject with a comment.</p>
     ${metaRows([["Serial", report.serial], ["Client", `${report.clientName}${report.site ? " - " + report.site : ""}`], ["Weighbridge", report.weighbridgeId || "-"]])}
     ${actionButtons(links, report)}`
  );
  return {
    to: report.managerEmail,
    subject: `APPROVAL NEEDED: ${report.serial} - ${report.templateName} (${report.clientName}${report.site ? " - " + report.site : ""})`,
    text: `Supervisor ${supervisorName} reviewed and approved ${report.serial} (${report.templateName}, submitted by ${report.authorName}).

${actionBlock(links, report)}

- QSL Maintenance Management System`,
    html,
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

// A client raised a calibration request — notify the QSL laboratory (PM / TM).
export function calibrationRequestEmail(to, request) {
  const n = Array.isArray(request.equipment) ? request.equipment.length : 0;
  return {
    to,
    subject: `CALIBRATION REQUEST: ${request.serial} — ${request.clientName}`,
    text: `${request.clientName} raised a calibration request (${request.serial}).

Instruments: ${n}
Type:        ${request.calibrationType === "IN_SITU" ? "In situ (on site)" : request.calibrationType === "LAB" ? "Lab calibration" : "-"}
Contact:     ${request.contactPerson || "-"}${request.telephone ? " · " + request.telephone : ""}

Review it and accept or reject:
${appUrl()}/calibration-requests/${request.id}

- QSL Maintenance Management System`,
  };
}

// The laboratory accepted / rejected a client's calibration request.
export function calibrationDecisionEmail(to, request, decision) {
  const accepted = decision === "ACCEPTED";
  return {
    to,
    subject: `${accepted ? "ACCEPTED" : "NOT ACCEPTED"}: calibration request ${request.serial}`,
    text: `Your calibration request ${request.serial} has been ${accepted ? "ACCEPTED" : "declined"} by QSL.${
      !accepted && request.decisionReason ? `\nReason: ${request.decisionReason}` : ""
    }

${accepted ? "Our team will be in touch to schedule the calibration and, where needed, send a quotation." : "Please contact us if you'd like to discuss."}

${appUrl()}/calibration-requests/${request.id}

- QSL Maintenance Management System`,
  };
}

// A client requested a quotation — notify the QSL preparers (PM / TM).
export function quoteRequestEmail(to, q) {
  return {
    to,
    subject: `QUOTE REQUEST: ${q.number} — ${q.clientName}`,
    text: `${q.clientName} requested a quotation (${q.number}).
${q.requestNote ? `\nNote: ${q.requestNote}\n` : ""}
Prepare and issue it here:
${appUrl()}/quotations/${q.id}

- QSL Maintenance Management System`,
  };
}

// A prepared quotation was issued to the client.
export function quoteIssuedEmail(to, q) {
  const money = `${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}`;
  return {
    to,
    subject: `QUOTATION ${q.number} — ${q.clientName} (${money})`,
    text: `Please find your quotation ${q.number}.

Total: ${money}${q.amountInWords ? ` (${q.amountInWords})` : ""}
${q.validUntil ? `Valid until: ${new Date(q.validUntil).toDateString()}\n` : ""}
View it, download the PDF, and accept or decline:
${appUrl()}/quotations/${q.id}

- QSL Maintenance Management System`,
  };
}

// The client accepted / declined a quotation — notify the preparers.
export function quoteDecisionEmail(to, q, decision) {
  return {
    to,
    subject: `QUOTATION ${decision}: ${q.number} — ${q.clientName}`,
    text: `${q.clientName} ${decision.toLowerCase()} quotation ${q.number} (${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}).

${appUrl()}/quotations/${q.id}

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
