"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option { value: string; label: string; }

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select...", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label));
  const filtered = search.trim()
    ? sorted.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : sorted;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }
    setOpen((prev) => !prev);
    if (open) setSearch("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between bg-card text-foreground border border-border px-3 py-2 rounded-lg text-sm outline-none hover:border-border/80 transition-colors"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); setOpen(false); }}
              className="hover:text-foreground text-muted-foreground p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown — fixed position to escape overflow:hidden parents */}
      {open && (
        <div
          style={dropdownStyle}
          className="bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              style={{ border: "none", padding: 0 }}
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {placeholder}
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">No results found.</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                    o.value === value ? "bg-muted/30 font-medium text-foreground" : "text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}