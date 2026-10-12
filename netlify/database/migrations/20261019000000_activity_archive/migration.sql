-- أرشيف الأنشطة: صور (مضغوطة من المتصفح، BYTEA) وروابط فيديو — إضافي فقط.
-- الوسم (tag_kind + tag_id) متعدد الأشكال بلا مفتاح أجنبي لأن الهدف أحد
-- ثلاثة جداول؛ التحقق أن الهدف من الجامع نفسه يتم في طبقة التطبيق.

CREATE TABLE IF NOT EXISTS activities (
  id            SERIAL PRIMARY KEY,
  mosque_id     INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tag_kind      TEXT CHECK (tag_kind IN ('halaqah', 'family', 'committee')),
  tag_id        INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((tag_kind IS NULL) = (tag_id IS NULL))
);

CREATE INDEX IF NOT EXISTS activities_mosque_date_idx
  ON activities (mosque_id, activity_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS activity_media (
  id          SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  mosque_id   INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('photo', 'video_link')),
  mime        TEXT,
  bytes       BYTEA,
  size_bytes  INTEGER,
  url         TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'photo' AND mime IS NOT NULL AND bytes IS NOT NULL AND size_bytes IS NOT NULL AND url IS NULL)
    OR
    (kind = 'video_link' AND url IS NOT NULL AND bytes IS NULL AND mime IS NULL AND size_bytes IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS activity_media_activity_idx
  ON activity_media (activity_id, sort_order, id);
CREATE INDEX IF NOT EXISTS activity_media_mosque_kind_idx
  ON activity_media (mosque_id, kind);
