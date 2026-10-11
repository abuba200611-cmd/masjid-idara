import { getMosque, isFeatureEnabled } from "@/lib/db";

/** اسم الجامع فقط — لصفحة التسجيل العامة، بلا حاجة لجلسة مشرف؛ وتعطيل "التسجيل العام" يخفي الرابط */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const mosque = await getMosque(id);
  if (!mosque) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });
  if (!(await isFeatureEnabled(id, "registration"))) {
    return Response.json({ error: "رابط التسجيل غير مفعّل" }, { status: 404 });
  }
  return Response.json({ name: mosque.name, city: mosque.city });
}
