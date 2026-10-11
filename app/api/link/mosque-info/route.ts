import { findMosqueByTeacherJoinCode } from "@/lib/db";
import { requireLinkSecret } from "@/lib/link-auth";

/**
 * معلومات عرض فقط عن الجامع صاحب رمز انضمام المعلّمين — يستدعيه نظام
 * المعلّم (خادم لخادم) ليعرض "انضمام حلقتك إلى جامع فلان" قبل التأكيد.
 */
export async function GET(request: Request) {
  const denied = requireLinkSecret(request);
  if (denied) return denied;

  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!code) return Response.json({ error: "الرمز مفقود" }, { status: 400 });

  const mosque = await findMosqueByTeacherJoinCode(code);
  if (!mosque) return Response.json({ error: "رابط الانضمام غير صحيح" }, { status: 404 });

  return Response.json({ mosqueName: mosque.name, city: mosque.city });
}
