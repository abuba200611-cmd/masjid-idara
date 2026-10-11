-- مزايا كل جامع على حدة + الدماغ (ملاحظات مترابطة بأسلوب أوبسيديان).
-- سجل المزايا الكودي في lib/features.ts؛ الصفوف هنا "تجاوزات" فقط —
-- غياب الصف يعني أن الجامع على القيمة الافتراضية للميزة.

CREATE TABLE IF NOT EXISTS mosque_features (
  mosque_id    INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mosque_id, feature_key)
);

-- ملاحظات دماغ الجامع: السَلَغ فريد لكل جامع، والوصلات [[بعنوان الملاحظة]]
-- أو [[سَلَغها]] داخل النص تُحسب وقت القراءة (لا جدول حواف).
CREATE TABLE IF NOT EXISTS brain_notes (
  id         SERIAL PRIMARY KEY,
  mosque_id  INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  tags       TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mosque_id, slug)
);
