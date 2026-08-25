"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Empty, Stat } from "@/components/ui";
import { DashboardShell } from "@/components/shell";
import { BookIcon, HomeIcon, LinkIcon, ShieldIcon, TrendUpIcon, UsersIcon } from "@/components/icons";

type Mosque = { id: number; name: string; city: string };
type Halaqah = { id: number; halaqahName: string; teacherName: string; inviteCode: string };
type Pending = {
  id: number;
  name: string;
  phone: string;
  status: "pending" | "assigned";
  halaqahId: number | null;
  createdAt: string;
};

type Role = "super" | "mosque" | null;

export default function MosqueDetailPage() {
  const params = useParams<{ id: string }>();
  const mosqueId = Number(params.id);

  const [role, setRole] = useState<Role | "checking">("checking");
  const [data, setData] = useState<{ mosque: Mosque; halaqahs: Halaqah[]; pending: Pending[] } | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    fetch(`/api/mosques/${mosqueId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { mosque: Mosque; halaqahs: Halaqah[]; pending: Pending[] } | null) => setData(d))
      .catch(() => setData(null));
  }

  useEffect(() => {
    async function check() {
      const superRes = await fetch("/api/admin/me").then((r) => r.json());
      if (superRes.admin) {
        setRole("super");
        load();
        return;
      }
      const mosqueRes = await fetch("/api/mosque-admin/me").then((r) => r.json());
      if (mosqueRes.admin && mosqueRes.admin.mosqueId === mosqueId) {
        setRole("mosque");
        load();
        return;
      }
      setRole(null);
    }
    check().catch(() => setRole(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId]);

  async function logout() {
    await fetch(role === "mosque" ? "/api/mosque-admin/logout" : "/api/admin/logout", { method: "POST" });
    setRole(null);
  }

  async function addHalaqah(event: React.FormEvent) {
    event.preventDefault();
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/mosques/${mosqueId}/halaqahs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAddError(d.error ?? "تعذّرت الإضافة");
        return;
      }
      setInviteCode("");
      load();
    } finally {
      setAddBusy(false);
    }
  }

  async function copyLink() {
    const link = `${window.location.origin}/j/${mosqueId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // متروك بالحقل أصلاً
    }
  }

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
  if (!data) return <Empty title="جارٍ التحميل…" />;

  const registrationLink = `/j/${mosqueId}`;

  return (
    <DashboardShell
      nav={
        role === "super"
          ? [
              { href: "/", label: "كل الجوامع", icon: <HomeIcon /> },
              { href: `/mosque/${mosqueId}`, label: data.mosque.name, icon: <ShieldIcon />, active: true },
            ]
          : [{ href: `/mosque/${mosqueId}`, label: data.mosque.name, icon: <ShieldIcon />, active: true }]
      }
      title={data.mosque.name}
      subtitle={data.mosque.city || "لوحة الجامع"}
      userLabel={role === "super" ? "المشرف العام" : "مدير الجامع"}
      onLogout={logout}
    >
      <div className="space-y-5">
        <MosqueStatsSection mosqueId={mosqueId} />

        {role === "super" && <MosqueAdminAccountCard mosqueId={mosqueId} />}

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">رابط تسجيل الجامع</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            شاركه مع طلاب الجامع الجدد — يسجّلون اهتمامهم بدون اختيار حلقة، وتوزّعهم أنت من هنا.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={typeof window === "undefined" ? registrationLink : `${window.location.origin}${registrationLink}`}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
            />
            <Button onClick={copyLink} className="shrink-0">
              {copied ? "نُسخ ✓" : "نسخ"}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">إضافة حلقة</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            اطلب من المعلّم رابط دعوة حلقته من نظام المعلّم (صفحة الطلاب)، وألصق رمزه هنا فقط
            (آخر جزء من الرابط بعد <span className="tabular">invite=</span>).
          </p>
          <form onSubmit={addHalaqah} className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="رمز دعوة الحلقة"
              required
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <Button type="submit" disabled={addBusy} className="shrink-0">
              {addBusy ? "لحظة…" : "إضافة"}
            </Button>
          </form>
          {addError && <p className="mt-2 text-sm text-destructive">{addError}</p>}
        </Card>

        <div>
          <h2 className="mb-3 font-naskh text-lg font-bold">الحلقات ({data.halaqahs.length})</h2>
          {data.halaqahs.length === 0 ? (
            <Empty title="ما فيه حلقات مضافة بعد." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.halaqahs.map((h) => (
                <li key={h.id}>
                  <Card className="flex items-center gap-3 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{h.halaqahName}</p>
                      {h.teacherName && <p className="truncate text-xs text-muted-foreground">{h.teacherName}</p>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-naskh text-lg font-bold">
            طلاب بانتظار التوزيع ({data.pending.filter((p) => p.status === "pending").length})
          </h2>
          {data.pending.length === 0 ? (
            <Empty title="ما فيه تسجيلات جديدة بعد." />
          ) : (
            <ul className="space-y-2">
              {data.pending.map((p) => (
                <PendingRow key={p.id} pending={p} halaqahs={data.halaqahs} onAssigned={load} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function PendingRow({
  pending,
  halaqahs,
  onAssigned,
}: {
  pending: Pending;
  halaqahs: Halaqah[];
  onAssigned: () => void;
}) {
  const [halaqahId, setHalaqahId] = useState<string>(String(halaqahs[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pending.id, halaqahId: Number(halaqahId) }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? "تعذّر التوزيع");
        return;
      }
      onAssigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{pending.name}</p>
            {pending.phone && <p className="tabular text-xs text-muted-foreground">{pending.phone}</p>}
          </div>
          {pending.status === "assigned" ? (
            <Badge tone="good">مُوزَّع</Badge>
          ) : halaqahs.length === 0 ? (
            <Badge tone="warn">أضف حلقة أولاً</Badge>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={halaqahId}
                onChange={(e) => setHalaqahId(e.target.value)}
                className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
              >
                {halaqahs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.halaqahName}
                  </option>
                ))}
              </select>
              <Button onClick={assign} disabled={busy}>
                {busy ? "لحظة…" : "توزيع"}
              </Button>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </Card>
    </li>
  );
}

/** يظهر للمشرف العام فقط — ينشئ/يعيد ضبط حساب مدير هذا الجامع تحديداً */
function MosqueAdminAccountCard({ mosqueId }: { mosqueId: number }) {
  const [existing, setExisting] = useState<{ username: string } | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/mosques/${mosqueId}/admin-account`)
      .then((res) => (res.ok ? res.json() : { admin: null }))
      .then((d: { admin: { username: string } | null }) => setExisting(d.admin))
      .catch(() => setExisting(null));
  }, [mosqueId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/mosques/${mosqueId}/admin-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; username?: string };
      if (!res.ok) {
        setError(d.error ?? "تعذّر الحفظ");
        return;
      }
      setExisting({ username: d.username ?? username });
      setPassword("");
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldIcon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">حساب مدير الجامع</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        يقدر يدير حلقات هذا الجامع وطلابه بنفسه (رابط دخوله: <span className="tabular">/mosque-login</span>) —
        بلا حاجة لك.
        {existing && (
          <>
            {" "}
            حالياً: <span className="font-semibold text-foreground">{existing.username}</span>
          </>
        )}
      </p>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="اسم مستخدم جديد"
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة مرور (٨ أحرف فأكثر)"
          minLength={8}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "لحظة…" : existing ? "استبدال" : "إنشاء"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {saved && <p className="mt-2 text-sm text-success">تم الحفظ ✓</p>}
    </Card>
  );
}

type Stats = {
  halaqahCount: number;
  unreachableCount: number;
  totalActiveStudents: number;
  totalPages: number;
  avgMastery: number;
  perHalaqah: {
    id: number;
    halaqahName: string;
    teacherName: string;
    stats: { activeStudents: number; totalPages: number; avgPages: number; avgMastery: number } | null;
  }[];
};

/**
 * اللوحة الحقيقية — أرقام حية من نظام المعلّم (لا بيانات مخزّنة هنا)،
 * تُحدَّث كل ما فُتحت الصفحة. حلقة يتعذّر الوصول لها تظهر بشارة بدل
 * ما تكسر الإجمالي.
 */
function MosqueStatsSection({ mosqueId }: { mosqueId: number }) {
  const [stats, setStats] = useState<Stats | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/mosques/${mosqueId}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, [mosqueId]);

  if (stats === undefined) return <Empty title="جارٍ حساب الإحصائيات…" />;
  if (!stats || stats.halaqahCount === 0) {
    return <Empty title="ما فيه حلقات مضافة بعد — الإحصائيات تظهر بعد إضافة أول حلقة." />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="الحلقات" value={stats.halaqahCount} icon={<BookIcon className="h-4 w-4" />} tone="primary" />
        <Stat
          label="الطلاب النشطون"
          value={stats.totalActiveStudents}
          hint="بكل حلقات الجامع"
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <Stat
          label="متوسط الإتقان"
          value={`${stats.avgMastery}٪`}
          hint="محسوب من التسميعات"
          icon={<TrendUpIcon className="h-4 w-4" />}
        />
        <Stat
          label="إجمالي المحفوظ"
          value={stats.totalPages.toLocaleString("en")}
          hint="صفحة بالجامع كله"
          icon={<BookIcon className="h-4 w-4" />}
        />
      </div>
      {stats.unreachableCount > 0 && (
        <p className="text-xs text-accent">
          تعذّر جلب إحصائيات {stats.unreachableCount} حلقة مؤقتاً — الإجمالي أعلاه يستثنيها.
        </p>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-right text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">الحلقة</th>
              <th className="px-3 py-2 font-medium">المعلّم</th>
              <th className="px-3 py-2 font-medium">الطلاب</th>
              <th className="px-3 py-2 font-medium">متوسط الإتقان</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.perHalaqah.map((h) => (
              <tr key={h.id}>
                <td className="px-3 py-2 font-medium">{h.halaqahName}</td>
                <td className="px-3 py-2 text-muted-foreground">{h.teacherName}</td>
                {h.stats ? (
                  <>
                    <td className="tabular px-3 py-2">{h.stats.activeStudents}</td>
                    <td className="px-3 py-2">
                      <Badge tone={h.stats.avgMastery >= 75 ? "good" : h.stats.avgMastery >= 55 ? "neutral" : "warn"}>
                        {h.stats.avgMastery}٪
                      </Badge>
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-2" colSpan={2}>
                    <Badge tone="warn">غير متاح حالياً</Badge>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
