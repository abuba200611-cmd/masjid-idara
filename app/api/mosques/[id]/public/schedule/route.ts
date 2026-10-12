import { parsePositiveIntParam, paramNotFound } from "@/lib/api-gate";
import { getMosque, isFeatureEnabled, listScheduleSlots } from "@/lib/db";

/**
 * الجدول الأسبوعي للعرض العام (رابط المشاركة /j/{id}/schedule) — بلا جلسة:
 * الاسم والخانات فقط، و404 إن لم يوجد الجامع أو كانت الميزة معطّلة.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = parsePositiveIntParam((await params).id);
  if (mosqueId === null) return paramNotFound();

  const mosque = await getMosque(mosqueId);
  if (!mosque) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });
  if (!(await isFeatureEnabled(mosqueId, "weekly_schedule"))) {
    return Response.json({ error: "الجدول غير متاح لهذا الجامع" }, { status: 404 });
  }

  return Response.json({ name: mosque.name, city: mosque.city, slots: await listScheduleSlots(mosqueId) });
}
