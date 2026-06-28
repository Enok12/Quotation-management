"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, type Country } from "@/lib/data/countries";
import { cn } from "@/lib/utils/cn";

// ISO-2 country code → flag emoji.
function flag(code: string) {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const DEFAULT = COUNTRIES[0]; // Sri Lanka

/**
 * Phone field with a searchable country-code dropdown beside the number.
 * Emits the combined value ("+94 771234567") via onChange, or "" when blank
 * so required-validation still fires.
 */
export function PhoneInput({
  value,
  onChange,
  error,
}: {
  value?: string;
  onChange: (full: string) => void;
  error?: boolean;
}) {
  const [country, setCountry] = useState<Country>(DEFAULT);
  const [number, setNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Seed from an existing value (e.g. edit/prefill): "+94 771234567".
  useEffect(() => {
    if (!value) return;
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => value.startsWith(c.dial));
    if (match) {
      setCountry(match);
      setNumber(value.slice(match.dial.length).trim());
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (c: Country, n: string) => {
    const digits = n.trim();
    onChange(digits ? `${c.dial} ${digits}` : "");
  };

  const pickCountry = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setQuery("");
    emit(c, number);
  };

  const onNumber = (n: string) => {
    const cleaned = n.replace(/[^\d\s-]/g, "");
    setNumber(cleaned);
    emit(country, cleaned);
  };

  // Close on outside click; focus the search when opened.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div ref={rootRef} className="relative">
      <div className={cn("flex", error && "rounded ring-1 ring-red-300")}>
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm bg-white border border-stone-200 border-r-0 rounded-l hover:bg-stone-50 transition-colors whitespace-nowrap"
        >
          <span className="text-base leading-none">{flag(country.code)}</span>
          <span className="text-stone-700">{country.dial}</span>
          <ChevronDown size={14} className="text-stone-400" />
        </button>

        {/* Number */}
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumber(e.target.value)}
          placeholder="77 123 4567"
          className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-r focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors placeholder:text-stone-400"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-72 max-w-[90vw] bg-white border border-stone-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-stone-200 rounded outline-none focus:border-amber-400"
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-stone-400 text-center">No matches</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => pickCountry(c)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-stone-50 transition-colors",
                    c.code === country.code && "bg-amber-50",
                  )}
                >
                  <span className="text-base leading-none">{flag(c.code)}</span>
                  <span className="flex-1 text-ink truncate">{c.name}</span>
                  <span className="text-stone-400">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
