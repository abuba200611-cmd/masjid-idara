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

// ————— الدماغ: ملاحظات الجامع المترابطة —————

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

export async function getBrainNote(mosqueId: number, slug: string): Promise<BrainNote | null> {
  const rows = await db().sql`
    SELECT id, mosque_id, slug, title, body, tags, created_at, updated_at
    FROM brain_notes WHERE mosque_id = ${mosqueId} AND slug = ${slug}
  `;
  const row = rows[0];
  return row ? rowToBrainNote(row) : null;
}

/** تنشئ الملاحظة، أو null إن وُجدت أخرى بنفس السَلَغ بنفس الجامع (409 عند المستدعي) */
export async function createBrainNote(
  mosqueId: number,
  note: { slug: string; title: string; body: string; tags: string[] },
): Promise<BrainNote | null> {
  if (await getBrainNote(mosqueId, note.slug)) return null;

  const rows = await db().sql`
    INSERT INTO brain_notes (mosque_id, slug, title, body, tags)
    VALUES (${mosqueId}, ${note.slug}, ${note.title}, ${note.body}, ${note.tags})
    RETURNING id, mosque_id, slug, title, body, tags, created_at, updated_at
  `;
  return rowToBrainNote(rows[0]);
}

/**
 * تحديث ملاحظة — السَلَغ يُعاد اشتقاقه من العنوان الجديد حتى تبقى وصلات
 * [[بالعنوان]] صحيحة. null إن كان السَلَغ الجديد محجوزاً لملاحظة أخرى.
 */
export async function updateBrainNote(
  mosqueId: number,
  id: number,
  changes: { slug: string; title: string; body: string; tags: string[] },
): Promise<BrainNote | null> {
  const conflict = await db().sql`
    SELECT id FROM brain_notes WHERE mosque_id = ${mosqueId} AND slug = ${changes.slug} AND id <> ${id}
  `;
  if (conflict[0]) return null;

  const rows = await db().sql`
    UPDATE brain_notes
    SET slug = ${changes.slug}, title = ${changes.title}, body = ${changes.body}, tags = ${changes.tags}, updated_at = now()
    WHERE id = ${id} AND mosque_id = ${mosqueId}
    RETURNING id, mosque_id, slug, title, body, tags, created_at, updated_at
  `;
  return rows[0] ? rowToBrainNote(rows[0]) : null;
}

export async function deleteBrainNote(mosqueId: number, id: number): Promise<void> {
  await db().sql`DELETE FROM brain_notes WHERE mosque_id = ${mosqueId} AND id = ${id}`;
}

// ————— أعضاء بالاسم الحر (يكملون الطلاب في الأسر واللجان) —————

/** "طالب" يشير إلى pending_students، و"عضو" إلى mosque_members */
export type MemberKind = "student" | "member";
/** هدف التقييم: أسرة أو طالب */
export type TargetKind = "family" | "student";

export type MosqueMember = {
  id: number;
  mosqueId: number;
  name: string;
  phone: string;
  roleNote: string;
  createdAt: string;
};

function rowToMosqueMember(row: Record<string, unknown>): MosqueMember {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    name: row.name as string,
    phone: row.phone as string,
    roleNote: row.role_note as string,
    createdAt: row.created_at as string,
  };
}

export async function listMosqueMembers(mosqueId: number): Promise<MosqueMember[]> {
  const rows = await db().sql`
    SELECT id, mosque_id, name, phone, role_note, created_at
    FROM mosque_members WHERE mosque_id = ${mosqueId} ORDER BY name
  `;
  return rows.map(rowToMosqueMember);
}

export async function createMosqueMember(
  mosqueId: number,
  member: { name: string; phone: string; roleNote: string },
): Promise<MosqueMember> {
  const rows = await db().sql`
    INSERT INTO mosque_members (mosque_id, name, phone, role_note)
    VALUES (${mosqueId}, ${member.name}, ${member.phone}, ${member.roleNote})
    RETURNING id, mosque_id, name, phone, role_note, created_at
  `;
  return rowToMosqueMember(rows[0]);
}

export async function deleteMosqueMember(mosqueId: number, id: number): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM mosque_members WHERE mosque_id = ${mosqueId} AND id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** اسم عضو من أفراد هذا الجامع (طالب أو حر)، أو null — تحقق قبل الإضافة لأسرة/لجنة */
export async function findMemberName(
  mosqueId: number,
  kind: MemberKind,
  memberId: number,
): Promise<string | null> {
  const rows =
    kind === "student"
      ? await db().sql`SELECT name FROM pending_students WHERE mosque_id = ${mosqueId} AND id = ${memberId}`
      : await db().sql`SELECT name FROM mosque_members WHERE mosque_id = ${mosqueId} AND id = ${memberId}`;
  return rows[0] ? (rows[0].name as string) : null;
}

// ————— الأسر —————

export type Family = {
  id: number;
  mosqueId: number;
  name: string;
  leaderName: string;
  notes: string;
  createdAt: string;
  memberCount: number;
};

function rowToFamily(row: Record<string, unknown>): Family {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    name: row.name as string,
    leaderName: row.leader_name as string,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    memberCount: (row.member_count as number) ?? 0,
  };
}

export async function listFamilies(mosqueId: number): Promise<Family[]> {
  const rows = await db().sql`
    SELECT f.id, f.mosque_id, f.name, f.leader_name, f.notes, f.created_at,
           (SELECT count(*)::int FROM family_members fm WHERE fm.family_id = f.id) AS member_count
    FROM families f
    WHERE f.mosque_id = ${mosqueId}
    ORDER BY f.name
  `;
  return rows.map(rowToFamily);
}

export async function getFamily(mosqueId: number, id: number): Promise<Family | null> {
  const rows = await db().sql`
    SELECT f.id, f.mosque_id, f.name, f.leader_name, f.notes, f.created_at,
           (SELECT count(*)::int FROM family_members fm WHERE fm.family_id = f.id) AS member_count
    FROM families f
    WHERE f.mosque_id = ${mosqueId} AND f.id = ${id}
  `;
  const row = rows[0];
  return row ? rowToFamily(row) : null;
}

export async function createFamily(
  mosqueId: number,
  family: { name: string; leaderName: string; notes: string },
): Promise<Family> {
  const rows = await db().sql`
    INSERT INTO families (mosque_id, name, leader_name, notes)
    VALUES (${mosqueId}, ${family.name}, ${family.leaderName}, ${family.notes})
    RETURNING id, mosque_id, name, leader_name, notes, created_at
  `;
  return rowToFamily(rows[0]);
}

export async function deleteFamily(mosqueId: number, id: number): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM families WHERE mosque_id = ${mosqueId} AND id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export type FamilyMember = {
  id: number;
  memberKind: MemberKind;
  memberId: number;
  name: string;
  createdAt: string;
};

/** أفراد أسرة بأسمائهم — الطالب من pending_students والحرّ من mosque_members */
export async function listFamilyMembers(mosqueId: number, familyId: number): Promise<FamilyMember[]> {
  const rows = await db().sql`
    SELECT fm.id, fm.member_kind, fm.member_id, fm.created_at,
           COALESCE(ps.name, mm.name) AS name
    FROM family_members fm
    JOIN families f ON f.id = fm.family_id AND f.mosque_id = ${mosqueId}
    LEFT JOIN pending_students ps ON fm.member_kind = 'student' AND ps.id = fm.member_id
    LEFT JOIN mosque_members mm ON fm.member_kind = 'member' AND mm.id = fm.member_id
    WHERE fm.family_id = ${familyId} AND COALESCE(ps.name, mm.name) IS NOT NULL
    ORDER BY name
  `;
  return rows.map((row) => ({
    id: row.id as number,
    memberKind: row.member_kind as MemberKind,
    memberId: row.member_id as number,
    name: row.name as string,
    createdAt: row.created_at as string,
  }));
}

/** إضافة فرد — false إن كان مضافاً أصلاً (الأسرة نفسها تُتحقق قبلها) */
export async function addFamilyMember(
  mosqueId: number,
  familyId: number,
  kind: MemberKind,
  memberId: number,
): Promise<boolean> {
  const rows = await db().sql`
    INSERT INTO family_members (family_id, member_kind, member_id)
    SELECT ${familyId}, ${kind}, ${memberId}
    WHERE EXISTS (SELECT 1 FROM families WHERE id = ${familyId} AND mosque_id = ${mosqueId})
    ON CONFLICT (family_id, member_kind, member_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function removeFamilyMember(
  mosqueId: number,
  familyId: number,
  kind: MemberKind,
  memberId: number,
): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM family_members
    WHERE family_id = ${familyId} AND member_kind = ${kind} AND member_id = ${memberId}
      AND family_id IN (SELECT id FROM families WHERE mosque_id = ${mosqueId})
    RETURNING id
  `;
  return rows.length > 0;
}

// ————— اللجان —————

export type Committee = {
  id: number;
  mosqueId: number;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
};

function rowToCommittee(row: Record<string, unknown>): Committee {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    name: row.name as string,
    description: row.description as string,
    createdAt: row.created_at as string,
    memberCount: (row.member_count as number) ?? 0,
  };
}

export async function listCommittees(mosqueId: number): Promise<Committee[]> {
  const rows = await db().sql`
    SELECT c.id, c.mosque_id, c.name, c.description, c.created_at,
           (SELECT count(*)::int FROM committee_members cm WHERE cm.committee_id = c.id) AS member_count
    FROM committees c
    WHERE c.mosque_id = ${mosqueId}
    ORDER BY c.name
  `;
  return rows.map(rowToCommittee);
}

export async function getCommittee(mosqueId: number, id: number): Promise<Committee | null> {
  const rows = await db().sql`
    SELECT c.id, c.mosque_id, c.name, c.description, c.created_at,
           (SELECT count(*)::int FROM committee_members cm WHERE cm.committee_id = c.id) AS member_count
    FROM committees c
    WHERE c.mosque_id = ${mosqueId} AND c.id = ${id}
  `;
  const row = rows[0];
  return row ? rowToCommittee(row) : null;
}

export async function createCommittee(
  mosqueId: number,
  committee: { name: string; description: string },
): Promise<Committee> {
  const rows = await db().sql`
    INSERT INTO committees (mosque_id, name, description)
    VALUES (${mosqueId}, ${committee.name}, ${committee.description})
    RETURNING id, mosque_id, name, description, created_at
  `;
  return rowToCommittee(rows[0]);
}

export async function deleteCommittee(mosqueId: number, id: number): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM committees WHERE mosque_id = ${mosqueId} AND id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export type CommitteeMember = {
  id: number;
  memberKind: MemberKind;
  memberId: number;
  name: string;
  role: string;
  createdAt: string;
};

/** أعضاء لجنة بأسمائهم — مثل أفراد الأسرة لكن مع الدور (رئيس/عضو…) */
export async function listCommitteeMembers(
  mosqueId: number,
  committeeId: number,
): Promise<CommitteeMember[]> {
  const rows = await db().sql`
    SELECT cm.id, cm.member_kind, cm.member_id, cm.role, cm.created_at,
           COALESCE(ps.name, mm.name) AS name
    FROM committee_members cm
    JOIN committees c ON c.id = cm.committee_id AND c.mosque_id = ${mosqueId}
    LEFT JOIN pending_students ps ON cm.member_kind = 'student' AND ps.id = cm.member_id
    LEFT JOIN mosque_members mm ON cm.member_kind = 'member' AND mm.id = cm.member_id
    WHERE cm.committee_id = ${committeeId} AND COALESCE(ps.name, mm.name) IS NOT NULL
    ORDER BY name
  `;
  return rows.map((row) => ({
    id: row.id as number,
    memberKind: row.member_kind as MemberKind,
    memberId: row.member_id as number,
    name: row.name as string,
    role: row.role as string,
    createdAt: row.created_at as string,
  }));
}

/** إضافة عضو بدور نصي — false إن كان مضافاً أصلاً (اللجنة نفسها تُتحقق قبلها) */
export async function addCommitteeMember(
  mosqueId: number,
  committeeId: number,
  kind: MemberKind,
  memberId: number,
  role: string,
): Promise<boolean> {
  const rows = await db().sql`
    INSERT INTO committee_members (committee_id, member_kind, member_id, role)
    SELECT ${committeeId}, ${kind}, ${memberId}, ${role}
    WHERE EXISTS (SELECT 1 FROM committees WHERE id = ${committeeId} AND mosque_id = ${mosqueId})
    ON CONFLICT (committee_id, member_kind, member_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function removeCommitteeMember(
  mosqueId: number,
  committeeId: number,
  kind: MemberKind,
  memberId: number,
): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM committee_members
    WHERE committee_id = ${committeeId} AND member_kind = ${kind} AND member_id = ${memberId}
      AND committee_id IN (SELECT id FROM committees WHERE mosque_id = ${mosqueId})
    RETURNING id
  `;
  return rows.length > 0;
}

// ————— مهام اللجان (لوحة ثلاث أعمدة) —————

export type TaskStatus = "todo" | "doing" | "done";

export type CommitteeTask = {
  id: number;
  committeeId: number;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
};

function rowToTask(row: Record<string, unknown>): CommitteeTask {
  return {
    id: row.id as number,
    committeeId: row.committee_id as number,
    title: row.title as string,
    status: row.status as TaskStatus,
    dueDate: (row.due_date as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listCommitteeTasks(
  mosqueId: number,
  committeeId: number,
): Promise<CommitteeTask[]> {
  const rows = await db().sql`
    SELECT ct.id, ct.committee_id, ct.title, ct.status, ct.due_date, ct.created_at
    FROM committee_tasks ct
    WHERE ct.committee_id = ${committeeId}
      AND ct.committee_id IN (SELECT id FROM committees WHERE mosque_id = ${mosqueId})
    ORDER BY ct.created_at DESC
  `;
  return rows.map(rowToTask);
}

export async function createCommitteeTask(
  mosqueId: number,
  committeeId: number,
  task: { title: string; dueDate: string | null },
): Promise<CommitteeTask | null> {
  const rows = await db().sql`
    INSERT INTO committee_tasks (committee_id, title, due_date)
    SELECT ${committeeId}, ${task.title}, ${task.dueDate}
    WHERE EXISTS (SELECT 1 FROM committees WHERE id = ${committeeId} AND mosque_id = ${mosqueId})
    RETURNING id, committee_id, title, status, due_date, created_at
  `;
  return rows[0] ? rowToTask(rows[0]) : null;
}

/** تغيير حالة مهمة — null إن لم توجد بهذه اللجنة (أو ليست من جوامعنا) */
export async function setCommitteeTaskStatus(
  mosqueId: number,
  committeeId: number,
  taskId: number,
  status: TaskStatus,
): Promise<CommitteeTask | null> {
  const rows = await db().sql`
    UPDATE committee_tasks SET status = ${status}
    WHERE id = ${taskId} AND committee_id = ${committeeId}
      AND committee_id IN (SELECT id FROM committees WHERE mosque_id = ${mosqueId})
    RETURNING id, committee_id, title, status, due_date, created_at
  `;
  return rows[0] ? rowToTask(rows[0]) : null;
}

export async function deleteCommitteeTask(
  mosqueId: number,
  committeeId: number,
  taskId: number,
): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM committee_tasks
    WHERE id = ${taskId} AND committee_id = ${committeeId}
      AND committee_id IN (SELECT id FROM committees WHERE mosque_id = ${mosqueId})
    RETURNING id
  `;
  return rows.length > 0;
}

// ————— التقييم الأسبوعي: معايير الجامع ثم درجات الأسبوع —————

export type Criterion = {
  id: number;
  mosqueId: number;
  name: string;
  maxScore: number;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

function rowToCriterion(row: Record<string, unknown>): Criterion {
  return {
    id: row.id as number,
    mosqueId: row.mosque_id as number,
    name: row.name as string,
    maxScore: row.max_score as number,
    sortOrder: row.sort_order as number,
    active: row.active === true,
    createdAt: row.created_at as string,
  };
}

export async function listCriteria(mosqueId: number): Promise<Criterion[]> {
  const rows = await db().sql`
    SELECT id, mosque_id, name, max_score, sort_order, active, created_at
    FROM evaluation_criteria WHERE mosque_id = ${mosqueId}
    ORDER BY sort_order, id
  `;
  return rows.map(rowToCriterion);
}

/** إنشاء معيار — null إن وُجد آخر بنفس الاسم (409 عند المستدعي). الترتيب يُبنى تلقائياً */
export async function createCriterion(
  mosqueId: number,
  criterion: { name: string; maxScore: number },
): Promise<Criterion | null> {
  const conflict = await db().sql`
    SELECT id FROM evaluation_criteria WHERE mosque_id = ${mosqueId} AND name = ${criterion.name}
  `;
  if (conflict[0]) return null;

  const rows = await db().sql`
    INSERT INTO evaluation_criteria (mosque_id, name, max_score, sort_order)
    VALUES (${mosqueId}, ${criterion.name}, ${criterion.maxScore},
            (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM evaluation_criteria WHERE mosque_id = ${mosqueId}))
    RETURNING id, mosque_id, name, max_score, sort_order, active, created_at
  `;
  return rowToCriterion(rows[0]);
}

/** المقترح الافتراضي للجامع — يضيف الناقص فقط (تعارض الاسم يتجاهل) ويعيد المعايير كلها */
export const SUGGESTED_CRITERIA: readonly { name: string; maxScore: number }[] = [
  { name: "الحضور", maxScore: 10 },
  { name: "الحفظ", maxScore: 10 },
  { name: "المراجعة", maxScore: 10 },
  { name: "البرنامج النوعي", maxScore: 10 },
  { name: "الاجتماع الأسري", maxScore: 10 },
];

export async function seedSuggestedCriteria(mosqueId: number): Promise<Criterion[]> {
  for (const [index, criterion] of SUGGESTED_CRITERIA.entries()) {
    await db().sql`
      INSERT INTO evaluation_criteria (mosque_id, name, max_score, sort_order)
      VALUES (${mosqueId}, ${criterion.name}, ${criterion.maxScore}, ${index + 1})
      ON CONFLICT (mosque_id, name) DO NOTHING
    `;
  }
  return listCriteria(mosqueId);
}

/** تحديث معيار (اسم/درجة عظمى/تفعيل) — null إن لم يوجد بهذا الجامع */
export async function updateCriterion(
  mosqueId: number,
  id: number,
  changes: { name?: string; maxScore?: number; active?: boolean },
): Promise<Criterion | null> {
  const existing = await db().sql`
    SELECT id, mosque_id, name, max_score, sort_order, active, created_at
    FROM evaluation_criteria WHERE mosque_id = ${mosqueId} AND id = ${id}
  `;
  if (!existing[0]) return null;

  const name = changes.name ?? (existing[0].name as string);
  const maxScore = changes.maxScore ?? (existing[0].max_score as number);
  const active = changes.active ?? existing[0].active === true;

  if (changes.name !== undefined && name !== (existing[0].name as string)) {
    const conflict = await db().sql`
      SELECT id FROM evaluation_criteria WHERE mosque_id = ${mosqueId} AND name = ${name} AND id <> ${id}
    `;
    if (conflict[0]) return null;
  }

  const rows = await db().sql`
    UPDATE evaluation_criteria SET name = ${name}, max_score = ${maxScore}, active = ${active}
    WHERE mosque_id = ${mosqueId} AND id = ${id}
    RETURNING id, mosque_id, name, max_score, sort_order, active, created_at
  `;
  return rows[0] ? rowToCriterion(rows[0]) : null;
}

export async function deleteCriterion(mosqueId: number, id: number): Promise<boolean> {
  const rows = await db().sql`
    DELETE FROM evaluation_criteria WHERE mosque_id = ${mosqueId} AND id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** أهداف التقييم لأسبوع ما: الأسر أو الطلاب — بأسمائها فقط */
export async function listEvaluationTargets(
  mosqueId: number,
  kind: TargetKind,
): Promise<{ id: number; name: string }[]> {
  const rows =
    kind === "family"
      ? await db().sql`SELECT id, name FROM families WHERE mosque_id = ${mosqueId} ORDER BY name`
      : await db().sql`SELECT id, name FROM pending_students WHERE mosque_id = ${mosqueId} ORDER BY name`;
  return rows.map((row) => ({ id: row.id as number, name: row.name as string }));
}

export type EvaluationEntry = {
  targetId: number;
  criterionId: number;
  score: number;
  note: string;
};

export async function listWeekEvaluations(
  mosqueId: number,
  weekStart: string,
  targetKind: TargetKind,
): Promise<EvaluationEntry[]> {
  const rows = await db().sql`
    SELECT target_id, criterion_id, score, note
    FROM evaluations
    WHERE mosque_id = ${mosqueId} AND week_start = ${weekStart} AND target_kind = ${targetKind}
  `;
  return rows.map((row) => ({
    targetId: row.target_id as number,
    criterionId: row.criterion_id as number,
    score: row.score as number,
    note: row.note as string,
  }));
}

/**
 * حفظ درجات الأسبوع — upsert: الخلية الواحدة (أسبوع، هدف، معيار) فريدة
 * بجدول البيانات، فالحفظ الجديد يستبدل القديم. المدخلات صُحّحت قبلها
 * بالمسار (المعيار من جوامعنا، الدرجة 0..الكبرى، الهدف موجود).
 */
export async function upsertEvaluations(
  mosqueId: number,
  weekStart: string,
  targetKind: TargetKind,
  entries: EvaluationEntry[],
): Promise<void> {
  await Promise.all(
    entries.map((entry) => db().sql`
      INSERT INTO evaluations (mosque_id, week_start, target_kind, target_id, criterion_id, score, note)
      VALUES (${mosqueId}, ${weekStart}, ${targetKind}, ${entry.targetId}, ${entry.criterionId}, ${entry.score}, ${entry.note})
      ON CONFLICT (week_start, target_kind, target_id, criterion_id)
      DO UPDATE SET score = excluded.score, note = excluded.note, updated_at = now()
    `),
  );
}
