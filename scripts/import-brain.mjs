#!/usr/bin/env node
/*
  استيراد ملاحظات الدماغ لمجامع من مجلده في mosques-data/<جامع>/ —
  كل ملف .md يصير ملاحظة (upsert بالسَلَغ)، وسطر tags: أول الملف وسوم.

  الاستخدام (متغيرات الاتصال من .env.local):
    node -r dotenv/config scripts/import-brain.mjs mosques-data/<جامع> <mosqueId> dotenv_config_path=.env.local
  أضف --dry-run لتطبع الخطة فقط دون كتابة شيء.
*/

import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseNoteFile } from "../lib/brain.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [folder, mosqueIdRaw] = args.filter((arg) => !arg.startsWith("--"));

const mosqueId = Number(mosqueIdRaw);
if (!folder || !Number.isInteger(mosqueId)) {
  console.error("الاستخدام: node scripts/import-brain.mjs <folder> <mosqueId> [--dry-run]");
  process.exit(1);
}

let files;
try {
  files = (await readdir(folder)).filter((file) => extname(file).toLowerCase() === ".md").sort();
} catch (error) {
  console.error(`تعذّرت قراءة المجلد ${folder}: ${error.message}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error("ما فيه ملفات .md بالمجلد");
  process.exit(1);
}

const parsed = [];
for (const file of files) {
  const content = await readFile(join(folder, file), "utf8");
  parsed.push({ file, ...parseNoteFile(file, content) });
}

// قراءة الحالة الحالية فقط (حتى مع --dry-run: نقرأ لنطبع ما سيتغيّر، ولا نكتب)
const { getDatabase } = await import("@netlify/database");
const db = getDatabase();
const existingRows = await db.sql`SELECT slug, title, body, tags FROM brain_notes WHERE mosque_id = ${mosqueId}`;
const existing = new Map(existingRows.map((row) => [row.slug, row]));

const plan = parsed.map((note) => {
  const current = existing.get(note.slug);
  if (!current) return { ...note, action: "create" };

  const changes = [];
  if (current.title !== note.title) changes.push("العنوان");
  if (current.body !== note.body) changes.push("المحتوى");
  const currentTags = Array.isArray(current.tags) ? current.tags.join("،") : "";
  if (currentTags !== note.tags.join("،")) changes.push("الوسوم");
  return { ...note, action: changes.length > 0 ? `update (${changes.join(" + ")})` : "unchanged" };
});

for (const item of plan) {
  console.log(`${item.action.padEnd(28)} ${item.title}  (${item.file})`);
}

const counts = {
  create: plan.filter((item) => item.action === "create").length,
  update: plan.filter((item) => item.action.startsWith("update")).length,
  unchanged: plan.filter((item) => item.action === "unchanged").length,
};
console.log(`\nالخلاصة: ${counts.create} إنشاء، ${counts.update} تحديث، ${counts.unchanged} بلا تغيير`);

if (dryRun) {
  console.log("--dry-run: لم نكتب شيئاً في القاعدة.");
  process.exit(0);
}

for (const note of plan) {
  if (note.action === "unchanged") continue;
  await db.sql`
    INSERT INTO brain_notes (mosque_id, slug, title, body, tags)
    VALUES (${mosqueId}, ${note.slug}, ${note.title}, ${note.body}, ${note.tags})
    ON CONFLICT (mosque_id, slug) DO UPDATE
    SET title = excluded.title, body = excluded.body, tags = excluded.tags, updated_at = now()
  `;
}
console.log("تم الاستيراد ✓");
