import {
  createHalaqah,
  findHalaqahByInviteCodeAnyMosque,
  findMosqueByTeacherJoinCode,
  isFeatureEnabled,
} from "@/lib/db";
import { requireLinkSecret } from "@/lib/link-auth";
import { fetchHalaqahInfo } from "@/lib/teacher-app";

/**
 * انضمام ذاتي: معلّم فتح رابط الجامع من تطبيقه وضغط "انضم"، فيستدعي نظام
 * المعلّم هذا المسار (خادم لخادم، x-link-secret). نفس تحقق وإدراج الإضافة
 * اليدوية: رمز الدعوة يُتحقَّق منه عند نظام المعلّم ثم createHalaqah.
 * idempotent: نفس الحلقة بنفس الجامع = 200 alreadyJoined، وبجامع آخر = 409.
 */
export async function POST(request: Request) {
  const denied = requireLinkSecret(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    halaqahInviteCode?: unknown;
    halaqahName?: unknown;
    teacherName?: unknown;
  };
  const code = String(body.code ?? "").trim();
  const inviteCode = String(body.halaqahInviteCode ?? "").trim();
  if (!code || !inviteCode) return Response.json({ error: "بيانات ناقصة" }, { status: 400 });

  const mosque = await findMosqueByTeacherJoinCode(code);
  if (!mosque) return Response.json({ error: "رابط الانضمام غير صحيح" }, { status: 404 });
  if (!(await isFeatureEnabled(mosque.id, "halaqat"))) {
    return Response.json({ error: "الحلقات غير مفعّلة لهذا الجامع" }, { status: 404 });
  }

  const existing = await findHalaqahByInviteCodeAnyMosque(inviteCode);
  if (existing) {
    if (existing.mosqueId === mosque.id) {
      return Response.json({ ok: true, alreadyJoined: true, id: existing.id, mosqueName: mosque.name });
    }
    return Response.json({ error: "هذي الحلقة مضافة أصلاً لجامع آخر" }, { status: 409 });
  }

  // التحقق الموثوق من الرمز عند نظام المعلّم (كالإضافة اليدوية)؛ الأسماء منه لا من الجسم
  const info = await fetchHalaqahInfo(inviteCode);
  if (!info) {
    return Response.json({ error: "رمز دعوة الحلقة غير صحيح، أو نظام المعلّم غير متاح حالياً" }, { status: 400 });
  }

  const id = await createHalaqah(mosque.id, info.halaqahName, info.teacherName, inviteCode);
  return Response.json({
    ok: true,
    alreadyJoined: false,
    id,
    mosqueName: mosque.name,
    halaqahName: info.halaqahName,
    teacherName: info.teacherName,
  });
}
