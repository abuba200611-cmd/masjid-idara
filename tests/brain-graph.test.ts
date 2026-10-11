import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Halaqah, PendingStudent } from "@/lib/db";

/*
  buildMosqueGraph: عُقَد/حوافّ من بيانات الجامع الفعلية (db ونظام المعلّم
  مُحاكيان)، تسامح مع فشل قائمة حلقة، وعزل بيانات الجوامع، ونص السياق.
*/

vi.mock("@/lib/db", () => ({
  getMosque: vi.fn(),
  getMosqueFeatures: vi.fn(),
  listBrainNotes: vi.fn(),
  listHalaqahs: vi.fn(),
  listPendingStudents: vi.fn(),
}));
vi.mock("@/lib/teacher-app", () => ({ fetchHalaqahRoster: vi.fn() }));

import { buildGraphContext, buildMosqueGraph } from "@/lib/brain-graph";
import { getMosque, getMosqueFeatures, listBrainNotes, listHalaqahs, listPendingStudents } from "@/lib/db";
import { fetchHalaqahRoster } from "@/lib/teacher-app";

const halaqah = (id: number, name: string, code: string): Halaqah => ({
  id,
  mosqueId: 1,
  halaqahName: name,
  teacherName: `معلم ${name}`,
  inviteCode: code,
  createdAt: "",
});
const pending = (id: number, status: PendingStudent["status"], halaqahId: number | null): PendingStudent => ({
  id,
  mosqueId: 1,
  name: `طالب ${id}`,
  phone: "",
  status,
  halaqahId,
  createdAt: "",
  assignedAt: null,
});
const student = (name: string) => ({ name, group: "", pages: 0, avgMastery: 0, active: true });
const note = (slug: string, body: string) => ({
  id: 1,
  mosqueId: 1,
  slug,
  title: slug,
  body,
  tags: [],
  createdAt: "",
  updatedAt: "",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMosque).mockResolvedValue({ id: 1, name: "جامع النور", city: "جدة", createdAt: "" });
  vi.mocked(listHalaqahs).mockResolvedValue([halaqah(10, "الفجر", "A"), halaqah(11, "العصر", "B")]);
  vi.mocked(listPendingStudents).mockResolvedValue([]);
  vi.mocked(listBrainNotes).mockResolvedValue([]);
  vi.mocked(getMosqueFeatures).mockResolvedValue([
    { key: "halaqat", nameAr: "الحلقات", descriptionAr: "", defaultEnabled: true, status: "ready", enabled: true },
    { key: "stats", nameAr: "الإحصائيات", descriptionAr: "", defaultEnabled: true, status: "ready", enabled: false },
    { key: "families", nameAr: "الأسر", descriptionAr: "", defaultEnabled: false, status: "soon", enabled: true },
  ]);
  vi.mocked(fetchHalaqahRoster).mockImplementation(async (code) => ({
    teacherName: `أ. ${code}`,
    halaqahName: code,
    students: code === "A" ? [student("أحمد"), student("بلال")] : [student("سعد")],
  }));
});

describe("buildMosqueGraph", () => {
  it("جامع ← حلقات ← معلم وطلاب، والمزايا المفعّلة الجاهزة فقط", async () => {
    const graph = await buildMosqueGraph(1);
    const count = (type: string) => graph.nodes.filter((n) => n.type === type).length;

    expect(count("mosque")).toBe(1);
    expect(count("halaqah")).toBe(2);
    expect(count("teacher")).toBe(2);
    expect(count("student")).toBe(3);
    expect(graph.nodes.filter((n) => n.type === "feature").map((n) => n.label)).toEqual(["الحلقات"]);
    // 2 حلقة + 2 معلم + 3 طلاب + ميزة واحدة
    expect(graph.edges).toHaveLength(8);
    expect(graph.nodes.find((n) => n.id === "teacher:10")?.label).toBe("أ. A");
  });

  it("فشل جلب قائمة حلقة لا يرمي: تبقى العقدة وعليها meta.error", async () => {
    vi.mocked(fetchHalaqahRoster).mockImplementation(async (code) => {
      if (code === "A") throw new Error("down");
      return null;
    });
    const graph = await buildMosqueGraph(1);
    expect(graph.nodes.find((n) => n.id === "halaqah:10")?.meta.error).toBe(true);
    expect(graph.nodes.find((n) => n.id === "halaqah:11")?.meta.error).toBe(true);
    expect(graph.nodes.some((n) => n.type === "student")).toBe(false);
  });

  it("طلبات التسجيل: المعلّقة على المحور، والموزَّعة بحلقتها، وحلقة جامع آخر تُهمَل", async () => {
    vi.mocked(listPendingStudents).mockResolvedValue([
      pending(1, "pending", null),
      pending(2, "assigned", 10),
      pending(3, "assigned", 999),
    ]);
    const graph = await buildMosqueGraph(1);
    const edge = (target: string) => graph.edges.find((e) => e.target === target);

    expect(graph.nodes.find((n) => n.id === "pending-hub")?.label).toBe("طلبات التسجيل");
    expect(edge("pending:1")?.source).toBe("pending-hub");
    expect(edge("pending:2")?.source).toBe("halaqah:10");
    // الحلقة 999 ليست من هذا الجامع: لا حافة معلّقة بعقدة غير موجودة
    expect(edge("pending:3")).toBeUndefined();
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("كل الاستعلامات تُقيَّد بمعرّف الجامع المطلوب", async () => {
    await buildMosqueGraph(1);
    for (const fn of [listHalaqahs, listPendingStudents, listBrainNotes, getMosqueFeatures]) {
      expect(fn).toHaveBeenCalledWith(1);
    }
  });

  it("ملاحظات قديمة: تُربط بوصلات [[..]] الموجودة فقط", async () => {
    vi.mocked(listBrainNotes).mockResolvedValue([note("أ", "راجع [[ب]] و[[غائبة]]"), note("ب", "")]);
    const graph = await buildMosqueGraph(1);
    expect(graph.edges.filter((e) => e.kind === "link")).toEqual([
      { source: "note:أ", target: "note:ب", kind: "link" },
    ]);
  });
});

describe("buildGraphContext", () => {
  it("ملخص عربي بالأعداد وكل حلقة بمعلمها وعدد طلابها", async () => {
    vi.mocked(listPendingStudents).mockResolvedValue([pending(1, "pending", null), pending(2, "assigned", 10)]);
    const text = buildGraphContext(await buildMosqueGraph(1));

    expect(text).toContain("الجامع: جامع النور");
    expect(text).toContain("عدد الحلقات: 2");
    expect(text).toContain("عدد الطلاب: 3");
    expect(text).toContain("طلبات التسجيل: 2 (بانتظار التوزيع: 1)");
    expect(text).toContain("المزايا المفعّلة: الحلقات");
    expect(text).toContain("- الفجر — المعلم: أ. A — 2 طالب");
    expect(text).toContain("- العصر — المعلم: أ. B — 1 طالب");
  });
});
