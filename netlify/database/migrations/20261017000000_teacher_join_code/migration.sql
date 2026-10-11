-- رابط انضمام المعلّمين: رمز واحد لكل جامع يشاركه المدير مع معلّميه، فيضيف
-- كل معلّم حلقته بنفسه من تطبيقه. nullable ويُولَّد كسولاً عند أول طلب
-- (lib/db.ts)، والتجديد يستبدله فيبطل القديم. إضافة فقط وآمنة للإعادة.

ALTER TABLE mosques ADD COLUMN IF NOT EXISTS teacher_join_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS mosques_teacher_join_code_key
  ON mosques (teacher_join_code);
