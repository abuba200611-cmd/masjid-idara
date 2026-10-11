"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { DashboardShell } from "@/components/shell";
import { mosqueNavItems } from "@/components/mosque-nav";
import { BrainIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { BrainEditor, type BrainEditorDraft } from "@/components/brain-editor";
import { BrainGraph } from "@/components/brain-graph";

type Mosque = { id: number; name: string; city: string };
type Note = { id: number; slug: string; title: string; body: string; tags: string[]; updatedAt: string };
type Role = "super" | "mosque" | null;

/** دماغ الجامع — قائمة الملاحظات (بحث + وسوم) وخريطة معرفة، وإنشاء ملاحظة */
export default function BrainPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mosqueId = Number(params.id);

  const [role, setRole] = useState<Role | "checking">("checking");
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [featuresMap, setFeaturesMap] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Note[] | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");
  const [creating, setCreating] = useState(false);

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

  const loadNotes = useCallback(() => {
    fetch(`/api/mosques/${mosqueId}/brain`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { notes: Note[] } | null) => setNotes(d?.notes ?? null))
      .catch(() => setNotes(null));
  }, [mosqueId]);

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
    loadNotes();
  }, [role, mosqueId, loadNotes]);

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
  if (notes === undefined || !mosque) return <Empty title="جارٍ التحميل…" />;
  if (notes === null) {
    return (
      <DashboardShell
        nav={mosqueNavItems({
          mosqueId,
          mosqueName: mosque.name,
          features: featuresMap,
          isSuper: role === "super",
          activeHref: `/mosque/${mosqueId}/brain`,
        })}
        title="الدماغ"
        subtitle={mosque.name}
        userLabel={role === "super" ? "المشرف العام" : "مدير الجامع"}
        onLogout={logout}
      >
        <Empty
          title="الدماغ غير مفعّل لهذا الجامع."
          action={
            <Link
              href={`/mosque/${mosqueId}/settings`}
              className="text-sm text-primary hover:underline"
            >
              تفعيله من الإعدادات
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  const allTags = [...new Set(notes.flatMap((note) => note.tags))].sort();
  const needle = query.trim().toLowerCase();
  const visible = notes.filter((note) => {
    const matchesTag = !activeTag || note.tags.includes(activeTag);
    const matchesQuery =
      !needle ||
      note.title.toLowerCase().includes(needle) ||
      note.slug.toLowerCase().includes(needle) ||
      note.body.toLowerCase().includes(needle);
    return matchesTag && matchesQuery;
  });

  async function createNote(draft: BrainEditorDraft): Promise<string | null> {
    const res = await fetch(`/api/mosques/${mosqueId}/brain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const d = (await res.json().catch(() => ({}))) as { note?: Note; error?: string };
    if (!res.ok || !d.note) return d.error ?? "تعذّر الإنشاء";
    router.push(`/mosque/${mosqueId}/brain/${encodeURIComponent(d.note.slug)}`);
    return null;
  }

  return (
    <DashboardShell
      nav={mosqueNavItems({
        mosqueId,
        mosqueName: mosque.name,
        features: featuresMap,
        isSuper: role === "super",
        activeHref: `/mosque/${mosqueId}/brain`,
      })}
      title="الدماغ"
      subtitle={mosque.name}
      userLabel={role === "super" ? "المشرف العام" : "مدير الجامع"}
      onLogout={logout}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالعنوان أو المحتوى…"
              className="w-full rounded-xl border border-border bg-background py-2 pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
          <Button variant={view === "graph" ? "primary" : "ghost"} onClick={() => setView(view === "graph" ? "list" : "graph")}>
            {view === "graph" ? "قائمة" : "خريطة"}
          </Button>
          <Button onClick={() => setCreating(true)}>
            <span className="flex items-center gap-1">
              <PlusIcon className="h-4 w-4" />
              ملاحظة جديدة
            </span>
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-colors duration-200 ${
                  activeTag === tag ? "bg-primary text-on-primary" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {creating && (
          <BrainEditor
            mosqueId={mosqueId}
            existingSlugs={new Set(notes.map((note) => note.slug))}
            initial={{}}
            submitLabel="إنشاء"
            onSubmit={createNote}
            onCancel={() => setCreating(false)}
          />
        )}

        {view === "graph" ? (
          visible.length === 0 ? (
            <Empty title="ما فيه ملاحظات تطابق ما تبحث عنه." />
          ) : (
            <BrainGraph
              notes={visible}
              onOpen={(slug) => router.push(`/mosque/${mosqueId}/brain/${encodeURIComponent(slug)}`)}
            />
          )
        ) : visible.length === 0 ? (
          <Empty
            title={notes.length === 0 ? "دماغ الجامع فارغ بعد — أنشئ أول ملاحظة." : "ما فيه ملاحظات تطابق ما تبحث عنه."}
            action={
              notes.length === 0 ? (
                <Button onClick={() => setCreating(true)}>
                  <span className="flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" />
                    ملاحظة جديدة
                  </span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-2">
            {visible.map((note) => (
              <li key={note.id}>
                <Link href={`/mosque/${mosqueId}/brain/${encodeURIComponent(note.slug)}`}>
                  <Card className="p-3 transition-shadow duration-200 hover:shadow-[0_4px_14px_rgba(19,78,74,0.08)]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BrainIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{note.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {note.body.replace(/\[\[|\]\]/g, "").slice(0, 90) || "فارغة"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.updatedAt).toLocaleDateString("ar")}
                        </span>
                        {note.tags.length > 0 && (
                          <span className="flex gap-1">
                            {note.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag}>{tag}</Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
