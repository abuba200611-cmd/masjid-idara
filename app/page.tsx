"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Empty } from "@/components/ui";

type Mosque = { id: number; name: string; city: string; createdAt: string };

export default function HomePage() {
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data: { admin: boolean }) => setAdmin(data.admin))
      .catch(() => setAdmin(false));
  }, []);

  if (admin === null) return <Empty title="جارٍ التحقق…" />;
  if (!admin) return <AdminLogin onIn={() => setAdmin(true)} />;
  return <Dashboard onLoggedOut={() => setAdmin(false)} />;
}

function AdminLogin({ onIn }: { onIn: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        setError("كلمة السر غير صحيحة");
        return;
      }
      onIn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-center font-naskh text-2xl font-bold text-primary">إدارة الجامع</h1>
      <p className="mb-5 text-center text-sm text-muted-foreground">
        تنظيم الحلقات وتوزيع الطلاب الجدد
      </p>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="كلمة السر"
            autoFocus
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "لحظة…" : "دخول"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [mosques, setMosques] = useState<Mosque[] | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/mosques")
      .then((res) => res.json())
      .then((data: { mosques?: Mosque[] }) => setMosques(data.mosques ?? []))
      .catch(() => setMosques([]));
  }

  useEffect(load, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    onLoggedOut();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mosques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذّر الإضافة");
        return;
      }
      setName("");
      setCity("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="font-naskh text-lg font-bold text-primary">إدارة الجامع</span>
          <Button variant="ghost" onClick={logout} className="mr-auto">
            خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">إضافة جامع جديد</h2>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الجامع"
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="المدينة (اختياري)"
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <Button type="submit" disabled={busy}>
              {busy ? "لحظة…" : "إضافة"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </Card>

        <h1 className="font-naskh text-xl font-bold">الجوامع</h1>
        {mosques === null ? (
          <Empty title="جارٍ التحميل…" />
        ) : mosques.length === 0 ? (
          <Empty title="ما فيه جوامع بعد — أضف أول واحد فوق." />
        ) : (
          <ul className="space-y-2">
            {mosques.map((m) => (
              <li key={m.id}>
                <Link href={`/mosque/${m.id}`}>
                  <Card className="flex items-center justify-between p-4 transition-colors duration-200 hover:bg-muted/40">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      {m.city && <p className="text-xs text-muted-foreground">{m.city}</p>}
                    </div>
                    <span className="text-sm text-primary">فتح ←</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
