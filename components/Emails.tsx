"use client";
import { useState } from "react";
import type { FoundEmail } from "@/lib/types";
import { emailLabel } from "@/lib/emails/labels";
import { Icon } from "./Icon";

export function CopyButton({ text, label = "Copy email" }: { text: string; label?: string }) {
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
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${done ? "text-emerald-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
    >
      <Icon name={done ? "check" : "copy"} className="h-3.5 w-3.5" />
    </button>
  );
}

/** Emails found on the startup's own site. `limit` keeps cards compact. */
export function Emails({ emails, limit, checked }: { emails: FoundEmail[]; limit?: number; checked?: boolean }) {
  if (!emails.length) {
    return checked ? <p className="text-sm text-gray-500">Not publicly available. No email address is published on their website.</p> : null;
  }
  const shown = limit ? emails.slice(0, limit) : emails;
  return (
    <ul className="space-y-1.5">
      {shown.map((e) => (
        <li key={e.email} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Icon name="mail" className="h-4 w-4 text-gray-400" />
          <a href={`mailto:${e.email}`} className="min-w-0 break-all font-medium text-gray-800 hover:text-brand-700 hover:underline">
            {e.email}
          </a>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{emailLabel(e)}</span>
          {e.domain_accepts_mail === true && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title="The domain has mail servers (MX records), so it can receive email">
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />
              Receives mail
            </span>
          )}
          {e.domain_accepts_mail === false && (
            <span className="inline-flex items-center gap-1 text-xs text-rose-600" title="The domain has no mail servers, so email may bounce">
              <Icon name="alert" className="h-3.5 w-3.5" />
              No mail server
            </span>
          )}
          <a href={e.source_url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 underline hover:text-gray-700" title="Where this email was found">
            source
          </a>
          <CopyButton text={e.email} />
        </li>
      ))}
      {limit && emails.length > limit && <li className="pl-6 text-xs text-gray-500">+{emails.length - limit} more on the details page</li>}
    </ul>
  );
}
