import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/*
  "server-only" يرمي عمداً خارج حزم Next.js لمنع تسرّب كود الخادم للعميل —
  هذا يفشل تحت Vitest (بيئة Node عادية لا Next). نستبدله باستيراد فارغ،
  ونحاكي next/headers بنفس الطريقة لأن كوابس الجلسة لا تحتاجها بالاختبار.
  "@" يطابق مسارات tsconfig حتى تُحمَّل ملفات التطبيق (app/ و lib/) كما هي.
*/
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./lib/test/empty.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
