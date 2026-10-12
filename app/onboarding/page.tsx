"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SKILL_DICTIONARY } from "@/lib/matching/skills";
import { ROLE_OPTIONS, STARTUP_TYPE_OPTIONS } from "@/lib/resume/parse";
import { LOCATION_OPTIONS } from "@/lib/types";

const ALL_SKILLS = Object.keys(SKILL_DICTIONARY).sort((a, b) => a.localeCompare(b));
const ALL_ROLES = ROLE_OPTIONS.map((r) => r.role);

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"}`}
    >
      {on ? "✓ " : ""}
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
  const matches = useMemo(
    () =>
      text.trim()
        ? suggestions
            .filter((s) => (!maxLength || s.length <= maxLength) && s.toLowerCase().includes(text.trim().toLowerCase()) && !values.includes(s))
            .slice(0, 6)
        : [],
    [text, suggestions, values, maxLength]
  );
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
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-sm text-indigo-800 ring-1 ring-indigo-200">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-indigo-400 hover:text-indigo-800">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-2">
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {matches.map((m) => (
              <button key={m} type="button" onClick={() => add(m)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50">
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
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
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
    const res = await fetch("/api/resume", { method: "POST", body: fd });
    const d = await res.json();
    if (!res.ok) {
      setUpload({ state: "error", msg: d.error });
      return;
    }
    setSkills((s) => [...new Set([...s, ...d.skills.filter((sk: string) => sk.length <= 20)])]);
    setRoles((r) => [...new Set([...r, ...d.roles])]);
    if (d.locations?.length) setLocations((l) => [...new Set([...l, ...d.locations.filter((x: string) => (LOCATION_OPTIONS as readonly string[]).includes(x))])]);
    if (d.experienceYears != null) setYears(String(d.experienceYears));
    setUpload({ state: "done", msg: `Found ${d.skills.length} skills and ${d.roles.length} likely roles. Check them below — remove anything that's wrong.` });
  }

  /** No skills yet: browse recently funded startups now, add skills later. */
  async function skip() {
    setError(null);
    setSkipping(true);
    const res = await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ explore: true }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
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
    const res = await fetch("/api/me", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, skills, target_roles: roles, tech_experience_years: Number(years), preferred_locations: locations, preferred_startup_types: types }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Couldn't save.");
      return;
    }
    try {
      localStorage.removeItem("dsf.filters.v1"); // let the dashboard pick up the new preferences
    } catch {}
    router.push(editing && !explorer ? "/dashboard" : "/dashboard?welcome=1");
  }

  const canNext = step === 1 ? skills.length > 0 : step === 2 ? roles.length > 0 : locations.length > 0;

  return (
    <div className="mx-auto max-w-2xl py-4">
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {editing && !explorer ? (
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Edit your profile</h1>
          <p className="mt-1 text-sm text-gray-500">Changes update your matches immediately.</p>
        </div>
      ) : (
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Find startups hiring people like you</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Add your skills once. We match you with jobs at YC and recently funded startups, and explain every match.
          </p>
          {!explorer && (
            <button type="button" onClick={skip} disabled={skipping} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-60">
              {skipping ? "Opening…" : "No skills yet? Skip and explore recently funded startups →"}
            </button>
          )}
          {params.get("link") === "invalid" && <p className="mt-3 text-sm text-rose-600">That private link isn't valid anymore. Set up a new profile below.</p>}
        </div>
      )}

      <ol className="mb-5 flex gap-2 text-xs">
        {["Your skills", "Roles you want", "Where & what"].map((label, i) => (
          <li key={label} className={`flex-1 rounded-full px-3 py-1.5 text-center ${step === i + 1 ? "bg-indigo-600 text-white" : step > i + 1 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.state === "reading"}
                className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                </svg>
                <span className="font-medium text-gray-800">{upload.state === "reading" ? "Reading your resume…" : "Upload your resume"}</span>
                <span className="text-xs text-gray-400">PDF · we read it once to fill in your skills, the file isn't saved</span>
              </button>
              {upload.msg && <p className={`mt-2 text-sm ${upload.state === "error" ? "text-rose-600" : "text-emerald-700"}`}>{upload.msg}</p>}
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
              <span className="h-px flex-1 bg-gray-200" /> or add skills yourself <span className="h-px flex-1 bg-gray-200" />
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
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900">Which roles are you looking for?</h2>
              <p className="mb-3 text-sm text-gray-500">Pick all that fit. You can add your own.</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...ALL_ROLES, ...roles])].map((r) => (
                  <Pill key={r} label={r} on={roles.includes(r)} onClick={() => setRoles(toggle(roles, r))} />
                ))}
              </div>
              <div className="mt-3">
                <ChipInput values={roles.filter((r) => !ALL_ROLES.includes(r))} onChange={(custom) => setRoles([...roles.filter((r) => ALL_ROLES.includes(r)), ...custom])} suggestions={[]} placeholder="Add another role…" />
              </div>
            </div>
            <div>
              <label className="font-semibold text-gray-900" htmlFor="years">
                Years of professional tech experience
              </label>
              <p className="mb-2 text-sm text-gray-500">Internships count. Use 0 if you're a fresher. Used to flag roles that are too senior.</p>
              <input id="years" type="number" min={0} max={40} step={0.5} value={years} onChange={(e) => setYears(e.target.value)} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-900">Where do you want to work?</h2>
              <p className="mb-3 text-sm text-gray-500">"Remote - India" means remote jobs open to people in India.</p>
              <div className="flex flex-wrap gap-2">
                {LOCATION_OPTIONS.filter((l) => l !== "Other").map((l) => (
                  <Pill key={l} label={l} on={locations.includes(l)} onClick={() => setLocations(toggle(locations, l))} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">What kind of startups interest you?</h2>
              <p className="mb-3 text-sm text-gray-500">Leave empty to see every kind.</p>
              <div className="flex flex-wrap gap-2">
                {STARTUP_TYPE_OPTIONS.map((t) => (
                  <Pill key={t} label={t === "AI" ? "AI startups" : t} on={types.includes(t)} onClick={() => setTypes(toggle(types, t))} />
                ))}
              </div>
            </div>
            <div>
              <label className="font-semibold text-gray-900" htmlFor="name">
                Your first name <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Shown only to you" />
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          {step === 1 && !editing ? (
            <button type="button" onClick={skip} disabled={skipping} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-60">
              Skip for now
            </button>
          ) : (
            <button type="button" onClick={() => setStep(step - 1)} disabled={step === 1} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:invisible">
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
              Next →
            </button>
          ) : (
            <button type="button" disabled={!canNext || saving} onClick={save} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
              {saving ? "Saving…" : editing && !explorer ? "Save changes" : "Find my startups →"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">No sign-up needed. Your profile is saved in this browser; you'll get a private link to open it elsewhere.</p>
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
