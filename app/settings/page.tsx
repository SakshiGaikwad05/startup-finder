"use client";
import { useEffect, useState } from "react";

interface Data {
  profile: Record<string, unknown>;
  queries: string[];
  canonicalSkills: string[];
  sources: { id: string; name: string; kind: string; enabled: boolean; last_run_at: string | null; last_status: string | null; notes: string | null }[];
}

export default function SettingsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () =>
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Data) => {
        setData(d);
        setText(JSON.stringify(d.profile, null, 2));
      });
  useEffect(() => {
    load();
  }, []);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setMsg({ ok: false, text: `Invalid JSON: ${(e as Error).message}` });
      return;
    }
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
    const d = await res.json();
    setMsg(res.ok ? { ok: true, text: "Saved. Match scores on the dashboard now use this profile." } : { ok: false, text: d.error });
    if (res.ok) load();
  }

  if (!data) return <div className="text-sm text-gray-500">Loading…</div>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="text-xl font-semibold">Candidate profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Built from your resume. Matching only counts skills listed here. Edit and save to update scores.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="mt-3 h-[560px] w-full rounded border border-gray-300 p-3 font-mono text-xs"
        />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={save} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save profile
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
        </div>
      </section>
      <div className="space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Skills recognised for matching</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {data.canonicalSkills.map((s) => (
              <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                {s}
              </span>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Sources</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.sources.map((s) => (
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
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Search queries from your profile ({data.queries.length})</h2>
          <p className="text-xs text-gray-500">Used by the web-search source when SEARCH_API_KEY is set.</p>
          <ul className="mt-2 max-h-64 list-disc overflow-auto pl-5 text-xs text-gray-600">
            {data.queries.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
