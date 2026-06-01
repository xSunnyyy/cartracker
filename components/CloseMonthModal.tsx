"use client";

import type { Month, Trade } from "@/lib/types";
import { formatCurrency, formatPercent, monthStats } from "@/lib/calculations";

interface Props {
  month: Month;
  trades: Trade[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseMonthModal({ month, trades, onConfirm, onCancel }: Props) {
  const stats = monthStats(month, trades);
  const isProfit = stats.realizedPL >= 0;
  const plClass = isProfit ? "text-profit" : "text-loss";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-md card relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-1">Close {month.name}?</h2>
        <p className="text-sm text-gray-400 mb-4">
          Your withdrawal amount will be calculated and trades become read-only.
          You can reopen the month later.
        </p>

        <div className="space-y-2 mb-4">
          <Row label="Starting balance" value={formatCurrency(stats.startingBalance)} />
          <Row label="Ending balance" value={formatCurrency(stats.currentBalance)} />
          <Row
            label="Profit / Loss"
            value={formatCurrency(stats.realizedPL)}
            valueClass={plClass}
          />
          <Row
            label="Monthly return"
            value={formatPercent(stats.returnPercent)}
            valueClass={plClass}
          />
          <Row label="Trades" value={String(stats.tradeCount)} />
        </div>

        <div className="rounded-xl bg-accent-green/10 border border-accent-green/40 p-4 mb-5">
          <div className="text-xs uppercase tracking-wide text-emerald-300 mb-1">
            Withdraw amount
          </div>
          <div className="text-3xl font-bold font-mono">
            {formatCurrency(stats.currentBalance)}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onConfirm} className="btn-success flex-1">
            Close month
          </button>
          <button onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-mono font-semibold ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}
