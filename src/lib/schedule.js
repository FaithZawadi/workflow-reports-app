import { prisma } from "./db";
import { reportScope } from "./rbac";
import { TECH_TEMPLATES, ENGINEER_TEMPLATES, templateByCode } from "./templates";

// Maintenance cadence for each recurring form. WB05 (breakdown) is on-demand
// and therefore never scheduled.
export const CADENCE = {
  WB01: { everyDays: 1, leadDays: 0 },
  WB02: { everyDays: 7, leadDays: 2 },
  WB03: { everyDays: 30, leadDays: 5 },
  WB04: { everyDays: 90, leadDays: 14 },
  WB06: { everyDays: 365, leadDays: 30 },
};

export const SCHEDULED_TEMPLATES = Object.keys(CADENCE);

const DAY = 24 * 60 * 60 * 1000;

function templatesForRole(role) {
  switch (role) {
    case "TECHNICIAN":
    case "PROJECT_MANAGER":
      return TECH_TEMPLATES.filter((t) => CADENCE[t]);
    case "ENGINEER":
    case "TECHNICAL_MANAGER":
      return ENGINEER_TEMPLATES.filter((t) => CADENCE[t]);
    default:
      return SCHEDULED_TEMPLATES;
  }
}

// Tech forms are per client+site (each site keeps its own routine); engineer
// forms are per client (site varies per job).
function keyFor(template, clientName, site) {
  const useSite = TECH_TEMPLATES.includes(template);
  return `${clientName}||${useSite ? site || "" : ""}||${template}`;
}

// Builds the maintenance schedule visible to `user`.
// Returns items: { clientName, site, template, templateName, cadenceDays,
//                  lastSerial, lastAt, dueAt, status, daysLeft }
export async function buildSchedule(user) {
  const now = new Date();
  const templates = templatesForRole(user.role);

  const reports = await prisma.report.findMany({
    where: { AND: [reportScope(user), { template: { in: templates } }] },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      serial: true,
      template: true,
      clientName: true,
      site: true,
      createdAt: true,
      status: true,
      data: true,
    },
  });

  // Latest report per schedule key (reports are ordered newest first).
  const latest = new Map();
  for (const r of reports) {
    const key = keyFor(r.template, r.clientName, r.site);
    if (!latest.has(key)) latest.set(key, r);
  }

  // Determine which client/site rows the schedule should show even when no
  // report has ever been filed.
  const targets = new Map(); // "client||site" -> { clientName, site }
  const addTarget = (clientName, site) => {
    if (!clientName) return;
    const k = `${clientName}||${site || ""}`;
    if (!targets.has(k)) targets.set(k, { clientName, site: site || "" });
  };

  if (user.role === "TECHNICIAN") {
    // Their own plant/site only.
    if (user.clientId) {
      const c = await prisma.client.findUnique({ where: { id: user.clientId } });
      if (c) addTarget(c.name, user.site || "");
    }
  } else if (["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "ENGINEER"].includes(user.role)) {
    // Every active client, plus each technician posting (client+site).
    const clients = await prisma.client.findMany({ where: { active: true }, select: { name: true } });
    for (const c of clients) addTarget(c.name, "");
    if (user.role !== "ENGINEER" && user.role !== "TECHNICAL_MANAGER") {
      const techs = await prisma.user.findMany({
        where: { role: "TECHNICIAN", active: true, clientId: { not: null } },
        select: { site: true, client: { select: { name: true } } },
      });
      for (const t of techs) addTarget(t.client?.name, t.site || "");
    }
  }
  // Supervisors/managers only see rows derived from reports routed to them.
  for (const r of reports) addTarget(r.clientName, TECH_TEMPLATES.includes(r.template) ? r.site : "");

  // Clients that have at least one named-site row (used to hide the redundant
  // bare-client row for site-level tech forms).
  const clientsWithSites = new Set(
    [...targets.values()].filter((t) => t.site).map((t) => t.clientName)
  );

  const items = [];
  for (const { clientName, site } of targets.values()) {
    for (const template of templates) {
      const useSite = TECH_TEMPLATES.includes(template);
      // Engineer forms are tracked per client (bare row only); tech forms per
      // site — skip the bare row when the client has named-site rows.
      if (!useSite && site) continue;
      if (useSite && !site && clientsWithSites.has(clientName)) continue;
      const last = latest.get(keyFor(template, clientName, useSite ? site : ""));
      const cadence = CADENCE[template];

      let dueAt = null;
      if (last) {
        dueAt = new Date(last.createdAt.getTime() + cadence.everyDays * DAY);
        // WB06 records its own "next calibration due" date — trust it if set.
        if (template === "WB06") {
          const nextDue = new Date(last.data?.values?.nextDue || "");
          if (!isNaN(nextDue.getTime())) dueAt = nextDue;
        }
      }

      let status = "NO_RECORD";
      let daysLeft = null;
      if (dueAt) {
        // Compare calendar days so "due tomorrow" never reads as due today.
        const day = (d) => {
          const x = new Date(d);
          x.setHours(0, 0, 0, 0);
          return x.getTime();
        };
        daysLeft = Math.round((day(dueAt) - day(now)) / DAY);
        status = daysLeft < 0 ? "OVERDUE" : daysLeft <= cadence.leadDays ? "DUE_SOON" : "OK";
      }

      items.push({
        clientName,
        site: useSite ? site : "",
        template,
        templateName: templateByCode(template)?.name || template,
        cadenceDays: cadence.everyDays,
        lastSerial: last?.serial || null,
        lastAt: last?.createdAt || null,
        lastStatus: last?.status || null,
        dueAt,
        status,
        daysLeft,
      });
    }
  }

  // Most urgent first: overdue (most days late first), due soon, no record, ok.
  const rank = { OVERDUE: 0, DUE_SOON: 1, NO_RECORD: 2, OK: 3 };
  items.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
      a.clientName.localeCompare(b.clientName)
  );

  return items;
}

export function scheduleReminderEmail(to, overdue, dueSoon) {
  const line = (i) =>
    `- ${i.templateName} (${i.template}) — ${i.clientName}${i.site ? " / " + i.site : ""}: ` +
    (i.status === "OVERDUE"
      ? `${Math.abs(i.daysLeft)} day(s) overdue (was due ${i.dueAt.toDateString()})`
      : `due ${i.dueAt.toDateString()}`) +
    (i.lastSerial ? ` — last: ${i.lastSerial}` : " — never filed");

  return {
    to,
    subject: `MAINTENANCE DUE: ${overdue.length} overdue, ${dueSoon.length} due soon — QSL schedule`,
    text: `QSL maintenance schedule update

${overdue.length ? `OVERDUE:\n${overdue.map(line).join("\n")}\n` : ""}${
      dueSoon.length ? `DUE SOON:\n${dueSoon.map(line).join("\n")}\n` : ""
    }
Open the schedule: ${(process.env.APP_URL || "http://localhost:3000") + "/schedule"}

- QSL Maintenance Management System`,
  };
}
