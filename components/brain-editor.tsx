"use client";

import { useState } from "react";
import { Button, Card } from "./ui";
import { renderMarkdown } from "@/lib/brain";

export type BrainEditorDraft = { title: string; body: string; tags: string[] };

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * محرّر ملاحظة الدماغ: عنوان + وسوم + نص ماركداون مع معاينة حية.
 * الحفظ يبقى عند الصفحة المستدعية — المحرّر لا يعرف شيئاً عن الـ API.
 */
export function BrainEditor({
  mosqueId,
  existingSlugs,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  mosqueId: number;
  existingSlugs: ReadonlySet<string>;
  initial: Partial<BrainEditorDraft>;
  submitLabel: string;
  onSubmit: (draft: BrainEditorDraft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join("، "));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function hrefFor(slug: string) {
    return `/mosque/${mosqueId}/brain/${encodeURIComponent(slug)}`;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const tags = tagsInput
      .split(/[,،]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      const message = await onSubmit({ title: title.trim(), body, tags });
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الملاحظة"
          required
          className={inputClass}
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="وسوم مفصولة بفاصلة (اختياري)"
          className={inputClass}
        />
        {preview ? (
          <div className="brain-body min-h-56 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            {body.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body, { existingSlugs, hrefFor }) }} />
            ) : (
              <p className="text-muted-foreground">لا شيء للمعاينة بعد.</p>
            )}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={"المحتوى (ماركداون) — صِل الملاحظات بوصلة [[عنوان ملاحظة أخرى]]"}
            className={`${inputClass} leading-8`}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || !title.trim()}>
            {busy ? "لحظة…" : submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPreview((p) => !p)}>
            {preview ? "تحرير" : "معاينة"}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              إلغاء
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
