"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HomeIcon, LogoutIcon } from "./icons";

type NavItem = { href: string; label: string; icon: ReactNode; active?: boolean };

/**
 * قالب لوحة SaaS: سايدبار أيقونات + شريط علوي بعنوان الصفحة، مستقل تماماً
 * عن شاشات الدخول والتسجيل العام (تلك تبقى بسيطة بلا هذا الإطار — طلب
 * المستخدم إبقاء "نظام الجامع" (التسجيل العام) و"نظام الإدارة" (هذي
 * اللوحة) منفصلين شكلياً، كل واحد بطابعه الخاص).
 */
export function DashboardShell({
  nav,
  title,
  subtitle,
  userLabel,
  onLogout,
  children,
}: {
  nav: NavItem[];
  title: string;
  subtitle?: string;
  userLabel?: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-l border-border bg-surface py-5">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-naskh text-sm font-bold text-on-primary">
          ج
        </div>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
              item.active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.icon}
          </Link>
        ))}
        <button
          onClick={onLogout}
          title="خروج"
          className="mt-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogoutIcon />
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-border bg-surface px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <h1 className="font-naskh text-xl font-bold text-foreground">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            {userLabel && (
              <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HomeIcon className="h-3.5 w-3.5" />
                </span>
                {userLabel}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
