import { prisma } from "./db";

// Create in-app notifications for specific users. Never throws — a failed
// notification must not break the workflow.
export async function notifyUsers(userIds, { type, title, body, link }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return 0;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type, title, body: body || null, link: link || null })),
    });
    return ids.length;
  } catch {
    return 0;
  }
}

// Resolve a set of emails to active users and notify them in-app. Handy because
// reviewers are routed by email, and only some are app users.
export async function notifyEmails(emails, payload) {
  const list = [...new Set((emails || []).map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
  if (list.length === 0) return 0;
  try {
    const users = await prisma.user.findMany({ where: { email: { in: list }, active: true }, select: { id: true } });
    return notifyUsers(users.map((u) => u.id), payload);
  } catch {
    return 0;
  }
}

// Oversight staff (admins + technical managers) — used for failure alerts and
// escalations. Returns their user ids (for in-app) and emails (for email).
export async function oversight() {
  try {
    const users = await prisma.user.findMany({
      where: { active: true, roles: { hasSome: ["ADMIN", "TECHNICAL_MANAGER"] } },
      select: { id: true, email: true },
    });
    return { ids: users.map((u) => u.id), emails: users.map((u) => u.email) };
  } catch {
    return { ids: [], emails: [] };
  }
}
