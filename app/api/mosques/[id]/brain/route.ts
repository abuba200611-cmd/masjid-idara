import { unauthorized } from "@/lib/admin-auth";
import { canAccessMosque } from "@/lib/access";
import { createBrainNote, getMosque, isFeatureEnabled, listBrainNotes } from "@/lib/db";
import { slugify } from "@/lib/brain";

/** قائمة ملاحظات دماغ الجامع كاملة (مع محتواها — للبحث والخريطة) */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  if (!(await canAccessMosque(mosqueId))) return unauthorized();
  if (!(await isFeatureEnabled(mosqueId, "brain"))) {
    return Response.json({ error: "الدماغ غير مفعّل لهذا الجامع" }, { status: 404 });
  }
  if (!(await getMosque(mosqueId))) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });

  return Response.json({ notes: await listBrainNotes(mosqueId) });
}

/** ملاحظة جديدة — السَلَغ يُشتق من العنوان، والتعارض 409 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  if (!(await canAccessMosque(mosqueId))) return unauthorized();
  if (!(await isFeatureEnabled(mosqueId, "brain"))) {
    return Response.json({ error: "الدماغ غير مفعّل لهذا الجامع" }, { status: 404 });
  }
  if (!(await getMosque(mosqueId))) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; body?: unknown; tags?: unknown };
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "العنوان مطلوب" }, { status: 400 });

  const slug = slugify(title);
  if (!slug) return Response.json({ error: "العنوان يجب أن يحوي حروفاً أو أرقاماً" }, { status: 400 });

  const noteBody = String(body.body ?? "");
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : [];

  const note = await createBrainNote(mosqueId, { slug, title, body: noteBody, tags });
  if (!note) return Response.json({ error: "توجد ملاحظة بنفس العنوان أصلاً" }, { status: 409 });

  return Response.json({ note }, { status: 201 });
}
