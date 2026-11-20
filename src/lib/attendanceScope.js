import { rolesOf } from "@/lib/roles";

// Attendance visibility: an ADMIN sees every registered worker; any other
// manager sees ONLY the workers they themselves registered.
export function attendanceVisibility(user) {
  return { admin: rolesOf(user).includes("ADMIN"), myId: user?.sub || "__none__" };
}

// A Prisma Worker `where` fragment scoped to what this user may see, optionally
// narrowed to one registrar (admins only — a non-admin is always locked to self).
export function workerWhere(user, registeredBy) {
  const { admin, myId } = attendanceVisibility(user);
  if (!admin) return { registeredById: myId };
  if (registeredBy) return { registeredById: registeredBy };
  return {};
}

// The same, as a `worker` relation filter for ClockEvent queries. Returns
// undefined when no narrowing is needed (admin, no registrar chosen).
export function eventWorkerFilter(user, registeredBy) {
  const { admin, myId } = attendanceVisibility(user);
  if (!admin) return { registeredById: myId };
  if (registeredBy) return { registeredById: registeredBy };
  return undefined;
}
