-- نظام إدارة الجامع: طبقة تنظيمية فوق halaqat-tahfeez (المعلّم) — لا يكرّر
-- بيانات الحفظ/المطابقة، فقط يربط كل حلقة بجامعها ويوزّع الطلاب الجدد.

CREATE TABLE IF NOT EXISTS mosques (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- كل صف هنا يمثّل حلقة تعيش فعلياً في halaqat-tahfeez — نحفظ بس ربطها
-- بالجامع ورمز دعوتها (invite_code من ذاك النظام) لاستدعاء API الانضمام.
CREATE TABLE IF NOT EXISTS halaqahs (
  id            SERIAL PRIMARY KEY,
  mosque_id     INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  halaqah_name  TEXT NOT NULL,
  teacher_name  TEXT NOT NULL DEFAULT '',
  invite_code   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- طالب سجّل اهتمامه عبر رابط تسجيل الجامع العام، بانتظار التوزيع على حلقة
CREATE TABLE IF NOT EXISTS pending_students (
  id           SERIAL PRIMARY KEY,
  mosque_id    INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'assigned'
  halaqah_id   INTEGER REFERENCES halaqahs(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_at  TIMESTAMPTZ
);
