"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type ThemeMode = "light" | "dark";
export const THEME_KEY = "dsf.theme";

/** Runs in <head> before first paint so the page never flashes the wrong theme.
    No saved choice (or the old "system" value) = follow the device setting. */
export const themeBootScript = `(function(){try{var m=localStorage.getItem('${THEME_KEY}');var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function savedChoice(): ThemeMode | null {
  try {
    const m = localStorage.getItem(THEME_KEY);
    return m === "light" || m === "dark" ? m : null;
  } catch {
    return null;
  }
}

/** Light ↔ dark. Until the user picks one, the theme follows the device setting, live. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark")); // the boot script already applied it
    if (savedChoice()) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (savedChoice()) return;
      document.documentElement.classList.toggle("dark", mq.matches);
      setDark(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  }

  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      <Icon name={dark ? "sun" : "moon"} className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </button>
  );
}
