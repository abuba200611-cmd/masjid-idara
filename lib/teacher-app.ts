import "server-only";

/*
  عميل نداءات خادم-لخادم لنظام المعلّم (halaqat-tahfeez) — نفس السرّ
  المشترك (x-link-secret) المستخدم أصلاً بين حلقات وتسجيل-طلاب.
*/
const TEACHER_APP_URL = process.env.TEACHER_APP_URL;
const LINK_SECRET = process.env.LINK_SECRET;

function requireConfig(): { url: string; secret: string } {
  if (!TEACHER_APP_URL || !LINK_SECRET) {
    throw new Error("TEACHER_APP_URL أو LINK_SECRET غير مضبوطين");
  }
  return { url: TEACHER_APP_URL, secret: LINK_SECRET };
}

/** يتحقق من صحة رمز دعوة حلقة ويرجع اسمها/اسم معلّمها، أو null لو غير صحيح */
export async function fetchHalaqahInfo(
  inviteCode: string,
): Promise<{ teacherName: string; halaqahName: string } | null> {
  const { url, secret } = requireConfig();
  try {
    const res = await fetch(`${url}/api/link/invite-info?code=${encodeURIComponent(inviteCode)}`, {
      headers: { "x-link-secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { teacherName: string; halaqahName: string };
  } catch {
    return null;
  }
}

/** يضيف الطالب فعلياً لقائمة معلّم حلقته بنظام المعلّم — الخطوة الفعلية عند التوزيع */
export async function addStudentToTeacherApp(inviteCode: string, studentName: string): Promise<boolean> {
  const { url, secret } = requireConfig();
  try {
    const res = await fetch(`${url}/api/link/add-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-link-secret": secret },
      body: JSON.stringify({ inviteCode, studentName }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
