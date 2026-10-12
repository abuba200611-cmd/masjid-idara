-- المرحلة الثانية: الأسر واللجان والتقييم الأسبوعي — إضافي فقط.
-- "أفراد" الجامع = طلابه (pending_students) + أعضاء بالاسم الحر هنا
-- (أولياء أمور/متطوعون) حتى تشملهم الأسر واللجان. الربط متعدد الأشكال
-- (member_kind + member_id) بلا مفاتيح أجنبية لأن الهدف أحد جدولين.

-- أعضاء بالاسم الحر (غير الطلاب) — للأسر واللجان
CREATE TABLE IF NOT EXISTS mosque_members (
  id         SERIAL PRIMARY KEY,
  mosque_id  INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  role_note  TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- أسر الجامع
CREATE TABLE IF NOT EXISTS families (
  id          SERIAL PRIMARY KEY,
  mosque_id   INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  leader_name TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- أفراد الأسرة: 'student' يشير إلى pending_students، و'member' إلى mosque_members
CREATE TABLE IF NOT EXISTS family_members (
  id          SERIAL PRIMARY KEY,
  family_id   INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_kind TEXT NOT NULL CHECK (member_kind IN ('student', 'member')),
  member_id   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, member_kind, member_id)
);

-- لجان الجامع
CREATE TABLE IF NOT EXISTS committees (
  id          SERIAL PRIMARY KEY,
  mosque_id   INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- أعضاء اللجنة بدور نصي حر (رئيس/عضو/أمين سر…)
CREATE TABLE IF NOT EXISTS committee_members (
  id           SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  member_kind  TEXT NOT NULL CHECK (member_kind IN ('student', 'member')),
  member_id    INTEGER NOT NULL,
  role         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (committee_id, member_kind, member_id)
);

-- مهام اللجنة — لوحة ثلاث أعمدة (todo/doing/done)
CREATE TABLE IF NOT EXISTS committee_tasks (
  id           SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- معايير التقييم التي يحددها كل جامع بنفسه
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id         SERIAL PRIMARY KEY,
  mosque_id  INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  max_score  INTEGER NOT NULL DEFAULT 10 CHECK (max_score BETWEEN 1 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mosque_id, name)
);

-- درجات الأسبوع: هدفه أسرة أو طالب، والمعيار من معايير الجامع نفسه.
-- UNIQUE يجعل الحفظ upsert (أحدث درجة تستبدل القديمة لنفس الخلية).
CREATE TABLE IF NOT EXISTS evaluations (
  id           SERIAL PRIMARY KEY,
  mosque_id    INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  target_kind  TEXT NOT NULL CHECK (target_kind IN ('family', 'student')),
  target_id    INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL CHECK (score >= 0),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, target_kind, target_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS evaluations_week_idx
  ON evaluations (mosque_id, week_start, target_kind);
