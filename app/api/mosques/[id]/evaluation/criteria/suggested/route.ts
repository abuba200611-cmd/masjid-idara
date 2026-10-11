import { featureGate } from "@/lib/api-gate";
import { seedSuggestedCriteria } from "@/lib/db";

/** يضيف المعايير المقترحة الناقصة فقط (الحضور، الحفظ، المراجعة…) ولا يكرر الموجود */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosqueId = Number((await params).id);
  const gate = await featureGate(mosqueId, "weekly_evaluation");
  if (gate) return gate;

  return Response.json({ criteria: await seedSuggestedCriteria(mosqueId) });
}
