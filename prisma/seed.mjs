import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (p) => bcrypt.hash(p, 10);

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@qalibrated.co.ke").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026";
  const adminName = process.env.SEED_ADMIN_NAME || "QSL Administrator";

  // First administrator
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: adminName, role: "ADMIN", passwordHash: await hash(adminPass) },
  });

  // A demo client (plant)
  const client = await prisma.client.upsert({
    where: { name: "TATA Chemicals Magadi" },
    update: {},
    create: { name: "TATA Chemicals Magadi" },
  });

  // Sample staff so you can try every role immediately.
  // Change or delete these after first login.
  const sample = [
    { email: "tech@demo.qsl", name: "Site Technician", role: "TECHNICIAN", clientId: client.id, site: "Plant Gate 1" },
    { email: "engineer@demo.qsl", name: "QSL Engineer", role: "ENGINEER" },
    { email: "supervisor@demo.qsl", name: "Site Supervisor", role: "SUPERVISOR" },
    { email: "manager@demo.qsl", name: "Plant Manager", role: "MANAGER" },
    { email: "pm@demo.qsl", name: "Project Manager", role: "PROJECT_MANAGER" },
    { email: "tm@demo.qsl", name: "Technical Manager", role: "TECHNICAL_MANAGER" },
  ];
  for (const u of sample) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: await hash("demo1234") },
    });
  }

  console.log("Seed complete.");
  console.log(`Admin: ${adminEmail} / ${adminPass}`);
  console.log("Demo staff password for all sample accounts: demo1234");
  console.log("Oversight codes come from PROJECT_MANAGER_CODE / TECHNICAL_MANAGER_CODE in .env");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
