import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
