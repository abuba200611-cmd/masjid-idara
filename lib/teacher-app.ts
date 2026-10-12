import "server-only";

import type { HalaqahMetrics } from "./honor-board";

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

export type HalaqahStats = { activeStudents: number; totalPages: number; avgPages: number; avgMastery: number };

/** إحصائيات حلقة (طلاب نشطون، متوسط محفوظ وإتقان) — تُبنى منها إحصائيات الجامع */
export async function fetchHalaqahStats(inviteCode: string): Promise<HalaqahStats | null> {
  const { url, secret } = requireConfig();
  try {
    const res = await fetch(`${url}/api/link/stats?code=${encodeURIComponent(inviteCode)}`, {
      headers: { "x-link-secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as HalaqahStats;
  } catch {
    return null;
  }
}

export type RosterStudent = { name: string; group: string; pages: number; avgMastery: number; active: boolean };
export type Roster = { teacherName: string; halaqahName: string; students: RosterStudent[] };

/** قائمة طلاب الحلقة بالاسم — لعرضها بصفحة تفاصيل الحلقة */
export async function fetchHalaqahRoster(inviteCode: string): Promise<Roster | null> {
  const { url, secret } = requireConfig();
  try {
    const res = await fetch(`${url}/api/link/roster?code=${encodeURIComponent(inviteCode)}`, {
      headers: { "x-link-secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Roster;
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

/**
 * مقاييس حلقة لفترة (تفاعل الطلاب، حضور، خطة، وردات، تسميعات) — أساس
 * لوحة الشرف والتقارير. نفس تسامح بقية النداءات: مهلة قصيرة وأي فشل = null.
 */
export async function fetchHalaqahMetrics(
  inviteCode: string,
  from: string,
  to: string,
): Promise<HalaqahMetrics | null> {
  const { url, secret } = requireConfig();
  try {
    const query = new URLSearchParams({ invite: inviteCode, from, to });
    const res = await fetch(`${url}/api/link/metrics?${query}`, {
      headers: { "x-link-secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as HalaqahMetrics | null;
    // شكل غير متوقع = غير متاح (لا يكسر الترتيب بعدها)
    if (!body || !Array.isArray(body.students) || !body.totals || !body.halaqah) return null;
    return body;
  } catch {
    return null;
  }
}
