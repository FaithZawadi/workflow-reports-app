import { prisma } from "./db";
import { CLIENT_APPROVER_ROLES } from "./roles";
import { notifyUsers } from "./notify";

// Notify every active approver (admin / manager / PM / TM) that a client or site
// registration is awaiting approval. Any of them may act on it.
export async function notifyApprovers({ title, body, link = "/clients/pending", exceptUserId } = {}) {
  try {
    const approvers = await prisma.user.findMany({
      where: { active: true, roles: { hasSome: CLIENT_APPROVER_ROLES } },
      select: { id: true },
    });
    const ids = approvers.map((u) => u.id).filter((id) => id && id !== exceptUserId);
    if (ids.length) await notifyUsers(ids, { type: "APPROVAL", title, body, link });
  } catch {
    // best-effort — a failed notification must never break registration.
  }
}
