import { unauthorized } from "@/lib/admin-auth";
import { canAccessMosque } from "@/lib/access";
import { getMosque, listHalaqahs, listPendingStudents } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!(await canAccessMosque(id))) return unauthorized();

  const mosque = await getMosque(id);
  if (!mosque) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });

  const [halaqahs, pending] = await Promise.all([listHalaqahs(id), listPendingStudents(id)]);
  return Response.json({ mosque, halaqahs, pending });
}
