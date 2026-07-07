import { prisma } from "./db";

// Produces serials like QSL-WB01-2026-00001, incrementing atomically per
// template + year so two concurrent submissions never collide.
export async function nextSerial(templateCode) {
  const year = new Date().getFullYear();
  const scope = `${templateCode}-${year}`;
  const counter = await prisma.counter.upsert({
    where: { scope },
    create: { scope, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `QSL-${templateCode}-${year}-${String(counter.value).padStart(5, "0")}`;
}
