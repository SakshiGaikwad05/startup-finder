"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { btnPrimary, btnSecondary } from "./ui";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
};

/** A focused, keyboard-safe confirmation dialog for actions that need an explicit choice. */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPresent, setIsPresent] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setIsPresent(true);
      setIsClosing(false);
      return;
    }
    if (!isPresent) return;

    setIsClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    closeTimer.current = setTimeout(() => setIsPresent(false), delay);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, isPresent]);

  useEffect(() => {
    if (!isPresent) return;

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])");
      focusable?.focus();
    };
    requestAnimationFrame(focusInitial);

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [isPresent]);

  if (!isPresent) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !loading) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []
    );
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ${isClosing ? "modal-backdrop-out" : "modal-backdrop-in"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loading}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`modal-panel w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6 ${isClosing ? "modal-panel-out" : "modal-panel-in"}`}
      >
        <div className="flex gap-3.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${destructive ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-700"}`}>
            <Icon name={destructive ? "alert" : "info"} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className={`${btnSecondary} w-full sm:w-auto`}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${destructive ? "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-800 disabled:opacity-60" : btnPrimary} w-full sm:w-auto`}
          >
            {loading && <Icon name="spinner" className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
