import { endSession } from "@/lib/auth";

export async function POST() {
  endSession();
  return Response.json({ ok: true });
}
