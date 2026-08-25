import { checkAdminSecret, setAdminCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { secret?: unknown };
  const secret = String(body.secret ?? "");

  if (!checkAdminSecret(secret)) {
    return Response.json({ error: "كلمة السر غير صحيحة" }, { status: 401 });
  }

  await setAdminCookie();
  return Response.json({ ok: true });
}
