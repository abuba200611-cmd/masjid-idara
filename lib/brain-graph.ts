import "server-only";

import {
  getMosque,
  getMosqueFeatures,
  listBrainNotes,
  listHalaqahs,
  listPendingStudents,
} from "./db";
import { parseLinks } from "./brain";
import type { GraphEdge, GraphNode, MosqueGraph, NodeType } from "./graph-types";
import { fetchHalaqahRoster, type Roster } from "./teacher-app";

/*
  الدماغ: رسم بياني يُبنى تلقائياً من بيانات الجامع الفعلية (لا كتابة يدوية).
  كل مصدر بيانات "GraphSource" دالة تعيد عُقَداً وحوافّ لجامع واحد — ميزة
  جديدة لاحقاً (أسر/لجان/تقييمات) = مصدر واحد يُضاف للمصفوفة GRAPH_SOURCES.
*/

export type GraphSource = (mosqueId: number) => Promise<MosqueGraph>;

export const mosqueNodeId = (mosqueId: number) => `mosque:${mosqueId}`;
export const halaqahNodeId = (halaqahId: number) => `halaqah:${halaqahId}`;
export const PENDING_HUB_ID = "pending-hub";

const mosqueSource: GraphSource = async (mosqueId) => {
  const mosque = await getMosque(mosqueId);
  if (!mosque) return { nodes: [], edges: [] };
  return {
    nodes: [{ id: mosqueNodeId(mosqueId), type: "mosque", label: mosque.name, meta: { city: mosque.city } }],
    edges: [],
  };
};

/** الحلقات + معلّموها + طلابها (قائمة كل حلقة من نظام المعلّم، بالتوازي، والفشل لا يرمي) */
const halaqatSource: GraphSource = async (mosqueId) => {
  const halaqahs = await listHalaqahs(mosqueId);
  const rosters = await Promise.all(
    halaqahs.map(async (halaqah): Promise<Roster | null> => {
      try {
        return await fetchHalaqahRoster(halaqah.inviteCode);
      } catch {
        return null;
      }
    }),
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  halaqahs.forEach((halaqah, index) => {
    const roster = rosters[index];
    const id = halaqahNodeId(halaqah.id);
    const teacherName = roster?.teacherName || halaqah.teacherName;

    nodes.push({
      id,
      type: "halaqah",
      label: halaqah.halaqahName,
      meta: roster
        ? { teacherName, studentCount: roster.students.length }
        : { teacherName, studentCount: 0, error: true },
    });
    edges.push({ source: mosqueNodeId(mosqueId), target: id, kind: "halaqah" });

    const teacherId = `teacher:${halaqah.id}`;
    nodes.push({ id: teacherId, type: "teacher", label: teacherName, meta: { halaqah: halaqah.halaqahName } });
    edges.push({ source: id, target: teacherId, kind: "teacher" });

    roster?.students.forEach((student, studentIndex) => {
      const studentId = `student:${halaqah.id}:${studentIndex}`;
      nodes.push({
        id: studentId,
        type: "student",
        label: student.name,
        meta: { halaqah: halaqah.halaqahName, group: student.group, pages: student.pages, active: student.active },
      });
      edges.push({ source: id, target: studentId, kind: "student" });
    });
  });
  return { nodes, edges };
};

/** طلبات التسجيل: المعلّقة حول محور واحد، والموزَّعة مربوطة بحلقتها */
const registrationsSource: GraphSource = async (mosqueId) => {
  const pending = await listPendingStudents(mosqueId);
  if (pending.length === 0) return { nodes: [], edges: [] };

  const waiting = pending.filter((student) => student.status === "pending").length;
  const nodes: GraphNode[] = [
    { id: PENDING_HUB_ID, type: "pending", label: "طلبات التسجيل", meta: { hub: true, waiting } },
  ];
  const edges: GraphEdge[] = [{ source: mosqueNodeId(mosqueId), target: PENDING_HUB_ID, kind: "registrations" }];

  for (const student of pending) {
    const id = `pending:${student.id}`;
    nodes.push({ id, type: "pending", label: student.name, meta: { status: student.status } });
    if (student.status === "assigned" && student.halaqahId !== null) {
      edges.push({ source: halaqahNodeId(student.halaqahId), target: id, kind: "assigned" });
    } else {
      edges.push({ source: PENDING_HUB_ID, target: id, kind: "pending" });
    }
  }
  return { nodes, edges };
};

const featuresSource: GraphSource = async (mosqueId) => {
  const enabled = (await getMosqueFeatures(mosqueId)).filter((f) => f.enabled && f.status === "ready");
  return {
    nodes: enabled.map((f) => ({ id: `feature:${f.key}`, type: "feature" as const, label: f.nameAr, meta: { key: f.key } })),
    edges: enabled.map((f) => ({ source: mosqueNodeId(mosqueId), target: `feature:${f.key}`, kind: "feature" })),
  };
};

/** ملاحظات الجامع القديمة (إن وُجدت) مربوطة بوصلات [[..]] — للقراءة فقط */
const notesSource: GraphSource = async (mosqueId) => {
  const notes = await listBrainNotes(mosqueId);
  const slugs = new Set(notes.map((note) => note.slug));
  return {
    nodes: notes.map((note) => ({
      id: `note:${note.slug}`,
      type: "note" as const,
      label: note.title,
      meta: { tags: note.tags.join("، ") },
    })),
    edges: notes.flatMap((note) =>
      parseLinks(note.body)
        .filter((slug) => slug !== note.slug && slugs.has(slug))
        .map((slug) => ({ source: `note:${note.slug}`, target: `note:${slug}`, kind: "link" })),
    ),
  };
};

export const GRAPH_SOURCES: readonly GraphSource[] = [
  mosqueSource,
  halaqatSource,
  registrationsSource,
  featuresSource,
  notesSource,
];

/** الرسم الكامل للجامع — تُحذف الحوافّ التي لأحد طرفيها عقدة غير موجودة، والمعرّفات المكررة */
export async function buildMosqueGraph(mosqueId: number): Promise<MosqueGraph> {
  const parts = await Promise.all(GRAPH_SOURCES.map((source) => source(mosqueId)));

  const nodes = new Map<string, GraphNode>();
  for (const part of parts) for (const node of part.nodes) if (!nodes.has(node.id)) nodes.set(node.id, node);

  const edges = parts.flatMap((part) => part.edges).filter((edge) => nodes.has(edge.source) && nodes.has(edge.target));
  return { nodes: [...nodes.values()], edges };
}

/** ملخص عربي نصي مضغوط للرسم — ما سيقرؤه الوكيل الذكي لفهم الجامع */
export function buildGraphContext(graph: MosqueGraph): string {
  const byType = (type: NodeType) => graph.nodes.filter((node) => node.type === type);
  const mosque = byType("mosque")[0];
  const halaqahs = byType("halaqah");
  const pending = byType("pending").filter((node) => node.meta.hub !== true);
  const waiting = pending.filter((node) => node.meta.status === "pending").length;
  const features = byType("feature");

  const lines = [
    `الجامع: ${mosque?.label ?? "غير معروف"}`,
    `عدد الحلقات: ${halaqahs.length}`,
    `عدد الطلاب: ${byType("student").length}`,
    `عدد المعلمين: ${byType("teacher").length}`,
    `طلبات التسجيل: ${pending.length} (بانتظار التوزيع: ${waiting})`,
    `المزايا المفعّلة: ${features.map((node) => node.label).join("، ") || "لا شيء"}`,
  ];
  if (byType("note").length > 0) lines.push(`ملاحظات: ${byType("note").length}`);

  if (halaqahs.length > 0) {
    lines.push("", "الحلقات:");
    for (const halaqah of halaqahs) {
      const detail = halaqah.meta.error ? "تعذّر جلب الطلاب من نظام المعلّم" : `${halaqah.meta.studentCount} طالب`;
      lines.push(`- ${halaqah.label} — المعلم: ${halaqah.meta.teacherName} — ${detail}`);
    }
  }
  return lines.join("\n");
}
