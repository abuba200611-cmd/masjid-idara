-- مدير خاص لكل جامع (غير المشرف العام) — يدير حلقاته وطلابه فقط.
-- جامع واحد = مدير واحد (UNIQUE على mosque_id)؛ واسم المستخدم فريد عالمياً
-- لأنه أساس تسجيل الدخول.
CREATE TABLE IF NOT EXISTS mosque_admins (
  id             SERIAL PRIMARY KEY,
  mosque_id      INTEGER NOT NULL UNIQUE REFERENCES mosques(id) ON DELETE CASCADE,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- سرّ توقيع جلسات مدير الجامع (نفس نمط app_settings بحلقات/تسجيل-طلاب)
CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
