import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findMosqueAdminById, sessionSecret, type MosqueAdmin } from "./db";

export const MOSQUE_SESSION_COOKIE = "mosque_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // ٣٠ يوماً

async function sign(payload: string): Promise<string> {
  return createHmac("sha256", await sessionSecret()).update(payload).digest("hex");
}

export async function createMosqueSessionToken(adminId: number): Promise<string> {
  const payload = `${adminId}.${Date.now()}`;
  return `${payload}.${await sign(payload)}`;
}

async function readMosqueSessionToken(token: string): Promise<number | null> {
  const [idPart, issuedPart, signature] = token.split(".");
  if (!idPart || !issuedPart || !signature) return null;

  const expected = await sign(`${idPart}.${issuedPart}`);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const issuedAt = Number(issuedPart);
  const adminId = Number(idPart);
  if (!Number.isFinite(issuedAt) || !Number.isInteger(adminId)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;

  return adminId;
}

export async function setMosqueSessionCookie(adminId: number): Promise<void> {
  const store = await cookies();
  store.set(MOSQUE_SESSION_COOKIE, await createMosqueSessionToken(adminId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearMosqueSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(MOSQUE_SESSION_COOKIE);
}

/** مدير الجامع صاحب الجلسة الحالية، أو null إن لم يكن مسجّلاً */
export async function currentMosqueAdmin(): Promise<MosqueAdmin | null> {
  const store = await cookies();
  const token = store.get(MOSQUE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const adminId = await readMosqueSessionToken(token);
  return adminId === null ? null : findMosqueAdminById(adminId);
}
