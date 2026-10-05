"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { APPLICATION_STATUSES } from "@/lib/types";

interface Row {
  id: number;
  startup_id: number;
  startup_name: string;
  job_id: number | null;
  job_title: string | null;
  job_url: string | null;
  careers_url: string | null;
  status: string;
  applied_at: string | null;
  application_url: string | null;
  notes: string | null;
}

function NotesCell({ row, save }: { row: Row; save: (patch: Partial<Row>) => Promise<void> }) {
  const [v, setV] = useState(row.notes ?? "");
  const [saved, setSaved] = useState(true);
  return (
    <div className="flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSaved(false);
        }}
        onBlur={async () => {
          if (!saved) {
            await save({ notes: v });
            setSaved(true);
          }
        }}
        placeholder="e.g. Sent founder cold DM"
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
      />
      {!saved && <span className="text-xs text-gray-400">…</span>}
    </div>
  );
}

export default function ApplicationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("all");
  const load = () =>
    fetch("/api/applications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.applications));
  useEffect(() => {
    load();
  }, []);

  async function patch(id: number, p: Partial<Row>) {
    await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    load();
  }
  async function remove(id: number) {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    load();
  }

  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, (rows ?? []).filter((r) => r.status === s).length]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Application tracker</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
          <option value="all">All ({rows?.length ?? 0})</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({counts[s]})
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Startup</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Applied</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2 w-1/3">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nothing tracked yet. Use “Save” or the status menu next to a job on the dashboard.
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/startups/${r.startup_id}`} className="hover:underline">
                    {r.startup_name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.job_title ?? <span className="text-gray-400">Startup saved (no specific job)</span>}</td>
                <td className="px-3 py-2">
                  <select value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })} className="rounded border border-gray-300 bg-white px-1 py-0.5">
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={r.applied_at?.slice(0, 10) ?? ""}
                    onChange={(e) => patch(r.id, { applied_at: e.target.value || null })}
                    className="rounded border border-gray-200 px-1 py-0.5"
                  />
                </td>
                <td className="px-3 py-2">
                  {(r.application_url ?? r.job_url ?? r.careers_url) ? (
                    <a href={(r.application_url ?? r.job_url ?? r.careers_url)!} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      Open ↗
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <NotesCell row={r} save={(p) => patch(r.id, p)} />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(r.id)} className="text-xs text-gray-400 hover:text-rose-600">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
