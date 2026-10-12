import "server-only";

import {
  getMosque,
  getMosqueFeatures,
  isFeatureEnabled,
  listBadgeAwardLinks,
  listBadges,
  listBrainNotes,
  listCommitteeMemberLinks,
  listCommittees,
  listFamilies,
  listFamilyMemberLinks,
  listHalaqahs,
  listPendingStudents,
  type BadgeTargetKind,
  type MemberKind,
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
export const familyNodeId = (familyId: number) => `family:${familyId}`;
export const committeeNodeId = (committeeId: number) => `committee:${committeeId}`;
export const badgeNodeId = (badgeId: number) => `badge:${badgeId}`;

/** عقدة الفرد: الطالب هو نفسه عقدة طلب التسجيل `pending:{id}`، والعضو الحر عقدة مستقلة */
const memberNodeId = (kind: MemberKind, memberId: number) => (kind === "student" ? `pending:${memberId}` : `member:${memberId}`);

/** عقدة هدف الوسام — نفس عُقد الأفراد والأسر في مصادرها الأخرى */
const badgeTargetNodeId = (kind: BadgeTargetKind, targetId: number) =>
  kind === "family" ? familyNodeId(targetId) : memberNodeId(kind === "student" ? "student" : "member", targetId);

/** عُقَد الأعضاء الأحرار — قد تتكرر بين أسرة ولجنة، والتكرار يُحذف بـ buildMosqueGraph */
function freeMemberNodes(links: { memberKind: MemberKind; memberId: number; name: string }[]): GraphNode[] {
  return links
    .filter((link) => link.memberKind === "member")
    .map((link) => ({ id: memberNodeId("member", link.memberId), type: "member" as const, label: link.name, meta: {} }));
}

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

/** الأسر: جامع ← أسرة ← أفرادها (طلاب بعُقَد التسجيل، وأعضاء أحرار) — فقط إن كانت الميزة مفعّلة */
const familiesSource: GraphSource = async (mosqueId) => {
  if (!(await isFeatureEnabled(mosqueId, "families"))) return { nodes: [], edges: [] };
  const [families, links] = await Promise.all([listFamilies(mosqueId), listFamilyMemberLinks(mosqueId)]);
  return {
    nodes: [
      ...families.map((family) => ({
        id: familyNodeId(family.id),
        type: "family" as const,
        label: family.name,
        meta: { leader: family.leaderName, memberCount: family.memberCount },
      })),
      ...freeMemberNodes(links),
    ],
    edges: [
      ...families.map((family) => ({ source: mosqueNodeId(mosqueId), target: familyNodeId(family.id), kind: "family" })),
      ...links.map((link) => ({
        source: familyNodeId(link.familyId),
        target: memberNodeId(link.memberKind, link.memberId),
        kind: "family-member",
      })),
    ],
  };
};

/** اللجان: جامع ← لجنة ← أعضاؤها (الدور على الحافّة لا العقدة) — فقط إن كانت الميزة مفعّلة */
const committeesSource: GraphSource = async (mosqueId) => {
  if (!(await isFeatureEnabled(mosqueId, "committees"))) return { nodes: [], edges: [] };
  const [committees, links] = await Promise.all([listCommittees(mosqueId), listCommitteeMemberLinks(mosqueId)]);
  return {
    nodes: [
      ...committees.map((committee) => ({
        id: committeeNodeId(committee.id),
        type: "committee" as const,
        label: committee.name,
        meta: { memberCount: committee.memberCount },
      })),
      ...freeMemberNodes(links),
    ],
    edges: [
      ...committees.map((committee) => ({
        source: mosqueNodeId(mosqueId),
        target: committeeNodeId(committee.id),
        kind: "committee",
      })),
      ...links.map((link) => ({
        source: committeeNodeId(link.committeeId),
        target: memberNodeId(link.memberKind, link.memberId),
        kind: "committee-member",
      })),
    ],
  };
};

/** الأوسمة: وسام ← كل هدف مُنح له — فقط إن كانت الميزة مفعّلة */
const badgesSource: GraphSource = async (mosqueId) => {
  if (!(await isFeatureEnabled(mosqueId, "badges"))) return { nodes: [], edges: [] };
  const [badges, awards] = await Promise.all([listBadges(mosqueId), listBadgeAwardLinks(mosqueId)]);
  return {
    nodes: badges.map((badge) => ({
      id: badgeNodeId(badge.id),
      type: "badge" as const,
      label: `${badge.icon} ${badge.name}`,
      meta: { awarded: badge.awardCount },
    })),
    edges: awards.map((award) => ({
      source: badgeNodeId(award.badgeId),
      target: badgeTargetNodeId(award.targetKind, award.targetId),
      kind: "badge",
    })),
  };
};

export const GRAPH_SOURCES: readonly GraphSource[] = [
  mosqueSource,
  halaqatSource,
  registrationsSource,
  featuresSource,
  notesSource,
  familiesSource,
  committeesSource,
  badgesSource,
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
  if (byType("family").length > 0) lines.push(`الأسر: ${byType("family").length}`);
  if (byType("committee").length > 0) lines.push(`اللجان: ${byType("committee").length}`);
  if (byType("badge").length > 0) lines.push(`الأوسمة: ${byType("badge").length}`);

  if (halaqahs.length > 0) {
    lines.push("", "الحلقات:");
    for (const halaqah of halaqahs) {
      const detail = halaqah.meta.error ? "تعذّر جلب الطلاب من نظام المعلّم" : `${halaqah.meta.studentCount} طالب`;
      lines.push(`- ${halaqah.label} — المعلم: ${halaqah.meta.teacherName} — ${detail}`);
    }
  }
  return lines.join("\n");
}
