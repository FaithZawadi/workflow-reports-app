import { prisma } from "./db";

// Best-effort audit logging for the global admin audit trail. It records who did
// what to which entity. Never throws — auditing must not break the main action.
export async function recordAudit({ actor, action, entity, entityId, summary }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.sub || null,
        actorName: actor?.name || "system",
        actorRole: actor?.role || null,
        action, // CREATE | UPDATE | DELETE | APPROVE | REJECT
        entity, // USER | REPORT | SCHEDULE
        entityId: entityId != null ? String(entityId) : null,
        summary: String(summary || ""),
      },
    });
  } catch {
    // Swallow — a failed audit write must never break the request.
  }
}
