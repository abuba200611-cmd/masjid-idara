import { unauthorized } from "@/lib/admin-auth";
import { canAccessMosque } from "@/lib/access";
import {
  deleteBrainNote,
  getBrainNote,
  getMosque,
  isFeatureEnabled,
  listBrainNotes,
  updateBrainNote,
} from "@/lib/db";
import { parseLinks, slugify } from "@/lib/brain";

type RouteContext = { params: Promise<{ id: string; slug: string }> };

async function gate(mosqueId: number): Promise<Response | null> {
  if (!(await canAccessMosque(mosqueId))) return unauthorized();
  if (!(await isFeatureEnabled(mosqueId, "brain"))) {
    return Response.json({ error: "الدماغ غير مفعّل لهذا الجامع" }, { status: 404 });
  }
  if (!(await getMosque(mosqueId))) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });
  return null;
}

/** ملاحظة واحدة + وصلاتها العكسية (تُحسب وقت القراءة من محتوى بقية الملاحظات) */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id, slug } = await params;
  const mosqueId = Number(id);
  const gateResponse = await gate(mosqueId);
  if (gateResponse) return gateResponse;

  const note = await getBrainNote(mosqueId, slug);
  if (!note) return Response.json({ error: "الملاحظة غير موجودة" }, { status: 404 });

  const others = await listBrainNotes(mosqueId);
  const backlinks = others
    .filter((other) => other.id !== note.id && parseLinks(other.body).includes(note.slug))
    .map((other) => ({ slug: other.slug, title: other.title }));

  return Response.json({ note, backlinks, slugs: others.map((other) => other.slug) });
}

/** تعديل — السَلَغ يُشتق من العنوان الجديد، وتعارض السَلَغ 409 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id, slug } = await params;
  const mosqueId = Number(id);
  const gateResponse = await gate(mosqueId);
  if (gateResponse) return gateResponse;

  const existing = await getBrainNote(mosqueId, slug);
  if (!existing) return Response.json({ error: "الملاحظة غير موجودة" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    body?: unknown;
    tags?: unknown;
  };
  const title = String(body.title ?? existing.title).trim();
  if (!title) return Response.json({ error: "العنوان مطلوب" }, { status: 400 });

  const newSlug = slugify(title);
  if (!newSlug) return Response.json({ error: "العنوان يجب أن يحوي حروفاً أو أرقاماً" }, { status: 400 });

  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : existing.tags;

  const note = await updateBrainNote(mosqueId, existing.id, {
    slug: newSlug,
    title,
    body: body.body === undefined ? existing.body : String(body.body),
    tags,
  });
  if (!note) return Response.json({ error: "توجد ملاحظة بنفس العنوان أصلاً" }, { status: 409 });

  return Response.json({ note });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id, slug } = await params;
  const mosqueId = Number(id);
  const gateResponse = await gate(mosqueId);
  if (gateResponse) return gateResponse;

  const existing = await getBrainNote(mosqueId, slug);
  if (!existing) return Response.json({ error: "الملاحظة غير موجودة" }, { status: 404 });

  await deleteBrainNote(mosqueId, existing.id);
  return Response.json({ ok: true });
}
