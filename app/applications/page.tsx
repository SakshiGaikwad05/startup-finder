"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, jsonBody } from "@/components/api";
import { StatusPill } from "@/components/JobCard";
import { Avatar, Icon } from "@/components/Icon";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Banner, btnPrimary, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";

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

/** Stages a student thinks in; each groups one or more stored statuses. */
const STAGES: { key: string; label: string; statuses: string[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "saved", label: "To apply", statuses: ["Saved", "Not Applied"] },
  { key: "applied", label: "Applied", statuses: ["Applied"] },
  { key: "interview", label: "Interviewing", statuses: ["Interview"] },
  { key: "offer", label: "Offers", statuses: ["Offer"] },
  { key: "closed", label: "Closed", statuses: ["Rejected", "Not Interested"] },
];

function Notes({ row, save }: { row: Row; save: (patch: Partial<Row>) => Promise<boolean> }) {
  const [v, setV] = useState(row.notes ?? "");
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "failed">("saved");
  return (
    <div>
      <label htmlFor={`notes-${row.id}`} className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
        Notes
        {state !== "saved" && (
          <span className={`font-normal ${state === "failed" ? "text-rose-700" : "text-gray-400"}`}>
            {state === "saving" ? "Saving…" : state === "failed" ? "Couldn't save. Click outside the box to retry." : "Not saved yet"}
          </span>
        )}
      </label>
      <textarea
        id={`notes-${row.id}`}
        rows={2}
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setState("dirty");
        }}
        onBlur={async () => {
          if (state !== "dirty" && state !== "failed") return;
          setState("saving");
          setState((await save({ notes: v })) ? "saved" : "failed");
        }}
        placeholder="e.g. Emailed the founder on Monday, follow up Friday"
        className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none"
      />
    </div>
  );
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stage, setStage] = useState("all");
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null);
  const [removing, setRemoving] = useState(false);
  const load = async () => {
    const { ok, status, data, error } = await api("/api/applications");
    if (status === 401) return router.replace("/onboarding");
    if (!ok) return setError(error);
    setError(null);
    setRows(data.applications ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  async function patch(id: number, p: Partial<Row>): Promise<boolean> {
    const { ok, error } = await api(`/api/applications/${id}`, { method: "PATCH", ...jsonBody(p) });
    if (!ok) setError(error);
    else load();
    return ok;
  }
  async function remove() {
    if (!removeTarget) return;
    setRemoving(true);
    const { ok, error } = await api(`/api/applications/${removeTarget.id}`, { method: "DELETE" });
    setRemoving(false);
    if (!ok) setError(error);
    else {
      setRemoveTarget(null);
      load();
    }
  }

  const inStage = (key: string, r: Row) => key === "all" || STAGES.find((s) => s.key === key)!.statuses.includes(r.status);
  const shown = (rows ?? []).filter((r) => inStage(stage, r));

  return (
    <div className="space-y-6">
      <PageHeader title="Your applications" subtitle="Everything you've saved or applied to, in one place." />

      {error && (
        <Banner
          tone="error"
          action={
            <button onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
              Try again
            </button>
          }
          onDismiss={() => setError(null)}
        >
          {error}
        </Banner>
      )}

      {!rows && !error && <CardSkeleton count={2} />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon="clipboard"
          title="Nothing saved yet"
          actions={
            <Link href="/dashboard" className={btnPrimary}>
              Browse startups
            </Link>
          }
        >
          Tap <b className="font-semibold">Save</b> on a startup or job you like. It shows up here so you can track it from &ldquo;To apply&rdquo; all the way to an offer.
        </EmptyState>
      )}

      {rows && rows.length > 0 && (
        <>
          <div role="group" aria-label="Filter by stage" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {STAGES.map((s) => {
              const n = rows.filter((r) => inStage(s.key, r)).length;
              const on = stage === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStage(s.key)}
                  aria-pressed={on}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    on ? "bg-gray-900 text-white dark:bg-brand-600" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-400"
                  }`}
                >
                  {s.label}
                  <span className={`tabular-nums ${on ? "opacity-70" : "text-gray-400"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={`Nothing in ${STAGES.find((s) => s.key === stage)!.label} yet`}
              actions={
                <button onClick={() => setStage("all")} className="text-sm font-semibold text-brand-700 hover:underline">
                  Show everything
                </button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => {
                const link = r.application_url ?? r.job_url ?? r.careers_url;
                const waiting = r.status === "Applied" && r.applied_at ? daysSince(r.applied_at) : null;
                return (
                  <li key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.startup_name} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/startups/${r.startup_id}`} className="font-display text-base font-semibold text-gray-900 hover:text-brand-700 hover:underline">
                          {r.startup_name}
                        </Link>
                        <p className="text-sm text-gray-600">{r.job_title ?? "Saved the startup (no specific job)"}</p>
                      </div>
                      <StatusPill status={r.status} onChange={(s) => patch(r.id, { status: s })} />
                    </div>

                    {waiting !== null && waiting >= 7 && (
                      <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                        <Icon name="lightbulb" className="mt-0.5 h-4 w-4 text-amber-600" />
                        Applied {waiting} days ago. A short, polite follow-up email can help you stand out.
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-gray-600">
                      {r.status !== "Saved" && r.status !== "Not Applied" && (
                      <label className="flex items-center gap-2">
                        <Icon name="calendar" className="h-4 w-4 text-gray-400" />
                        Applied on
                        <input
                          type="date"
                          value={r.applied_at?.slice(0, 10) ?? ""}
                          onChange={(e) => patch(r.id, { applied_at: e.target.value || null })}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[13px] text-gray-900"
                        />
                      </label>
                      )}
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
                          {r.job_title ? "Open job posting" : "Open careers page"}
                          <Icon name="external" className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="mt-3">
                      <Notes row={r} save={(p) => patch(r.id, p)} />
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => setRemoveTarget(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <ConfirmModal
        open={!!removeTarget}
        title="Remove application?"
        description={`Remove ${removeTarget?.job_title ?? removeTarget?.startup_name ?? "this application"} from your list? This won't affect the original job posting.`}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
        loading={removing}
        destructive
      />
    </div>
  );
}
