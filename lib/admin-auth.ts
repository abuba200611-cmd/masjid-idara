import "server-only";

import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

/*
  مشرف واحد فقط (المطوّر) — نفس نمط لوحة /admin بنظام المعلّم: كوكي
  httpOnly يحمل السرّ نفسه، يُقارَن بأمان وقت كل طلب. لا حاجة لجدول
  مستخدمين أو جلسات موقّعة لمشرف واحد.
*/
export const ADMIN_COOKIE = "masjid_admin_session";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkAdminSecret(secret: string): boolean {
  const expected = process.env.ADMIN_SECRET ?? "";
  return !!expected && safeEqual(secret, expected);
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, process.env.ADMIN_SECRET ?? "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** يتحقق من جلسة المشرف — يُستخدم داخل كل مسار API محمي */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value;
  return !!session && checkAdminSecret(session);
}

export function unauthorized(): Response {
  return Response.json({ error: "غير مصرّح" }, { status: 401 });
}
