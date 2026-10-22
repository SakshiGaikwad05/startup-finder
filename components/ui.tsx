import { Icon, type IconName } from "./Icon";
import { Dropdown, type DropdownOption } from "./Dropdown";
import { Children, isValidElement } from "react";

/** Shared button looks. Primary = the one main action on a screen. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900";
export const inputBase =
  "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100";

const TONES = {
  info: { box: "border-brand-200 bg-brand-50", icon: "info" as IconName, iconColor: "text-brand-600" },
  warn: { box: "border-amber-200 bg-amber-50", icon: "clock" as IconName, iconColor: "text-amber-600" },
  error: { box: "border-rose-200 bg-rose-50", icon: "alert" as IconName, iconColor: "text-rose-600" },
  progress: { box: "border-brand-200 bg-brand-50", icon: "spinner" as IconName, iconColor: "text-brand-600" },
};

export function Banner({
  tone = "info",
  children,
  action,
  onDismiss,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const t = TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex flex-col gap-3 rounded-2xl border p-4 text-sm text-gray-800 sm:flex-row sm:items-center ${t.box}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon name={t.icon} className={`mt-0.5 h-5 w-5 ${t.iconColor}`} />
        <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="-m-1 rounded-lg p-1 text-gray-400 hover:bg-white/60 hover:text-gray-700 sm:hidden">
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>
      {(action || onDismiss) && (
        <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
          {action}
          {onDismiss && (
            <button onClick={onDismiss} aria-label="Dismiss" className="hidden rounded-lg p-1 text-gray-400 hover:bg-white/60 hover:text-gray-700 sm:block">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon: IconName; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-gray-900">{title}</h3>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-gray-600">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Grey placeholder blocks while a list loads, so the layout doesn't jump. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-1/3 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 h-3 w-full rounded bg-gray-100" />
          <div className="mt-2 h-3 w-4/5 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** Compact dropdown used in filter rows (Jobs, YC Jobs). */
export function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const options = Children.toArray(children).flatMap((child): DropdownOption[] => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const option = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    return [{ value: option.value ?? "", label: String(option.children ?? ""), disabled: option.disabled }];
  });
  return <Dropdown label={label} value={value} onChange={onChange} options={options} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
