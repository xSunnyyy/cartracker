"use client";

import type { Month, Trade } from "@/lib/types";
import { formatCurrency, formatPercent, monthStats } from "@/lib/calculations";

interface Props {
  month: Month;
  trades: Trade[];
  onCloseMonth: () => void;
  onReopenMonth: () => void;
  onDelete: () => void;
}

export function MonthCard({ month, trades, onCloseMonth, onReopenMonth, onDelete }: Props) {
  const stats = monthStats(month, trades);
  const isProfit = stats.realizedPL >= 0;
  const plClass = isProfit ? "text-profit" : "text-loss";

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">{month.name}</h2>
            {month.isClosed ? (
              <span className="pill-closed">Closed</span>
            ) : (
              <span className="pill-open">Open</span>
            )}
          </div>
          {month.notes && (
            <p className="text-sm text-gray-400 mt-1">{month.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {month.isClosed ? (
            <button onClick={onReopenMonth} className="btn-ghost text-xs px-3 py-2">
              Reopen
            </button>
          ) : (
            <button onClick={onCloseMonth} className="btn-success text-xs px-3 py-2">
              Close month
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Delete "${month.name}" and all its trades?`)) onDelete();
            }}
            className="btn-ghost text-xs px-3 py-2 text-red-300 hover:text-red-200"
            aria-label="Delete month"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Starting" value={formatCurrency(stats.startingBalance)} />
        <Stat
          label={month.isClosed ? "Ending balance" : "Current balance"}
          value={formatCurrency(stats.currentBalance)}
          big
        />
        <Stat
          label="Profit / Loss"
          value={formatCurrency(stats.realizedPL)}
          className={plClass}
        />
        <Stat
          label="Return"
          value={formatPercent(stats.returnPercent)}
          className={plClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
        <div className="rounded-lg bg-bg-input/60 border border-border-subtle px-3 py-2">
          <div className="text-gray-400 text-xs">Total spent (buys)</div>
          <div className="font-mono">{formatCurrency(stats.totalSpent)}</div>
        </div>
        <div className="rounded-lg bg-bg-input/60 border border-border-subtle px-3 py-2">
          <div className="text-gray-400 text-xs">Total received (sells)</div>
          <div className="font-mono">{formatCurrency(stats.totalReceived)}</div>
        </div>
      </div>

      {month.isClosed && (
        <div className="mt-4 rounded-xl border border-accent-green/40 bg-accent-green/10 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-300 mb-1">
            Withdraw amount
          </div>
          <div className="text-3xl font-bold font-mono">
            {formatCurrency(stats.currentBalance)}
          </div>
          {month.closedAt && (
            <div className="text-xs text-gray-400 mt-1">
              Closed {new Date(month.closedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  big,
  className,
}: {
  label: string;
  value: string;
  big?: boolean;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-bg-elevated/70 border border-border-subtle px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div
        className={`font-mono font-semibold ${big ? "text-2xl" : "text-lg"} ${className ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}
