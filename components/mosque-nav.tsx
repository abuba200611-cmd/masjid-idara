import type { ReactNode } from "react";
import { BrainIcon, HomeIcon, SettingsIcon, ShieldIcon } from "./icons";

export type NavItem = { href: string; label: string; icon: ReactNode; active?: boolean };

/**
 * عناصر سايدبار الجامع المشتركة بين صفحات /mosque/[id] — عنصر كل ميزة
 * ذات صفحات (حالياً: الدماغ) يظهر فقط إن كانت مفعّلة لهذا الجامع،
 * والإعدادات دائماً. لإضافة ميزة جديدة بسايدبار: سطرها هنا + صفحاتها.
 */
export function mosqueNavItems(opts: {
  mosqueId: number;
  mosqueName: string;
  features: Record<string, boolean>;
  isSuper: boolean;
  activeHref?: string;
  /** عنصر إضافي للسياق الحالي (مثل الحلقة المفتوحة) — يُدرج قبل الإعدادات */
  extra?: NavItem;
}): NavItem[] {
  const { mosqueId, mosqueName, features, isSuper, activeHref, extra } = opts;
  const items: NavItem[] = [];

  if (isSuper) items.push({ href: "/", label: "كل الجوامع", icon: <HomeIcon /> });

  items.push({
    href: `/mosque/${mosqueId}`,
    label: mosqueName,
    icon: <ShieldIcon />,
    active: activeHref === `/mosque/${mosqueId}`,
  });

  if (features.brain) {
    items.push({
      href: `/mosque/${mosqueId}/brain`,
      label: "الدماغ",
      icon: <BrainIcon />,
      active: activeHref === `/mosque/${mosqueId}/brain`,
    });
  }

  if (extra) items.push(extra);

  items.push({
    href: `/mosque/${mosqueId}/settings`,
    label: "الإعدادات",
    icon: <SettingsIcon />,
    active: activeHref === `/mosque/${mosqueId}/settings`,
  });

  return items;
}
