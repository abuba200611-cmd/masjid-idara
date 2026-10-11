import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  مسارات /api/mosques/[id]/brain و /api/mosques/[id]/brain/[slug] —
  الصلاحيات وبوابة الميزة والوصلات العكسية ومنطق الإنشاء/التعديل.
  الوصلات العكسية تُحسب من محتوى الملاحظات فعلياً (lib/brain حقيقي).
*/

vi.mock("@/lib/access", () => ({ canAccessMosque: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getMosque: vi.fn(),
  isFeatureEnabled: vi.fn(),
  listBrainNotes: vi.fn(),
  getBrainNote: vi.fn(),
  createBrainNote: vi.fn(),
  updateBrainNote: vi.fn(),
  deleteBrainNote: vi.fn(),
}));

import { GET as LIST, POST } from "../app/api/mosques/[id]/brain/route";
import { DELETE, GET, PUT } from "../app/api/mosques/[id]/brain/[slug]/route";
import { canAccessMosque } from "@/lib/access";
import {
  createBrainNote,
  deleteBrainNote,
  getBrainNote,
  getMosque,
  isFeatureEnabled,
  listBrainNotes,
  updateBrainNote,
} from "@/lib/db";
import type { BrainNote } from "@/lib/db";

const plan: BrainNote = {
  id: 1,
  mosqueId: 1,
  slug: "خطة-الحلقات",
  title: "خطة الحلقات",
  body: "التفاصيل في [[المراجعة الأسبوعية]]",
  tags: ["خطة"],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
};
const review: BrainNote = {
  ...plan,
  id: 2,
  slug: "المراجعة-الأسبوعية",
  title: "المراجعة الأسبوعية",
  body: "كل خميس",
};

function ctx(slug = "خطة-الحلقات", id = "1") {
  return { params: Promise.resolve({ id, slug }) };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(canAccessMosque).mockResolvedValue(true);
  vi.mocked(getMosque).mockResolvedValue({ id: 1, name: "جامع النور", city: "", createdAt: "" });
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.mocked(listBrainNotes).mockResolvedValue([plan, review]);
  vi.mocked(getBrainNote).mockResolvedValue(plan);
});

describe("بوابة الصلاحية والميزة", () => {
  it("مدير جامع آخر أو زائر = 401 (القائمة والتفاصيل)", async () => {
    vi.mocked(canAccessMosque).mockResolvedValue(false);
    expect((await LIST(new Request("http://localhost"), ctx())).status).toBe(401);
    expect((await GET(new Request("http://localhost"), ctx())).status).toBe(401);
  });

  it("تعطيل ميزة الدماغ = 404 لكل مساراته حتى مع الصلاحية", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    expect((await LIST(new Request("http://localhost"), ctx())).status).toBe(404);
    expect((await GET(new Request("http://localhost"), ctx())).status).toBe(404);
    expect(
      (await PUT(jsonRequest("http://localhost", "PUT", { title: "جديد" }), ctx())).status,
    ).toBe(404);
    expect((await DELETE(new Request("http://localhost"), ctx())).status).toBe(404);
  });
});

describe("GET/POST /api/mosques/[id]/brain", () => {
  it("القائمة تعيد ملاحظات الجامع", async () => {
    const res = await LIST(new Request("http://localhost"), ctx());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notes: BrainNote[] };
    expect(data.notes.map((note) => note.slug)).toEqual([plan.slug, review.slug]);
  });

  it("إنشاء بدون عنوان = 400", async () => {
    const res = await POST(jsonRequest("http://localhost", "POST", { title: "  " }), ctx());
    expect(res.status).toBe(400);
  });

  it("إنشاء: السَلَغ يُشتق من العنوان و201", async () => {
    vi.mocked(createBrainNote).mockImplementation(async (_mosqueId, note) => ({
      ...plan,
      slug: note.slug,
      title: note.title,
    }));
    const res = await POST(
      jsonRequest("http://localhost", "POST", { title: "قواعد السلوك", body: "نص", tags: ["تنظيم", "تنظيم", ""] }),
      ctx(),
    );
    expect(res.status).toBe(201);
    expect(createBrainNote).toHaveBeenCalledWith(1, {
      slug: "قواعد-السلوك",
      title: "قواعد السلوك",
      body: "نص",
      tags: ["تنظيم"],
    });
  });

  it("تعارض السَلَغ = 409", async () => {
    vi.mocked(createBrainNote).mockResolvedValue(null);
    const res = await POST(jsonRequest("http://localhost", "POST", { title: plan.title }), ctx());
    expect(res.status).toBe(409);
  });
});

describe("GET /api/mosques/[id]/brain/[slug]", () => {
  it("ملاحظة موجودة: الوصلات العكسية تُحسب من محتوى بقية الملاحظات", async () => {
    vi.mocked(getBrainNote).mockResolvedValue(review);
    const res = await GET(new Request("http://localhost"), ctx(review.slug));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { note: BrainNote; backlinks: { slug: string }[]; slugs: string[] };
    // plan.body يصل إلى [[المراجعة الأسبوعية]] فهي وصلة عكسية لها
    expect(data.backlinks.map((b) => b.slug)).toEqual([plan.slug]);
    expect(data.slugs).toEqual([plan.slug, review.slug]);
  });

  it("ملاحظة غير موجودة = 404", async () => {
    vi.mocked(getBrainNote).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx("غير-موجودة"));
    expect(res.status).toBe(404);
  });
});

describe("PUT/DELETE /api/mosques/[id]/brain/[slug]", () => {
  it("تعديل العنوان يعيد اشتقاق السَلَغ", async () => {
    vi.mocked(updateBrainNote).mockImplementation(async (_m, _id, changes) => ({
      ...plan,
      slug: changes.slug,
      title: changes.title,
    }));
    const res = await PUT(jsonRequest("http://localhost", "PUT", { title: "خطة الحلقات الجديدة" }), ctx());
    expect(res.status).toBe(200);
    expect(updateBrainNote).toHaveBeenCalledWith(
      1,
      plan.id,
      expect.objectContaining({ slug: "خطة-الحلقات-الجديدة", title: "خطة الحلقات الجديدة", body: plan.body }),
    );
  });

  it("سَلَغ جديد محجوز = 409", async () => {
    vi.mocked(updateBrainNote).mockResolvedValue(null);
    const res = await PUT(jsonRequest("http://localhost", "PUT", { title: review.title }), ctx());
    expect(res.status).toBe(409);
  });

  it("حذف ملاحظة موجودة = ok", async () => {
    const res = await DELETE(new Request("http://localhost"), ctx());
    expect(res.status).toBe(200);
    expect(deleteBrainNote).toHaveBeenCalledWith(1, plan.id);
  });

  it("حذف غير الموجودة = 404", async () => {
    vi.mocked(getBrainNote).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), ctx("غير-موجودة"));
    expect(res.status).toBe(404);
  });
});
