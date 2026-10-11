import "server-only";

import { getDatabase } from "@netlify/database";
import { randomBytes } from "node:crypto";
import { FEATURES, type Feature } from "./features";

/*
  نظام إدارة الجامع — طبقة تنظيمية فوق halaqat-tahfeez، قاعدة بيانات
  Postgres مستقلة تماماً. المخطط في netlify/database/migrations/.
*/

let dbInstance: ReturnType<typeof getDatabase> | null = null;
function db(): ReturnType<typeof getDatabase> {
  if (!dbInstance) dbInstance = getDatabase();
  return dbInstance;
}

/** سرّ توقيع جلسات مدير الجامع — من البيئة إن وُجد، وإلا يُولَّد مرة ويُحفظ */
export async function sessionSecret(): Promise<string> {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;

  const rows = await db().sql`SELECT value FROM app_settings WHERE key = 'session_secret'`;
  if (rows[0]) return rows[0].value as string;

  const generated = randomBytes(32).toString("hex");
  await db().sql`INSERT INTO app_settings (key, value) VALUES ('session_secret', ${generated})
    ON CONFLICT (key) DO NOTHING`;
  const after = await db().sql`SELECT value FROM app_settings WHERE key = 'session_secret'`;
  return (after[0]?.value as string) ?? generated;
}

// ————— الجوامع —————

export type Mosque = { id: number; name: string; city: string; createdAt: string };

export async function listMosques(): Promise<Mosque[]> {
  const rows = await db().sql`SELECT id, name, city, created_at FROM mosques ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, city: r.city as string, createdAt: r.created_at as string }));
}

export async function getMosque(id: number): Promise<Mosque | null> {
  const rows = await db().sql`SELECT id, name, city, created_at FROM mosques WHERE id = ${id}`;
  const row = rows[0];
  return row ? { id: row.id, name: row.name, city: row.city, createdAt: row.created_at } : null;
}

export async function createMosque(name: string, city: string): Promise<number> {
  const rows = await db().sql`INSERT INTO mosques (name, city) VALUES (${name}, ${city}) RETURNING id`;
  return Number(rows[0].id);
}

// ————— الحلقات (روابط لحلقات تعيش فعلياً في halaqat-tahfeez) —————

export type Halaqah = {
  id: number;
  mosqueId: number;
  halaqahName: string;
  teacherName: string;
  inviteCode: string;
  createdAt: string;
};

function rowToHalaqah(row: Record<string, unknown>): Halaqah {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    halaqahName: row.halaqah_name as string,
    teacherName: row.teacher_name as string,
    inviteCode: row.invite_code as string,
    createdAt: row.created_at as string,
  };
}

export async function listHalaqahs(mosqueId: number): Promise<Halaqah[]> {
  const rows = await db().sql`
    SELECT id, mosque_id, halaqah_name, teacher_name, invite_code, created_at
    FROM halaqahs WHERE mosque_id = ${mosqueId} ORDER BY halaqah_name
  `;
  return rows.map(rowToHalaqah);
}

export async function getHalaqah(id: number): Promise<Halaqah | null> {
  const rows = await db().sql`
    SELECT id, mosque_id, halaqah_name, teacher_name, invite_code, created_at
    FROM halaqahs WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? rowToHalaqah(row) : null;
}

export async function createHalaqah(
  mosqueId: number,
  halaqahName: string,
  teacherName: string,
  inviteCode: string,
): Promise<number> {
  const rows = await db().sql`
    INSERT INTO halaqahs (mosque_id, halaqah_name, teacher_name, invite_code)
    VALUES (${mosqueId}, ${halaqahName}, ${teacherName}, ${inviteCode})
    RETURNING id
  `;
  return Number(rows[0].id);
}

/** حلقة بهذا الرمز بأي جامع (لتفادي ربط حلقة واحدة بجامعين) — null لو غير موجودة */
export async function findHalaqahByInviteCodeAnyMosque(
  inviteCode: string,
): Promise<{ id: number; mosqueId: number } | null> {
  const rows = await db().sql`SELECT id, mosque_id FROM halaqahs WHERE invite_code = ${inviteCode} ORDER BY id LIMIT 1`;
  const row = rows[0];
  return row ? { id: Number(row.id), mosqueId: Number(row.mosque_id) } : null;
}

// ————— رابط انضمام المعلّمين (رمز واحد لكل جامع) —————

function newJoinCode(): string {
  return randomBytes(7).toString("base64url"); // ١٠ محارف آمنة للروابط
}

/** رمز انضمام المعلّمين — يُولَّد كسولاً عند أول طلب ويبقى ثابتاً حتى يُجدَّد */
export async function getOrCreateTeacherJoinCode(mosqueId: number): Promise<string | null> {
  const existing = await db().sql`SELECT teacher_join_code FROM mosques WHERE id = ${mosqueId}`;
  if (!existing[0]) return null;
  const current = existing[0].teacher_join_code as string | null | undefined;
  if (current) return current;

  await db().sql`
    UPDATE mosques SET teacher_join_code = ${newJoinCode()} WHERE id = ${mosqueId} AND teacher_join_code IS NULL
  `;
  const after = await db().sql`SELECT teacher_join_code FROM mosques WHERE id = ${mosqueId}`;
  return (after[0]?.teacher_join_code as string | null) ?? null;
}

/** يستبدل الرمز بجديد — القديم يتوقف عن العمل فوراً */
export async function rotateTeacherJoinCode(mosqueId: number): Promise<string | null> {
  const code = newJoinCode();
  const rows = await db().sql`UPDATE mosques SET teacher_join_code = ${code} WHERE id = ${mosqueId} RETURNING id`;
  return rows[0] ? code : null;
}

export async function findMosqueByTeacherJoinCode(code: string): Promise<Mosque | null> {
  const rows = await db().sql`
    SELECT id, name, city, created_at FROM mosques WHERE teacher_join_code = ${code}
  `;
  const row = rows[0];
  return row ? { id: row.id, name: row.name, city: row.city, createdAt: row.created_at } : null;
}

// ————— الطلاب الجدد بانتظار التوزيع —————

export type PendingStudent = {
  id: number;
  mosqueId: number;
  name: string;
  phone: string;
  status: "pending" | "assigned";
  halaqahId: number | null;
  createdAt: string;
  assignedAt: string | null;
};

function rowToPending(row: Record<string, unknown>): PendingStudent {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    name: row.name as string,
    phone: row.phone as string,
    status: row.status as "pending" | "assigned",
    halaqahId: (row.halaqah_id as number | null) ?? null,
    createdAt: row.created_at as string,
    assignedAt: (row.assigned_at as string | null) ?? null,
  };
}

/** تسجيل عام عبر رابط الجامع — بلا اختيار حلقة، الجامع يوزّعه لاحقاً */
export async function addPendingStudent(mosqueId: number, name: string, phone: string): Promise<number> {
  const rows = await db().sql`
    INSERT INTO pending_students (mosque_id, name, phone) VALUES (${mosqueId}, ${name}, ${phone}) RETURNING id
  `;
  return Number(rows[0].id);
}

export async function listPendingStudents(mosqueId: number): Promise<PendingStudent[]> {
  const rows = await db().sql`
    SELECT id, mosque_id, name, phone, status, halaqah_id, created_at, assigned_at
    FROM pending_students WHERE mosque_id = ${mosqueId} ORDER BY created_at DESC
  `;
  return rows.map(rowToPending);
}

export async function getPendingStudent(id: number): Promise<PendingStudent | null> {
  const rows = await db().sql`
    SELECT id, mosque_id, name, phone, status, halaqah_id, created_at, assigned_at
    FROM pending_students WHERE id = ${id}
  `;
  const row = rows[0];
  return row ? rowToPending(row) : null;
}

export async function markAssigned(id: number, halaqahId: number): Promise<void> {
  await db().sql`
    UPDATE pending_students
    SET status = 'assigned', halaqah_id = ${halaqahId}, assigned_at = now()
    WHERE id = ${id}
  `;
}

// ————— مدراء الجوامع (كل جامع له مدير خاص، غير المشرف العام) —————

export type MosqueAdmin = { id: number; mosqueId: number; username: string };

/** ينشئ حساب مدير للجامع، أو يستبدل حساب هذا الجامع الحالي لو موجود أصلاً (جامع = مدير واحد) */
export async function upsertMosqueAdmin(mosqueId: number, username: string, passwordHash: string): Promise<void> {
  await db().sql`
    INSERT INTO mosque_admins (mosque_id, username, password_hash)
    VALUES (${mosqueId}, ${username}, ${passwordHash})
    ON CONFLICT (mosque_id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash
  `;
}

export async function findMosqueAdminByUsername(
  username: string,
): Promise<{ id: number; mosqueId: number; username: string; passwordHash: string } | null> {
  const rows = await db().sql`SELECT * FROM mosque_admins WHERE username = ${username}`;
  const row = rows[0];
  return row
    ? { id: row.id, mosqueId: row.mosque_id, username: row.username, passwordHash: row.password_hash }
    : null;
}

export async function findMosqueAdminById(id: number): Promise<MosqueAdmin | null> {
  const rows = await db().sql`SELECT id, mosque_id, username FROM mosque_admins WHERE id = ${id}`;
  const row = rows[0];
  return row ? { id: row.id, mosqueId: row.mosque_id, username: row.username } : null;
}

/** حساب المدير الحالي لهذا الجامع، إن وُجد — لعرضه بلوحة المشرف العام */
export async function getMosqueAdminForMosque(mosqueId: number): Promise<MosqueAdmin | null> {
  const rows = await db().sql`SELECT id, mosque_id, username FROM mosque_admins WHERE mosque_id = ${mosqueId}`;
  const row = rows[0];
  return row ? { id: row.id as number, mosqueId: row.mosque_id as number, username: row.username as string } : null;
}

// ————— مزايا كل جامع (السجل في lib/features.ts، والصفوف هنا تجاوزات فقط) —————

export type MosqueFeature = Feature & { enabled: boolean };

/** كل المزايا كما هي فعلياً لهذا الجامع: صف الجدول إن وُجد، وإلا افتراض السجل */
export async function getMosqueFeatures(mosqueId: number): Promise<MosqueFeature[]> {
  const rows = await db().sql`SELECT feature_key, enabled FROM mosque_features WHERE mosque_id = ${mosqueId}`;
  const overrides = new Map(rows.map((row) => [row.feature_key as string, row.enabled as boolean]));
  return FEATURES.map((feature) => ({ ...feature, enabled: overrides.get(feature.key) ?? feature.defaultEnabled }));
}

/** مفعّلة؟ ميزة غير معروفة أو "قريباً" لا تكون مفعّلة أبداً */
export async function isFeatureEnabled(mosqueId: number, key: string): Promise<boolean> {
  const feature = FEATURES.find((f) => f.key === key);
  if (!feature || feature.status !== "ready") return false;

  const rows = await db().sql`
    SELECT enabled FROM mosque_features WHERE mosque_id = ${mosqueId} AND feature_key = ${key}
  `;
  return rows[0] ? rows[0].enabled === true : feature.defaultEnabled;
}

export async function setMosqueFeature(mosqueId: number, key: string, enabled: boolean): Promise<void> {
  await db().sql`
    INSERT INTO mosque_features (mosque_id, feature_key, enabled)
    VALUES (${mosqueId}, ${key}, ${enabled})
    ON CONFLICT (mosque_id, feature_key) DO UPDATE SET enabled = excluded.enabled, updated_at = now()
  `;
}

// ————— الدماغ: ملاحظات قديمة تُقرأ فقط وتظهر كعُقَد بالخريطة (الكتابة عبر سكربت الاستيراد) —————

export type BrainNote = {
  id: number;
  mosqueId: number;
  slug: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

function rowToBrainNote(row: Record<string, unknown>): BrainNote {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    slug: row.slug as string,
    title: row.title as string,
    body: row.body as string,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listBrainNotes(mosqueId: number): Promise<BrainNote[]> {
  const rows = await db().sql`
    SELECT id, mosque_id, slug, title, body, tags, created_at, updated_at
    FROM brain_notes WHERE mosque_id = ${mosqueId} ORDER BY updated_at DESC
  `;
  return rows.map(rowToBrainNote);
}
