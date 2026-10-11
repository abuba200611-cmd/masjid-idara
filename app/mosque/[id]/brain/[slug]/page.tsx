"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { DashboardShell } from "@/components/shell";
import { mosqueNavItems } from "@/components/mosque-nav";
import { renderMarkdown } from "@/lib/brain";
import { BrainEditor, type BrainEditorDraft } from "@/components/brain-editor";

type Mosque = { id: number; name: string; city: string };
type Note = { id: number; slug: string; title: string; body: string; tags: string[]; updatedAt: string };
type Backlink = { slug: string; title: string };
type Role = "super" | "mosque" | null;

type Phase = "ready" | "missing" | "error";
type NoteResult =
  | { phase: "ready"; note: Note; backlinks: Backlink[]; slugs: string[] }
  | { phase: "missing" }
  | { phase: "error" };

/** جلب ملاحظة + وصلاتها العكسية — بلا حالة، لتُستعمل من التأثير ومن الحفظ */
async function fetchNote(mosqueId: number, slug: string): Promise<NoteResult> {
  try {
    const res = await fetch(`/api/mosques/${mosqueId}/brain/${encodeURIComponent(slug)}`);
    if (res.status === 404) return { phase: "missing" };
    if (!res.ok) return { phase: "error" };
    const d = (await res.json()) as { note: Note; backlinks: Backlink[]; slugs: string[] };
    return { phase: "ready", note: d.note, backlinks: d.backlinks, slugs: d.slugs };
  } catch {
    return { phase: "error" };
  }
}

/** ملاحظة واحدة: عرض ماركداون آمن + وصلات عكسية + تحرير/حذف — أو إنشاؤها إن لم توجد */
export default function BrainNotePage() {
  const params = useParams<{ id: string; slug: string }>();
  const router = useRouter();
  const mosqueId = Number(params.id);
  const slug = String(params.slug);

  const [role, setRole] = useState<Role | "checking">("checking");
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [featuresMap, setFeaturesMap] = useState<Record<string, boolean>>({});
  // loadedSlug يفرّق بين "بيانات سَلَغ سابق" و"بيانات السَلَغ المعروض"
  const [phase, setPhase] = useState<Phase | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [editingForSlug, setEditingForSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // وضع التحرير مرتبط بالسَلَغ — التنقل لملاحظة أخرى يخرج منه تلقائياً
  const editing = editingForSlug === slug;

  useEffect(() => {
    async function check() {
      const superRes = await fetch("/api/admin/me").then((r) => r.json());
      if (superRes.admin) {
        setRole("super");
        return;
      }
      const mosqueRes = await fetch("/api/mosque-admin/me").then((r) => r.json());
      setRole(mosqueRes.admin && mosqueRes.admin.mosqueId === mosqueId ? "mosque" : null);
    }
    check().catch(() => setRole(null));
  }, [mosqueId]);

  async function logout() {
    await fetch(role === "mosque" ? "/api/mosque-admin/logout" : "/api/admin/logout", { method: "POST" });
    setRole(null);
  }

  useEffect(() => {
    if (role !== "super" && role !== "mosque") return;
    fetch(`/api/mosques/${mosqueId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { mosque: Mosque; features: Record<string, boolean> } | null) => {
        if (d) {
          setMosque(d.mosque);
          setFeaturesMap(d.features);
        }
      })
      .catch(() => undefined);
  }, [role, mosqueId]);

  function applyResult(result: NoteResult, forSlug: string) {
    setPhase(result.phase);
    setLoadedSlug(forSlug);
    if (result.phase === "ready") {
      setNote(result.note);
      setBacklinks(result.backlinks);
      setSlugs(result.slugs);
    }
  }

  useEffect(() => {
    if (role !== "super" && role !== "mosque") return;
    fetchNote(mosqueId, slug).then((result) => applyResult(result, slug));
  }, [role, mosqueId, slug]);

  if (role === "checking") return <Empty title="جارٍ التحقق…" />;
  if (!role) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 text-center">
        <p className="mb-3 text-sm text-muted-foreground">سجّل دخولك أولاً.</p>
        <div className="flex justify-center gap-4">
          <Link href="/" className="text-sm text-primary hover:underline">
            دخول المشرف العام
          </Link>
          <Link href="/mosque-login" className="text-sm text-primary hover:underline">
            دخول مدير الجامع
          </Link>
        </div>
      </main>
    );
  }
  if (!mosque || phase === null || loadedSlug !== slug) return <Empty title="جارٍ التحميل…" />;
  if (phase === "error") return <Empty title="تعذّر جلب الملاحظة — حاول مرة أخرى." />;

  function hrefFor(targetSlug: string) {
    return `/mosque/${mosqueId}/brain/${encodeURIComponent(targetSlug)}`;
  }

  async function saveEdit(draft: BrainEditorDraft): Promise<string | null> {
    const res = await fetch(`/api/mosques/${mosqueId}/brain/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const d = (await res.json().catch(() => ({}))) as { note?: Note; error?: string };
    if (!res.ok || !d.note) return d.error ?? "تعذّر الحفظ";
    setEditingForSlug(null);
    if (d.note.slug !== slug) {
      router.replace(hrefFor(d.note.slug));
    } else {
      applyResult(await fetchNote(mosqueId, slug), slug);
    }
    return null;
  }

  async function createMissing(draft: BrainEditorDraft): Promise<string | null> {
    const res = await fetch(`/api/mosques/${mosqueId}/brain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const d = (await res.json().catch(() => ({}))) as { note?: Note; error?: string };
    if (!res.ok || !d.note) return d.error ?? "تعذّر الإنشاء";
    router.replace(hrefFor(d.note.slug));
    return null;
  }

  async function remove() {
    if (!note || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/mosques/${mosqueId}/brain/${encodeURIComponent(slug)}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/mosque/${mosqueId}/brain`);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(d.error ?? "تعذّر الحذف");
    } finally {
      setDeleting(false);
    }
  }

  const nav = mosqueNavItems({
    mosqueId,
    mosqueName: mosque.name,
    features: featuresMap,
    isSuper: role === "super",
    activeHref: `/mosque/${mosqueId}/brain`,
  });

  if (phase === "missing") {
    return (
      <DashboardShell
        nav={nav}
        title="ملاحظة غير موجودة"
        subtitle={mosque.name}
        userLabel={role === "super" ? "المشرف العام" : "مدير الجامع"}
        onLogout={logout}
      >
        <div className="space-y-4">
          <Empty title="ما فيه ملاحظة بهذا العنوان — أنشئها الآن أو عد للقائمة." />
          <BrainEditor
            mosqueId={mosqueId}
            existingSlugs={new Set(slugs)}
            initial={{ title: slug.replace(/-/g, " ") }}
            submitLabel="إنشاء"
            onSubmit={createMissing}
          />
        </div>
      </DashboardShell>
    );
  }

  if (!note) return <Empty title="جارٍ التحميل…" />;

  return (
    <DashboardShell
      nav={nav}
      title={note.title}
      subtitle={`آخر تحديث: ${new Date(note.updatedAt).toLocaleDateString("ar")}`}
      userLabel={role === "super" ? "المشرف العام" : "مدير الجامع"}
      onLogout={logout}
    >
      <div className="space-y-4">
        {editing ? (
          <BrainEditor
            mosqueId={mosqueId}
            existingSlugs={new Set(slugs)}
            initial={{ title: note.title, body: note.body, tags: note.tags }}
            submitLabel="حفظ"
            onSubmit={saveEdit}
            onCancel={() => setEditingForSlug(null)}
          />
        ) : (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {note.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditingForSlug(slug)}>تعديل</Button>
                <Button variant="danger" onClick={remove} disabled={deleting}>
                  {deleting ? "لحظة…" : "حذف"}
                </Button>
              </div>
            </div>
            {note.body.trim() ? (
              <div
                className="brain-body"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(note.body, { existingSlugs: new Set(slugs), hrefFor }),
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">ملاحظة فارغة — اضغط تعديل لكتابة محتواها.</p>
            )}
          </Card>
        )}

        {backlinks.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">وصلات عكسية ({backlinks.length})</h2>
            <ul className="space-y-1">
              {backlinks.map((backlink) => (
                <li key={backlink.slug}>
                  <Link href={hrefFor(backlink.slug)} className="text-sm text-primary hover:underline">
                    {backlink.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
