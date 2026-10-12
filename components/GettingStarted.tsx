"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { StartupView } from "@/lib/types";
import { Icon } from "./Icon";

const DISMISS_KEY = "dsf.gettingStarted.dismissed";

/**
 * First-run checklist on the dashboard. Each step has its own call to action and ticks itself off
 * from real data (saved startups, tracked applications). Hidden once done or dismissed.
 */
export function GettingStarted({ startups, onShowBest }: { startups: StartupView[]; onShowBest: () => void }) {
  const [dismissed, setDismissed] = useState(true); // assume hidden until we've read storage (no flash)
  const [reviewed, setReviewed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      setReviewed(localStorage.getItem(DISMISS_KEY + ".reviewed") === "1");
      setCopiedLink(localStorage.getItem(DISMISS_KEY + ".link") === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const apps = startups.flatMap((s) => s.applications);
  const saved = apps.length > 0;
  const tracked = apps.some((a) => ["Applied", "Interview", "Offer"].includes(a.status));
  const hasMatches = startups.some((s) => s.relevant_jobs > 0);

  const mark = (key: string, set: (v: boolean) => void) => {
    set(true);
    try {
      localStorage.setItem(DISMISS_KEY + key, "1");
    } catch {}
  };

  const link = "inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:text-brand-800 hover:underline";
  const steps = [
    {
      done: reviewed,
      title: "See your best match",
      body: "See the startup whose jobs fit your profile best.",
      cta: hasMatches ? (
        <button
          onClick={() => {
            mark(".reviewed", setReviewed);
            onShowBest();
          }}
          className={link}
        >
          Show me <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </button>
      ) : null,
    },
    {
      done: saved,
      title: "Save a startup",
      body: "Tap Save on any card to add it to your Applications list.",
      cta: null,
    },
    {
      done: tracked,
      title: "Track an application",
      body: "After you apply, mark it as Applied so you remember to follow up.",
      cta: (
        <Link href="/applications" className={link}>
          Open Applications <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </Link>
      ),
    },
    {
      done: copiedLink,
      title: "Keep your private link",
      body: "Use it to open your profile on your phone or another laptop.",
      cta: (
        <Link href="/settings" onClick={() => mark(".link", setCopiedLink)} className={link}>
          Get my link <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done); // phones show only this one, so startups stay near the top
  if (dismissed || doneCount === steps.length) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-labelledby="first-steps">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="first-steps" className="text-base font-semibold text-gray-900">
            Your first steps
          </h2>
          <span className="text-sm tabular-nums text-gray-500">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {}
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Hide first steps"
          title="Hide"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className={`gap-3 ${i === next ? "flex" : "hidden sm:flex"}`}>
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-500"
              }`}
            >
              {s.done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${s.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.title}</div>
              {!s.done && (
                <>
                  <p className="mt-0.5 text-[13px] leading-snug text-gray-500">{s.body}</p>
                  {s.cta && <div className="mt-1">{s.cta}</div>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
