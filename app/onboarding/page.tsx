"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SKILL_DICTIONARY } from "@/lib/matching/skills";
import { ROLE_OPTIONS, STARTUP_TYPE_OPTIONS } from "@/lib/resume/parse";
import { LOCATION_OPTIONS } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { api } from "@/components/api";
import { btnGhost, btnPrimary, inputBase } from "@/components/ui";

const ALL_SKILLS = Object.keys(SKILL_DICTIONARY).sort((a, b) => a.localeCompare(b));
const ALL_ROLES = ROLE_OPTIONS.map((r) => r.role);
const STEPS = ["Your skills", "Roles you want", "Where and what"];

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
        on ? "border-brand-600 bg-brand-600 font-medium text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
      }`}
    >
      {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

function ChipInput({
  id,
  values,
  onChange,
  suggestions,
  placeholder,
  maxLength,
}: {
  id?: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
  maxLength?: number;
}) {
  const [text, setText] = useState("");
  // Best first: exact match, then "starts with", then "contains" — so typing "SQL" + Enter adds SQL, not MySQL.
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const rank = (s: string) => (s.toLowerCase() === q ? 0 : s.toLowerCase().startsWith(q) ? 1 : 2);
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !values.includes(s))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 6);
  }, [text, suggestions, values]);
  const add = (v: string) => {
    let t = v.trim();
    if (maxLength && t.length > maxLength) {
      t = t.slice(0, maxLength).trim();
    }
    if (t && !values.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setText("");
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 py-1 pl-2.5 pr-1 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded p-0.5 text-brand-700 hover:bg-brand-100"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          id={id}
          value={text}
          maxLength={maxLength}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(matches[0] && text.trim().length > 1 ? matches[0] : text);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={inputBase}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            {matches.map((m) => (
              <button key={m} type="button" onClick={() => add(m)} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-gray-800 hover:bg-gray-50">
                <Icon name="plus" className="h-3.5 w-3.5 text-gray-400" />
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
        <span>Press Enter to add.</span>
        {maxLength ? (
          <span className={text.length >= maxLength ? "font-medium text-amber-600" : ""}>
            {text.length}/{maxLength} characters
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Shared never-throwing fetch; on failure `d.error` carries the server's message or a friendly fallback. */
async function send(url: string, init: RequestInit): Promise<{ ok: boolean; d: any }> {
  const r = await api(url, init);
  return { ok: r.ok, d: r.ok ? r.data : { ...r.data, error: r.error } };
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [explorer, setExplorer] = useState(false); // skipped earlier; now adding skills for the first time
  const [skipping, setSkipping] = useState(false);
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [years, setYears] = useState<string>("0");
  const [locations, setLocations] = useState<string[]>(["Remote", "Remote - India"]);
  const [types, setTypes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [upload, setUpload] = useState<{ state: "idle" | "reading" | "done" | "error"; msg?: string }>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit mode: prefill from the existing profile.
  useEffect(() => {
    api("/api/me")
      .then(({ ok, data: d }) => {
        if (!ok) return;
        if (!d?.user) return;
        const p = d.user.profile;
        setEditing(true);
        if (p.explorer) {
          setExplorer(true); // keep the blank form: their "profile" is only generic defaults
          return;
        }
        setName(p.name ?? "");
        setSkills([...new Set<string>([...(p.skills ?? []), ...(p.programming_languages ?? []), ...(p.frameworks ?? []), ...(p.databases ?? []), ...(p.ai_ml_skills ?? []), ...(p.libraries ?? []), ...(p.cloud_tools ?? [])])]);
        setRoles(p.target_roles ?? []);
        setYears(String(p.tech_experience_years ?? 0));
        setLocations(p.preferred_locations ?? []);
        setTypes(p.preferred_startup_types ?? []);
      })
      .catch(() => {});
  }, []);

  async function onFile(file: File) {
    setUpload({ state: "reading" });
    const fd = new FormData();
    fd.append("file", file);
    const { ok, d } = await send("/api/resume", { method: "POST", body: fd });
    if (!ok) {
      setUpload({ state: "error", msg: d.error ?? "Couldn't read that file. Try again, or add your skills below." });
      return;
    }
    setSkills((s) => [...new Set([...s, ...d.skills.filter((sk: string) => sk.length <= 20)])]);
    setRoles((r) => [...new Set([...r, ...d.roles])]);
    if (d.locations?.length) setLocations((l) => [...new Set([...l, ...d.locations.filter((x: string) => (LOCATION_OPTIONS as readonly string[]).includes(x))])]);
    if (d.experienceYears != null) setYears(String(d.experienceYears));
    setUpload({ state: "done", msg: `Found ${d.skills.length} skills and ${d.roles.length} likely roles. Check them below and remove anything that's wrong.` });
  }

  /** No skills yet: browse recently funded startups now, add skills later. */
  async function skip() {
    setError(null);
    setSkipping(true);
    const { ok, d } = await send("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ explore: true }) });
    if (!ok) {
      setSkipping(false);
      setError(d.error ?? "Couldn't continue. Please try again.");
      return;
    }
    try {
      localStorage.removeItem("dsf.filters.v1");
    } catch {}
    router.push("/dashboard?welcome=1");
  }

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setError(null);
    setSaving(true);
    const { ok, d } = await send("/api/me", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, skills, target_roles: roles, tech_experience_years: Number(years), preferred_locations: locations, preferred_startup_types: types }),
    });
    setSaving(false);
    if (!ok) {
      setError(d.error ?? "Couldn't save your profile. Please try again in a moment.");
      return;
    }
    try {
      localStorage.removeItem("dsf.filters.v1"); // let the dashboard pick up the new preferences
    } catch {}
    router.push(editing && !explorer ? "/dashboard" : "/dashboard?welcome=1");
  }

  const canNext = step === 1 ? skills.length > 0 : step === 2 ? roles.length > 0 : locations.length > 0;

  const yearsNum = Math.max(0, Number(years) || 0);
  const setYearsNum = (n: number) => setYears(String(Math.min(40, Math.max(0, Math.round(n * 2) / 2))));

  return (
    <div className="mx-auto max-w-2xl sm:py-2">
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {editing && !explorer ? (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">Edit your profile</h1>
          <p className="mt-1 text-sm text-gray-600">Changes update your matches straight away.</p>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-balance text-[28px] font-bold leading-tight text-gray-900 sm:text-4xl">Find startups that are hiring people like you</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-600">
            Tell us your skills once. We match you with jobs at Y Combinator and recently funded startups, and show you why each one fits.
          </p>
          {params.get("link") === "invalid" && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4" />
              That private link doesn&apos;t work anymore. Set up a new profile below.
            </p>
          )}
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-gray-900">{STEPS[step - 1]}</span>
          <span className="text-gray-500">
            Step {step} of {STEPS.length}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {STEPS.map((l, i) => (
            <div key={l} className={`h-1.5 rounded-full transition-colors ${i < step ? "bg-brand-600" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.state === "reading"}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-4 py-7 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-70"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name={upload.state === "reading" ? "spinner" : "upload"} className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-semibold text-gray-900">{upload.state === "reading" ? "Reading your resume…" : "Upload your resume"}</span>
                <span className="text-xs text-gray-500">PDF only. We read it once to fill in your skills. The file isn&apos;t saved.</span>
              </button>
              {upload.msg && (
                <p
                  role="status"
                  className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${upload.state === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
                >
                  <Icon name={upload.state === "error" ? "alert" : "circle-check"} className="mt-0.5 h-4 w-4" />
                  {upload.msg}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
              <span className="h-px flex-1 bg-gray-200" /> or add them yourself <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-gray-900">Your skills</h2>
                <span className="text-xs text-gray-400">Max 20 characters per skill</span>
              </div>
              <p className="mb-2 text-sm text-gray-500">Languages, frameworks, tools. Matching only counts what's listed here.</p>
              <ChipInput id="skills-input" values={skills} onChange={setSkills} suggestions={ALL_SKILLS} placeholder="e.g. Python, React, SQL…" maxLength={20} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-7">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Which roles are you looking for?</h2>
              <p className="mb-3 mt-0.5 text-sm text-gray-600">Pick all that fit. You can add your own too.</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...ALL_ROLES, ...roles])].map((r) => (
                  <Pill key={r} label={r} on={roles.includes(r)} onClick={() => setRoles(toggle(roles, r))} />
                ))}
              </div>
              <div className="mt-4">
                <ChipInput values={roles.filter((r) => !ALL_ROLES.includes(r))} onChange={(custom) => setRoles([...roles.filter((r) => ALL_ROLES.includes(r)), ...custom])} suggestions={[]} placeholder="Add another role" />
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-900" htmlFor="years">
                Work experience in tech
              </label>
              <p className="mb-3 mt-0.5 text-sm text-gray-600">Internships count. Choose 0 if you&apos;re a student or fresher. We use this to flag jobs that are too senior.</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white">
                  <button type="button" onClick={() => setYearsNum(yearsNum - 0.5)} disabled={yearsNum <= 0} className="p-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30" aria-label="Less experience">
                    <Icon name="minus" className="h-4 w-4" />
                  </button>
                  <input
                    id="years"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={40}
                    step={0.5}
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    className="w-14 border-x border-gray-200 bg-transparent py-2 text-center text-sm font-semibold tabular-nums text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button type="button" onClick={() => setYearsNum(yearsNum + 0.5)} className="p-2.5 text-gray-600 hover:text-gray-900" aria-label="More experience">
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-600">{yearsNum === 0 ? "years (student / fresher)" : yearsNum === 1 ? "year" : "years"}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-7">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Where do you want to work?</h2>
              <p className="mb-3 mt-0.5 text-sm text-gray-600">&ldquo;Remote - India&rdquo; means remote jobs that are open to people in India.</p>
              <div className="flex flex-wrap gap-2">
                {LOCATION_OPTIONS.filter((l) => l !== "Other").map((l) => (
                  <Pill key={l} label={l} on={locations.includes(l)} onClick={() => setLocations(toggle(locations, l))} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">What kind of startups interest you?</h2>
              <p className="mb-3 mt-0.5 text-sm text-gray-600">Optional. Leave empty to see every kind.</p>
              <div className="flex flex-wrap gap-2">
                {STARTUP_TYPE_OPTIONS.map((t) => (
                  <Pill key={t} label={t === "AI" ? "AI startups" : t} on={types.includes(t)} onClick={() => setTypes(toggle(types, t))} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-900" htmlFor="name">
                Your first name <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputBase} mt-2`} placeholder="Only you will see this" autoComplete="given-name" />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            <Icon name="alert" className="mt-0.5 h-4 w-4" />
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
          {step === 1 ? (
            !editing ? (
              <button type="button" onClick={skip} disabled={skipping} className={btnGhost}>
                {skipping ? "Opening…" : "Skip for now"}
              </button>
            ) : (
              <span />
            )
          ) : (
            <button type="button" onClick={() => setStep(step - 1)} className={btnGhost}>
              <Icon name="arrow-left" className="h-4 w-4" />
              Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className={`${btnPrimary} disabled:opacity-40`}>
              Next
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={!canNext || saving} onClick={save} className={`${btnPrimary} disabled:opacity-40`}>
              {saving && <Icon name="spinner" className="h-4 w-4" />}
              {saving ? "Saving…" : editing && !explorer ? "Save changes" : "Show my startups"}
              {!saving && !(editing && !explorer) && <Icon name="arrow-right" className="h-4 w-4" />}
            </button>
          )}
        </div>
        {!canNext && (
          <p className="mt-3 text-right text-xs text-gray-500">
            {step === 1 ? "Add at least one skill to continue." : step === 2 ? "Pick at least one role to continue." : "Pick at least one location to continue."}
          </p>
        )}
      </div>

      {!editing && !explorer && (
        <p className="mt-5 text-center text-sm text-gray-600">
          No skills yet?{" "}
          <button type="button" onClick={skip} disabled={skipping} className="font-semibold text-brand-700 hover:underline disabled:opacity-60">
            Explore recently funded startups first
          </button>
        </p>
      )}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500">
        <Icon name="info" className="h-3.5 w-3.5" />
        No sign-up needed. Your profile is saved in this browser, with a private link to open it elsewhere.
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
