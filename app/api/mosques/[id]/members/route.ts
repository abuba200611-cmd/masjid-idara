import { featureGateAny, text } from "@/lib/api-gate";
import { createMosqueMember, listMosqueMembers, listPendingStudents, type MosqueMember } from "@/lib/db";

/*
  دليل أفراد الجامع: الطلاب (pending_students) + الأعضاء الأحرار —
  تخدمه ميزتا الأسر واللجان معاً، فالبوابة تكتفي بإحداهما.
*/

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  const gate = await featureGateAny(mosqueId, ["families", "committees"]);
  if (gate) return gate;

  const [students, members] = await Promise.all([
    listPendingStudents(mosqueId),
    listMosqueMembers(mosqueId),
  ]);
  return Response.json({ students, members });
}

/** عضو حر جديد (ولي أمر/متطوع) — الاسم فقط واجب */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  const gate = await featureGateAny(mosqueId, ["families", "committees"]);
  if (gate) return gate;

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    phone?: unknown;
    roleNote?: unknown;
  };
  const name = text(body.name, 100);
  if (!name) return Response.json({ error: "الاسم مطلوب" }, { status: 400 });

  const member: MosqueMember = await createMosqueMember(mosqueId, {
    name,
    phone: text(body.phone, 30),
    roleNote: text(body.roleNote, 200),
  });
  return Response.json({ member }, { status: 201 });
}
