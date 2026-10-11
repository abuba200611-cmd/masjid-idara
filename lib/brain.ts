/*
  الدماغ — دوال صرفة (بلا خادم ولا قاعدة بيانات) يشاركها العميل وسكربت
  الاستيراد والاختبارات: سَلَغة عربية آمنة، تحليل وصلات [[المزدوجة]]،
  مُصيِّغ ماركداون بسيط يهرّب HTML أولاً ثم يصيّغ، وتحليل ملفات الاستيراد.
*/

/** سَلَغ عربي آمن: يُبقي الحروف (عربية/لاتينية) والأرقام، والفراغات شرَطات */
export function slugify(input: string): string {
  return input
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** كل الوصلات الداخلية [[عنوان]] أو [[سَلَغ]] في نص — سَلَغات فريدة بترتيب الظهور */
export function parseLinks(body: string): string[] {
  const slugs: string[] = [];
  for (const match of body.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const slug = slugify(match[1]);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

// ————— مُصيِّغ الماركداون —————

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenderMarkdownOptions = {
  /** سالَغات الملاحظات الموجودة — وصلتها عادية، وغير الموجودة تظهر حمراء تُنشأ بالضغط */
  existingSlugs: ReadonlySet<string>;
  /** رابط ملاحظة (موجودة أو تُنشأ عند فتحها) */
  hrefFor: (slug: string) => string;
};

/** تنسيق سطر واحد: الوصلات الداخلية أولاً ثم `الكود` ثم **العريض** ثم الروابط الخارجية */
function renderInline(escaped: string, opts: RenderMarkdownOptions): string {
  let html = escaped;

  // [[وصلة داخلية]] — قبل الروابط الخارجية حتى لا تتداخل صيغتاهما
  html = html.replace(/\[\[([^\[\]]+)\]\]/g, (_all, raw: string) => {
    const slug = slugify(raw);
    const label = raw.trim() || slug;
    const cls = opts.existingSlugs.has(slug) ? "brain-link" : "brain-link brain-link-missing";
    return `<a class="${cls}" href="${escapeHtml(opts.hrefFor(slug))}">${label}</a>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

  return html;
}

/**
 * ماركداون بسيط وآمن: يهرّب HTML أولاً (فلا يعمل أي <script>) ثم يصيّغ
 * العناوين (#..###) والقوائم والفقرات والوصلات الداخلية والخارجية.
 * # تصير <h2> لأن عنوان الملاحظة نفسه هو الأكبر بالصفحة.
 */
export function renderMarkdown(body: string, opts: RenderMarkdownOptions): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${item}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length + 1;
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2]), opts)}</h${level}>`);
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    const olMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    const listMatch = ulMatch ?? olMatch;
    if (listMatch) {
      const type = ulMatch ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(renderInline(escapeHtml(listMatch[1]), opts));
      continue;
    }

    flushList();
    out.push(`<p>${renderInline(escapeHtml(trimmed), opts)}</p>`);
  }
  flushList();

  return out.join("\n");
}

// ————— تحليل ملفات الاستيراد (mosques-data/<جامع>/*.md) —————

export type ParsedNote = { title: string; slug: string; tags: string[]; body: string };

/**
 * ملف .md واحد إلى ملاحظة: العنوان من أول سطر "# " أو من اسم الملف،
 * والوسوم من سطر "tags: أ، ب" أول الملف (يُحذف من المحتوى)، والباقي
 * محتوى كما هو.
 */
export function parseNoteFile(filename: string, content: string): ParsedNote {
  let body = content.replace(/\r\n/g, "\n");
  let tags: string[] = [];

  const lines = body.split("\n");
  const first = lines.findIndex((line) => line.trim());
  if (first !== -1) {
    const tagsMatch = /^tags:\s*(.*)$/.exec(lines[first].trim());
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(/[,،]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      lines.splice(first, 1);
      body = lines.join("\n");
    }
  }

  const heading = /^#\s+(.+)$/m.exec(body);
  const title = (heading?.[1] ?? filename.replace(/\.md$/i, "")).trim();

  return { title, slug: slugify(title), tags, body: body.trim() };
}
