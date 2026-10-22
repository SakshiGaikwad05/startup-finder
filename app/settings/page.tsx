"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { api } from "@/components/api";
import { Banner, btnPrimary, CardSkeleton, PageHeader } from "@/components/ui";

interface Me {
  user: { id: number; profile: Record<string, any>; linkCreatedAt: string | null };
  queries: string[];
  canonicalSkills: string[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-2 text-sm font-semibold text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="rounded-lg bg-gray-100 px-2.5 py-1 text-[13px] font-medium text-gray-800">
          {s}
        </span>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [copied, setCopied] = useState<"no" | "yes" | "manual">("no");
  const [error, setError] = useState<string | null>(null);
  // The link exists only after the user asks for it (the server keeps just a hash, so it can't be shown again).
  const [link, setLink] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
      setTimeout(() => setCopied("no"), 1500);
    } catch {
      // Clipboard blocked (e.g. plain http on a LAN address): select it so Ctrl+C works.
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopied("manual");
    }
  }

  async function makeLink() {
    setMaking(true);
    const { ok, data, error } = await api<{ token: string }>("/api/me/link", { method: "POST" });
    setMaking(false);
    if (!ok) return setError(error);
    const url = `${window.location.origin}/api/me/link?t=${data.token}`;
    setLink(url);
    setMe((m) => (m ? { ...m, user: { ...m.user, linkCreatedAt: new Date().toISOString() } } : m));
    await copy(url);
  }

  async function load() {
    const { ok, status, data, error } = await api<Me>("/api/me");
    if (status === 401) return router.replace("/onboarding");
    if (!ok) return setError(error);
    setError(null);
    setMe(data);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me)
    return error ? (
      <Banner
        tone="error"
        action={
          <button onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
            Try again
          </button>
        }
      >
        {error}
      </Banner>
    ) : (
      <CardSkeleton count={2} />
    );
  const p = me.user.profile;
  const hadLink = !!me.user.linkCreatedAt;
  const years = Number(p.tech_experience_years ?? 0);

  async function startOver() {
    setSigningOut(true);
    const { ok, error } = await api("/api/me", { method: "DELETE" });
    setSigningOut(false);
    if (!ok) return setError(error);
    try {
      localStorage.removeItem("dsf.filters.v1");
    } catch {}
    router.replace("/onboarding");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="We match startups and jobs using what's on this page."
        actions={
          <Link href="/onboarding" className={btnPrimary}>
            <Icon name="pencil" className="h-4 w-4" />
            Edit profile
          </Link>
        }
      />

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 font-display text-xl font-bold text-brand-700" aria-hidden="true">
              {(p.name as string | undefined)?.trim()?.[0]?.toUpperCase() ?? <Icon name="user" className="h-6 w-6" />}
            </div>
            <div>
              <div className="font-display text-xl font-semibold text-gray-900">{p.name || "Student"}</div>
              <div className="text-sm text-gray-500">
                {p.explorer ? "Exploring, no skills added yet" : years === 0 ? "Fresher" : `About ${years} year${years === 1 ? "" : "s"} of experience`}
              </div>
            </div>
          </div>

          {p.explorer ? (
            <div className="rounded-xl bg-brand-50 p-4 text-sm text-gray-800">
              <p>You skipped the setup, so you&apos;re seeing recently funded startups without personal matches.</p>
              <Link href="/onboarding" className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                Add your skills <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <Section title="Roles you want">
                <Chips items={p.target_roles ?? []} empty="No roles picked" />
              </Section>
              <Section title="Where you want to work">
                <Chips items={p.preferred_locations ?? []} empty="Anywhere" />
              </Section>
              <Section title="Kinds of startup">
                <Chips items={p.preferred_startup_types ?? []} empty="Any kind" />
              </Section>
              <Section title={`Skills we recognise (${me.canonicalSkills.length})`}>
                <Chips items={me.canonicalSkills} empty="No skills yet. Add some so we can match you." />
              </Section>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
            <Icon name="link" className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">Your private link</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            There&apos;s no password. Your profile is saved in this browser. Open this link on your phone or another laptop to get your profile, saved startups and
            applications there too.
          </p>
          {link ? (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  ref={linkRef}
                  readOnly
                  value={link}
                  aria-label="Your private link"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => copy(link)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    copied === "yes" ? "bg-emerald-100 text-emerald-800" : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  <Icon name={copied === "yes" ? "check" : "copy"} className="h-4 w-4" />
                  {copied === "yes" ? "Copied" : "Copy"}
                </button>
              </div>
              {copied === "manual" && <p className="mt-2 text-xs font-medium text-gray-700">Link selected. Press Ctrl+C (or Cmd+C) to copy it.</p>}
              <p className="mt-2 text-xs text-gray-500">Save it now: for your safety it can&apos;t be shown again. You can always make a new one.</p>
            </>
          ) : (
            <button onClick={makeLink} disabled={making} className={`${btnPrimary} mt-4 w-full`}>
              <Icon name={making ? "spinner" : "link"} className="h-4 w-4" />
              {hadLink ? "Get a new private link" : "Get my private link"}
            </button>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-gray-500">
            <Icon name="alert" className="mt-px h-3.5 w-3.5 text-amber-600" />
            <span>
              Keep it private: anyone with the link can open your profile.
              {hadLink && " Getting a new link turns off your previous one."}
            </span>
          </p>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <button onClick={() => setShowSignOutConfirm(true)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
              <Icon name="logout" className="h-4 w-4" />
              Sign out on this device
            </button>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={showSignOutConfirm}
        title="Sign out on this device?"
        description={hadLink ? "Sign out of this profile on this device? You can come back using your private link." : "You haven't made a private link yet, so after signing out you can't get back to this profile. Sign out anyway?"}
        confirmLabel="Sign out"
        onConfirm={startOver}
        onCancel={() => setShowSignOutConfirm(false)}
        loading={signingOut}
        destructive
      />
    </div>
  );
}
