"use client";

import type { Month } from "@/lib/types";

interface Props {
  months: Month[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function MonthSwitcher({ months, activeId, onSelect, onNew }: Props) {
  if (months.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {months.map((m) => {
        const active = m.id === activeId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active
                ? "bg-accent-blue text-white border-accent-blue"
                : "bg-bg-elevated text-gray-300 border-border-subtle hover:border-border-strong"
            }`}
          >
            {m.name}
            {m.isClosed && <span className="ml-1.5 text-xs opacity-70">•</span>}
          </button>
        );
      })}
      <button
        onClick={onNew}
        className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-border-strong text-gray-300 hover:text-white hover:border-accent-blue"
      >
        + New month
      </button>
    </div>
  );
}
