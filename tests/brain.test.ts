import { describe, expect, it } from "vitest";
import { parseLinks, parseNoteFile, renderMarkdown, slugify } from "../lib/brain";

const hrefFor = (slug: string) => `/brain/${encodeURIComponent(slug)}`;

describe("slugify — عربي آمن", () => {
  it("يبقي الحروف العربية والفراغات شرَطات", () => {
    expect(slugify("خطة الحلقات")).toBe("خطة-الحلقات");
    expect(slugify("  المراجعة   الأسبوعية ")).toBe("المراجعة-الأسبوعية");
  });

  it("يبقي اللاتينية والأرقام ويصغّرها، ويحذف الرموز", () => {
    expect(slugify("Ramadan 2026!")).toBe("ramadan-2026");
    expect(slugify("خطة_الحلقات")).toBe("خطة-الحلقات");
  });

  it("نص بلا حروف يعطي سلَغاً فارغاً", () => {
    expect(slugify("///")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("parseLinks — وصلات [[المزدوجة]]", () => {
  it("يستخرج السَلَغات فريدة بترتيب الظهور", () => {
    const body = "راجع [[خطة الحلقات]] ثم [[المراجعة الأسبوعية]] ورجع لـ[[خطة الحلقات]]";
    expect(parseLinks(body)).toEqual(["خطة-الحلقات", "المراجعة-الأسبوعية"]);
  });

  it("يقبل السَلَغ الجاهز كما هو", () => {
    expect(parseLinks("راجع [[خطة-الحلقات]]")).toEqual(["خطة-الحلقات"]);
  });

  it.each(["نص عادي", "[وصلة واحدة]", "[]", "[[]]"])("لا وصلات في %s", (text) => {
    expect(parseLinks(text)).toEqual([]);
  });
});

describe("renderMarkdown — آمن وبسيط", () => {
  const existing = new Set(["موجودة"]);

  it("يهرب <script> فلا يعمل أي HTML داخل النص", () => {
    const html = renderMarkdown('<script>alert("x")</script> **عريض**', { existingSlugs: existing, hrefFor });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>عريض</strong>");
  });

  it("عناوين وقوائم وفقرات", () => {
    const html = renderMarkdown("# العنوان\n\n- بند أول\n- بند ثانٍ\n\nفقرة", {
      existingSlugs: existing,
      hrefFor,
    });
    expect(html).toContain("<h2>العنوان</h2>");
    expect(html).toContain("<ul><li>بند أول</li><li>بند ثانٍ</li></ul>");
    expect(html).toContain("<p>فقرة</p>");
  });

  it("وصلة داخلية: موجودة عادية، ومفقودة حمراء — كلتاهما تفتح صفحة الملاحظة", () => {
    const html = renderMarkdown("راجع [[موجودة]] و[[مفقودة]]", { existingSlugs: existing, hrefFor });
    expect(html).toContain('<a class="brain-link" href="/brain/%D9%85%D9%88%D8%AC%D9%88%D8%AF%D8%A9">موجودة</a>');
    expect(html).toContain('class="brain-link brain-link-missing"');
    expect(html).toContain(">مفقودة</a>");
  });

  it("رابط خارجي http فقط — javascript: لا يصير رابطاً", () => {
    const html = renderMarkdown("[موقع](https://example.com) و[خطر](javascript:alert(1))", {
      existingSlugs: existing,
      hrefFor,
    });
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('href="javascript:');
  });
});

describe("parseNoteFile — ملفات الاستيراد", () => {
  it("العنوان من أول Heading والوسوم من سطر tags: أول الملف", () => {
    const note = parseNoteFile("anything.md", "tags: خطة, أطفال\n\n# خطة الحلقات\n\nالمحتوى");
    expect(note.title).toBe("خطة الحلقات");
    expect(note.slug).toBe("خطة-الحلقات");
    expect(note.tags).toEqual(["خطة", "أطفال"]);
    expect(note.body).not.toContain("tags:");
    expect(note.body).toContain("# خطة الحلقات");
  });

  it("بلا Heading: العنوان من اسم الملف", () => {
    const note = parseNoteFile("قواعد السلوك.md", "tags: تنظيم\nالنص فقط");
    expect(note.title).toBe("قواعد السلوك");
    expect(note.slug).toBe("قواعد-السلوك");
    expect(note.tags).toEqual(["تنظيم"]);
  });

  it("بلا سطر وسوم: بلا وسوم، والمحتوى كما هو", () => {
    const note = parseNoteFile("مذكرة.md", "# مذكرة\nنص");
    expect(note.tags).toEqual([]);
    expect(note.body).toContain("نص");
  });
});
