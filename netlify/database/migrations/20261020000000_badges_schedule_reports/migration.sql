-- المرحلة الثالثة: الأوسمة والجدول الأسبوعي — إضافي فقط (التقارير لا تحتاج
-- جداول: تقرأ مما سبق). التكرار آمن: IF NOT EXISTS في كل شيء.

-- أوسمة الجامع (تعريف واحد لكل جامع، يُمنح لأهداف متعددة)
CREATE TABLE IF NOT EXISTS badges (
  id            SERIAL PRIMARY KEY,
  mosque_id     INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '🏅',
  description   TEXT NOT NULL DEFAULT '',
  criteria_note TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mosque_id, name)
);

-- منح الأوسمة: الهدف طالب (pending_students) أو أسرة أو عضو حر
-- (mosque_members) — ربط متعدد الأشكال بلا مفتاح أجنبي كأفراد الأسر.
-- UNIQUE: منح الوسام نفسه للهدف نفسه مرة واحدة في اليوم فقط.
CREATE TABLE IF NOT EXISTS badge_awards (
  id          SERIAL PRIMARY KEY,
  badge_id    INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  mosque_id   INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('student', 'family', 'member')),
  target_id   INTEGER NOT NULL,
  awarded_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (badge_id, target_kind, target_id, awarded_at)
);

CREATE INDEX IF NOT EXISTS badge_awards_mosque_date_idx
  ON badge_awards (mosque_id, awarded_at DESC);

-- الجدول الأسبوعي: فترة (day_of_week × period) × خانة وقت/عنوان. اليوم
-- 0=السبت .. 6=الجمعة (عرف الأسبوع السعودي). ref_id يشير إلى حلقة/أسرة/
-- لجنة من الجامع نفسه (يُتحقق بالتطبيق) أو NULL للبرامج الحرة.
CREATE TABLE IF NOT EXISTS schedule_slots (
  id           SERIAL PRIMARY KEY,
  mosque_id    INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period       TEXT NOT NULL CHECK (period IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'other')),
  start_time   TEXT CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title        TEXT NOT NULL,
  program_kind TEXT NOT NULL DEFAULT 'other' CHECK (program_kind IN ('halaqah', 'family', 'committee', 'lecture', 'sport', 'cultural', 'other')),
  ref_id       INTEGER,
  location     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_slots_week_idx
  ON schedule_slots (mosque_id, day_of_week, period);
