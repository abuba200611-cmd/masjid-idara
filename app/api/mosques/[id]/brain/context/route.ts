import { unauthorized } from "@/lib/admin-auth";
import { canAccessMosque } from "@/lib/access";
import { getMosque, isFeatureEnabled } from "@/lib/db";
import { buildGraphContext, buildMosqueGraph } from "@/lib/brain-graph";

/** ملخص عربي نصي للرسم — ما يقرؤه الوكيل الذكي لفهم بيانات الجامع */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  if (!(await canAccessMosque(mosqueId))) return unauthorized();
  if (!(await isFeatureEnabled(mosqueId, "brain"))) {
    return Response.json({ error: "الدماغ غير مفعّل لهذا الجامع" }, { status: 404 });
  }
  if (!(await getMosque(mosqueId))) return Response.json({ error: "الجامع غير موجود" }, { status: 404 });

  const text = buildGraphContext(await buildMosqueGraph(mosqueId));
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
