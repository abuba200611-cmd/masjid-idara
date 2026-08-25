import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { getHalaqah, getPendingStudent, markAssigned } from "@/lib/db";
import { addStudentToTeacherApp } from "@/lib/teacher-app";

/** يوزّع طالباً بانتظار التوزيع على حلقة — يضيفه فعلياً بنظام المعلّم ثم يعلّمه كمُوزَّع */
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { pendingId?: unknown; halaqahId?: unknown };
  const pendingId = Number(body.pendingId);
  const halaqahId = Number(body.halaqahId);

  const pending = await getPendingStudent(pendingId);
  if (!pending) return Response.json({ error: "الطالب غير موجود" }, { status: 404 });
  if (pending.status === "assigned") return Response.json({ error: "هذا الطالب موزَّع أصلاً" }, { status: 409 });

  const halaqah = await getHalaqah(halaqahId);
  if (!halaqah || halaqah.mosqueId !== pending.mosqueId) {
    return Response.json({ error: "الحلقة غير موجودة" }, { status: 404 });
  }

  const added = await addStudentToTeacherApp(halaqah.inviteCode, pending.name);
  if (!added) {
    return Response.json({ error: "تعذّر إضافة الطالب بنظام المعلّم — حاول مرة ثانية" }, { status: 502 });
  }

  await markAssigned(pendingId, halaqahId);
  return Response.json({ ok: true });
}
