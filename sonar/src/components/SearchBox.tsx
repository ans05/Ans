"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TYPE_LABEL, type Entity } from "@/domain/types";
import { TYPE_COLOR } from "@/graph/theme";

export default function SearchBox({
  search,
  onPick,
}: {
  search: (q: string) => Promise<Entity[]>;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Debounced async search (works the same for network-backed providers).
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const r = await search(q);
      if (!stale) { setResults(r); setActive(0); }
    }, 90);
    return () => { stale = true; clearTimeout(t); };
  }, [q, search]);

  // "/" focuses search from anywhere.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pick = (e: Entity) => {
    onPick(e.id);
    setQ("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full">
      <label htmlFor="sonar-search" className="sr-only">Search artists, producers, songs, labels and venues</label>
      <div className="flex items-center gap-3 border border-edge bg-panel/80 px-4 py-2.5 transition-colors focus-within:border-signal">
        <span aria-hidden className="font-mono text-xs text-signal">⌕</span>
        <input
          id="sonar-search"
          ref={inputRef}
          value={q}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search artists, producers, songs, labels…"
          className="w-full bg-transparent font-mono text-sm text-bone placeholder:text-dim focus:outline-none"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && results[active]) pick(results[active]);
            else if (e.key === "Escape") { setQ(""); inputRef.current?.blur(); }
          }}
        />
        <kbd className="hidden border border-edge px-1.5 font-mono text-[10px] text-dim sm:block">/</kbd>
      </div>
      {open && q.trim() && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-auto border border-edge bg-ink/95 backdrop-blur">
          {results.length === 0 && <li className="px-4 py-3 font-mono text-xs text-dim">No matches in the demo dataset</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === active ? "bg-edge/70" : ""}`}
              >
                <span className="truncate text-sm text-bone">{r.name}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-dim">
                  {r.city}
                  <span style={{ color: TYPE_COLOR[r.type] }}>{TYPE_LABEL[r.type]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
