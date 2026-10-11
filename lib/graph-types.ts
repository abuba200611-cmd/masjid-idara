/*
  أنواع رسم الدماغ وأسماؤها وألوانها — ملف صرف (بلا خادم) يشاركه
  مُنشئ الرسم على الخادم وشاشة العرض على العميل.
*/

export const NODE_TYPES = ["mosque", "halaqah", "teacher", "student", "pending", "feature", "note"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export type NodeMeta = Record<string, string | number | boolean>;
export type GraphNode = { id: string; type: NodeType; label: string; meta: NodeMeta };
export type GraphEdge = { source: string; target: string; kind: string };
export type MosqueGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export const NODE_TYPE_INFO: Record<NodeType, { label: string; color: string }> = {
  mosque: { label: "الجامع", color: "#f5c542" },
  halaqah: { label: "حلقة", color: "#4f8cff" },
  teacher: { label: "معلّم", color: "#3fb950" },
  student: { label: "طالب", color: "#8ecbff" },
  pending: { label: "طلب تسجيل", color: "#ff9f43" },
  feature: { label: "ميزة", color: "#a371f7" },
  note: { label: "ملاحظة", color: "#8b8b8b" },
};
