import { unauthorized } from "@/lib/admin-auth";
import { canAccessMosque } from "@/lib/access";
import { getMosque, getMosqueFeatures, listHalaqahs, listPendingStudents } from "@/lib/db";
import { effectiveFeatures } from "@/lib/features";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!(await canAccessMosque(id))) return unauthorized();

  const mosque = await getMosque(id);
  if (!mosque) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });

  const [halaqahs, pending, features] = await Promise.all([
    listHalaqahs(id),
    listPendingStudents(id),
    getMosqueFeatures(id),
  ]);
  return Response.json({ mosque, halaqahs, pending, features: effectiveFeatures(features) });
}
