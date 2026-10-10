"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Me {
  user: { id: number; profile: Record<string, any>; privateLinkToken: string };
  queries: string[];
  canonicalSkills: string[];
}
interface Source {
  id: string;
  name: string;
  last_run_at: string | null;
  last_status: string | null;
  notes: string | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-gray-100 py-2 text-sm sm:grid-cols-[180px_1fr]">
      <div className="text-gray-500">{label}</div>
      <div className="text-gray-900">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) return router.replace("/onboarding");
      setMe(await r.json());
    });
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []));
  }, [router]);

  if (!me) return <div className="text-sm text-gray-500">Loading…</div>;
  const p = me.user.profile;
  const link = typeof window !== "undefined" ? `${window.location.origin}/api/me/link?t=${me.user.privateLinkToken}` : "";

  async function startOver() {
    if (!confirm("Sign out of this profile on this device? You can come back using your private link.")) return;
    await fetch("/api/me", { method: "DELETE" });
    try {
      localStorage.removeItem("dsf.filters.v1");
    } catch {}
    router.replace("/onboarding");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your profile</h1>
          <Link href="/onboarding" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Edit profile
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">Matching only counts the skills and roles listed here.</p>
        <div className="mt-3">
          {p.name && <Row label="Name">{p.name}</Row>}
          <Row label="Target roles">{(p.target_roles ?? []).join(", ") || "—"}</Row>
          <Row label="Experience">{p.tech_experience_years ?? 0} years</Row>
          <Row label="Locations">{(p.preferred_locations ?? []).join(", ") || "—"}</Row>
          <Row label="Startup types">{(p.preferred_startup_types ?? []).join(", ") || "Any"}</Row>
          <Row label="Skills recognised">
            <div className="flex flex-wrap gap-1">
              {me.canonicalSkills.map((s) => (
                <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                  {s}
                </span>
              ))}
            </div>
          </Row>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Your private link</h2>
          <p className="mt-1 text-xs text-gray-500">
            Your profile is saved in this browser. Open this link on another device to get your profile, saved startups and applications there.
            Keep it private — anyone with it can see your profile.
          </p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={link} className="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
              className="rounded border border-gray-300 px-2 text-xs hover:bg-gray-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={startOver} className="mt-3 text-xs text-rose-600 hover:underline">
            Sign out on this device
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Where startups come from</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {sources.map((s) => (
              <li key={s.id}>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">{s.notes}</div>
                <div className="text-xs text-gray-400">
                  Last run: {s.last_run_at ? new Date(s.last_run_at).toLocaleString("en-IN") : "never"} · {s.last_status ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
