"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export type DropdownOption = { value: string; label: string; disabled?: boolean };

type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  label: string;
  disabled?: boolean;
  placeholder?: string;
  variant?: "filter" | "sort" | "compact";
  className?: string;
};

const TRIGGER_STYLES = {
  filter: "w-full rounded-xl border border-gray-300 bg-white py-2 pl-3 pr-8 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-50 sm:w-auto",
  sort: "rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-50",
  compact: "rounded-full bg-transparent py-1 pl-3 pr-7 text-left text-xs font-semibold",
};

/** Shared animated listbox for filters, sort controls, and application-status selectors. */
export function Dropdown({ value, onChange, options, label, disabled = false, placeholder, variant = "filter", className = "" }: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPresent, setIsPresent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function finishClose(restoreFocus = false) {
    setIsOpen(false);
    setIsClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    closeTimer.current = setTimeout(() => {
      setIsPresent(false);
      setIsClosing(false);
      if (restoreFocus) triggerRef.current?.focus();
    }, delay);
  }

  function openMenu() {
    if (disabled) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setOpensUp(window.innerHeight - rect.bottom < 220 && rect.top > window.innerHeight - rect.bottom);
    setIsPresent(true);
    setIsClosing(false);
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) finishClose(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const index = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : options.findIndex((option) => !option.disabled);
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }, [isOpen, selectedIndex, options]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function select(option: DropdownOption) {
    if (option.disabled) return;
    if (option.value !== value) onChange(option.value);
    finishClose(true);
  }

  function moveFocus(current: number, direction: 1 | -1) {
    let index = current;
    do {
      index = (index + direction + options.length) % options.length;
    } while (options[index]?.disabled && index !== current);
    optionRefs.current[index]?.focus();
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number, option: DropdownOption) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const step = event.key === "Home" ? 1 : -1;
      const start = event.key === "Home" ? -1 : 0;
      moveFocus(start, step);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishClose(true);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      select(option);
    } else if (event.key === "Tab") {
      finishClose(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isPresent ? listboxId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => (isOpen ? finishClose(false) : openMenu())}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === " ") && !isOpen) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={`${TRIGGER_STYLES[variant]} relative transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:opacity-60 ${variant === "compact" ? "text-current" : ""}`}
      >
        <span className="block truncate">{selected?.label ?? placeholder ?? label}</span>
        <Icon name="chevron-down" className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isPresent && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          aria-hidden={!isOpen}
          className={`dropdown-menu absolute z-40 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg ${opensUp ? "dropdown-menu-up bottom-full mb-1" : "top-full mt-1"} ${isClosing ? "dropdown-menu-out" : "dropdown-menu-in"}`}
        >
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled || !isOpen}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => select(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index, option)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                  option.value === value ? "bg-brand-50 text-brand-800" : "text-gray-700 hover:bg-gray-100 focus:bg-gray-100"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value && <Icon name="check" className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
