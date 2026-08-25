import { prisma } from "./db";

// The client(s) a user is assigned to — their serving client, their employer
// (for client-side staff) and the clients of any weighbridges they're
// responsible for. Drives the report form's client field for EVERY template
// (including the Technical Report, which has no weighbridge to infer the client
// from), and lets a technician assigned to several clients pick one.
export async function assignedClientsFor(userId) {
  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      include: {
        client: { select: { id: true, name: true } },
        servingClient: { select: { id: true, name: true } },
        assignedClients: { where: { active: true }, select: { id: true, name: true } },
        weighbridges: { select: { client: { select: { id: true, name: true } } } },
      },
    })
    .catch(() => null);

  const map = new Map();
  const add = (c) => {
    if (c?.name) map.set(c.name, { id: c.id, name: c.name });
  };
  // Explicit admin assignment first, then serving/employer, then weighbridges.
  for (const c of me?.assignedClients || []) add(c);
  add(me?.servingClient);
  add(me?.client);
  for (const w of me?.weighbridges || []) add(w.client);

  const assignedClients = [...map.values()];
  // A single assignment prefills; several let the user choose.
  const primaryName =
    assignedClients.length === 1
      ? assignedClients[0].name
      : me?.servingClient?.name || me?.client?.name || null;
  return { assignedClients, primaryName };
}
