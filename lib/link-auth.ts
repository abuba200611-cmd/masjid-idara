import "server-only";

import { timingSafeEqual } from "node:crypto";

/** مقارنة سرّين بزمن ثابت — الطول أولاً لأن timingSafeEqual ترمي عند اختلافه */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * يحمي مسارات /api/link/** الواردة من نظام المعلّم (halaqat-tahfeez) بنفس
 * السرّ المشترك LINK_SECRET عبر ترويسة x-link-secret. يرجع Response 401
 * لو السرّ ناقص/خاطئ/غير مضبوط، أو null لو صحيح.
 */
export function requireLinkSecret(request: Request): Response | null {
  const provided = request.headers.get("x-link-secret");
  const expected = process.env.LINK_SECRET;
  if (provided && expected && safeEqual(provided, expected)) return null;
  return Response.json({ error: "غير مصرّح" }, { status: 401 });
}
