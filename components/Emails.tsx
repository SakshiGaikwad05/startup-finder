"use client";
import { useState } from "react";
import type { FoundEmail } from "@/lib/types";

const TYPE_LABEL: Record<FoundEmail["type"], string> = {
  careers: "Careers",
  general: "General",
  person: "Person",
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
      className="text-[11px] text-gray-400 hover:text-gray-700"
      title="Copy email"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Emails found on the startup's own site. `limit` keeps cards compact. */
export function Emails({ emails, limit, checked }: { emails: FoundEmail[]; limit?: number; checked?: boolean }) {
  if (!emails.length) {
    return checked ? <div className="text-xs text-gray-400">No email published on their website.</div> : null;
  }
  const shown = limit ? emails.slice(0, limit) : emails;
  return (
    <ul className="space-y-1">
      {shown.map((e) => (
        <li key={e.email} className="flex flex-wrap items-center gap-2 text-xs">
          <a href={`mailto:${e.email}`} className="font-medium text-gray-800 hover:text-indigo-700 hover:underline">
            ✉ {e.email}
          </a>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{TYPE_LABEL[e.type]}</span>
          {e.domain_accepts_mail === true && (
            <span className="text-[11px] text-emerald-700" title="The domain has mail servers (MX records), so it can receive email">
              ✓ domain receives mail
            </span>
          )}
          {e.domain_accepts_mail === false && <span className="text-[11px] text-rose-600">✗ domain has no mail server</span>}
          <a href={e.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-400 underline" title="Where this email was found">
            source
          </a>
          <CopyButton text={e.email} />
        </li>
      ))}
      {limit && emails.length > limit && <li className="text-[11px] text-gray-400">+{emails.length - limit} more on the details page</li>}
    </ul>
  );
}
