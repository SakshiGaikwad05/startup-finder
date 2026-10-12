"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [consent, setConsent] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("dsf.cookie_consent");
      setConsent(stored);
    } catch {}
  }, []);

  const handleConsent = (choice: "accepted" | "essential") => {
    try {
      localStorage.setItem("dsf.cookie_consent", choice);
    } catch {}
    setConsent(choice);
  };

  if (!mounted || consent) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:bottom-4 sm:inset-x-auto sm:right-4 sm:max-w-md sm:rounded-xl sm:border"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Cookie Preferences</h2>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Privacy</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          We use essential cookies to keep your candidate profile signed in and local storage for your theme and search preferences.
          We never use third-party advertising or tracking cookies. Read our{" "}
          <Link href="/privacy" className="text-indigo-600 underline hover:text-indigo-800">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-indigo-600 underline hover:text-indigo-800">
            Terms
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleConsent("accepted")}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={() => handleConsent("essential")}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Essential Only
          </button>
        </div>
      </div>
    </aside>
  );
}
