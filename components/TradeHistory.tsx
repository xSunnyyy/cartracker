"use client";

import type { Trade } from "@/lib/types";
import {
  formatCurrency,
  openPositionQty,
  perTradePL,
  positionKey,
  sortTrades,
} from "@/lib/calculations";

interface Props {
  trades: Trade[];
  readOnly?: boolean;
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onSell?: (trade: Trade, remainingQty: number) => void;
}

export function TradeHistory({ trades, readOnly, onEdit, onDelete, onSell }: Props) {
  const sorted = sortTrades(trades);
  const openQty = openPositionQty(sorted);

  const remainingFor = (t: Trade): number => {
    if (t.action !== "buy") return 0;
    return Math.max(0, openQty.get(positionKey(t)) ?? 0);
  };

  if (sorted.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Trade history</h2>
        <p className="text-sm text-gray-400">
          No trades yet. Add your first trade using the form on the left.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Trade history</h2>
        <div className="text-xs text-gray-400">{sorted.length} trades</div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-border-subtle">
              <th className="py-2 px-2">Date</th>
              <th className="py-2 px-2">Ticker</th>
              <th className="py-2 px-2">Type</th>
              <th className="py-2 px-2">Action</th>
              <th className="py-2 px-2 text-right">Qty</th>
              <th className="py-2 px-2 text-right">Price</th>
              <th className="py-2 px-2 text-right">Total</th>
              <th className="py-2 px-2 text-right">Balance</th>
              <th className="py-2 px-2 text-right">P/L</th>
              <th className="py-2 px-2">Notes</th>
              {!readOnly && <th className="py-2 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const pl = perTradePL(t, sorted.slice(0, idx));
              return (
                <tr
                  key={t.id}
                  className="border-b border-border-subtle/60 hover:bg-bg-elevated/50"
                >
                  <td className="py-2.5 px-2 font-mono text-xs">{t.date}</td>
                  <td className="py-2.5 px-2 font-semibold">{t.ticker}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className={t.tradeType === "option" ? "pill-option" : "pill-stock"}
                    >
                      {t.tradeType === "option"
                        ? `${t.optionType?.toUpperCase()}${t.strike ? " " + t.strike : ""}`
                        : "Stock"}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={t.action === "buy" ? "pill-buy" : "pill-sell"}>
                      {t.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-right">{t.quantity}</td>
                  <td className="py-2.5 px-2 font-mono text-right">
                    {formatCurrency(t.price)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-right">
                    {formatCurrency(t.total)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-right">
                    {formatCurrency(t.balanceAfterTrade)}
                  </td>
                  <td
                    className={`py-2.5 px-2 font-mono text-right ${
                      pl == null ? "text-gray-500" : pl >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {pl == null ? "—" : formatCurrency(pl)}
                  </td>
                  <td className="py-2.5 px-2 text-gray-400 max-w-[180px] truncate">
                    {t.notes ?? ""}
                  </td>
                  {!readOnly && (
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      {remainingFor(t) > 0 && onSell && (
                        <button
                          onClick={() => onSell(t, remainingFor(t))}
                          className="text-xs text-green-300 hover:text-green-200 mr-2"
                          title={`Sell ${remainingFor(t)} open`}
                        >
                          Sell
                        </button>
                      )}
                      <button
                        onClick={() => onEdit?.(t)}
                        className="text-xs text-blue-300 hover:text-blue-200 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this trade?")) onDelete?.(t);
                        }}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.map((t, idx) => {
          const pl = perTradePL(t, sorted.slice(0, idx));
          return (
            <div
              key={t.id}
              className="rounded-lg bg-bg-elevated/60 border border-border-subtle p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-base">{t.ticker}</span>
                  <span
                    className={t.tradeType === "option" ? "pill-option" : "pill-stock"}
                  >
                    {t.tradeType === "option"
                      ? `${t.optionType?.toUpperCase()}${t.strike ? " " + t.strike : ""}`
                      : "Stock"}
                  </span>
                  <span className={t.action === "buy" ? "pill-buy" : "pill-sell"}>
                    {t.action.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{t.date}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div className="text-gray-400 text-xs">Qty × Price</div>
                <div className="text-right font-mono">
                  {t.quantity} × {formatCurrency(t.price)}
                </div>
                <div className="text-gray-400 text-xs">
                  {t.action === "buy" ? "Cost" : "Received"}
                </div>
                <div className="text-right font-mono">{formatCurrency(t.total)}</div>
                <div className="text-gray-400 text-xs">Balance after</div>
                <div className="text-right font-mono">
                  {formatCurrency(t.balanceAfterTrade)}
                </div>
                {pl != null && (
                  <>
                    <div className="text-gray-400 text-xs">P/L</div>
                    <div
                      className={`text-right font-mono ${
                        pl >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {formatCurrency(pl)}
                    </div>
                  </>
                )}
              </div>
              {t.notes && (
                <div className="mt-2 pt-2 border-t border-border-subtle text-xs text-gray-400">
                  {t.notes}
                </div>
              )}
              {!readOnly && (
                <div className="mt-2 flex gap-3 justify-end">
                  {remainingFor(t) > 0 && onSell && (
                    <button
                      onClick={() => onSell(t, remainingFor(t))}
                      className="text-xs text-green-300 hover:text-green-200"
                    >
                      Sell ({remainingFor(t)})
                    </button>
                  )}
                  <button
                    onClick={() => onEdit?.(t)}
                    className="text-xs text-blue-300 hover:text-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this trade?")) onDelete?.(t);
                    }}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
