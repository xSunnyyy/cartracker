"use client";

import { useMemo } from "react";
import type { Trade } from "@/lib/types";
import {
  formatCurrency,
  openPositionQty,
  perTradePL,
  positionKey,
  sortTrades,
} from "@/lib/calculations";
import { useQuotes } from "@/hooks/useQuotes";

interface Props {
  trades: Trade[];
  readOnly?: boolean;
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onSell?: (trade: Trade, remainingQty: number) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TradeHistory({ trades, readOnly, onEdit, onDelete, onSell }: Props) {
  const sorted = sortTrades(trades);
  const openQty = openPositionQty(sorted);

  const stockSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          sorted
            .filter((t) => t.tradeType === "stock")
            .map((t) => t.ticker.toUpperCase())
        )
      ),
    [sorted]
  );

  const {
    quotes,
    loading: quotesLoading,
    errors: quoteErrors,
    source,
    lastRefreshed,
    refresh,
  } = useQuotes(stockSymbols);

  const remainingFor = (t: Trade): number => {
    if (t.action !== "buy") return 0;
    return Math.max(0, openQty.get(positionKey(t)) ?? 0);
  };

  // Hindsight = what you'd be up/down right now relative to this trade.
  //   Buys:  (current - tradePrice) × qty  (would-have-gained if held)
  //   Sells: (tradePrice - current) × qty  (saved from later drop, or missed gain)
  // Positive = good call retrospectively (green); negative = bad call (red).
  const hindsightFor = (
    t: Trade
  ): { delta: number | null; price: number | null; status: "ok" | "loading" | "na" | "err" } => {
    if (t.tradeType !== "stock") return { delta: null, price: null, status: "na" };
    const q = quotes[t.ticker.toUpperCase()];
    if (!q) {
      if (quoteErrors[t.ticker.toUpperCase()]) return { delta: null, price: null, status: "err" };
      return { delta: null, price: null, status: quotesLoading ? "loading" : "na" };
    }
    const dir = t.action === "buy" ? 1 : -1;
    return {
      delta: dir * (q.price - t.price) * t.quantity,
      price: q.price,
      status: "ok",
    };
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

  const errorCount = Object.keys(quoteErrors).filter((s) => !quotes[s]).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">Trade history</h2>
          <span className="text-xs text-gray-400">{sorted.length} trades</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {lastRefreshed && (
            <span title={`Source: ${source ?? "n/a"}`}>
              Prices {formatTime(lastRefreshed)}
              {source && <span className="ml-1 opacity-60">· {source}</span>}
            </span>
          )}
          {errorCount > 0 && (
            <span
              className="text-amber-300"
              title="Quote provider couldn't return a price for some symbols. Try refreshing or set FINNHUB_API_KEY."
            >
              {errorCount} unavailable
            </span>
          )}
          <button
            onClick={() => refresh(true)}
            disabled={quotesLoading || stockSymbols.length === 0}
            className="text-blue-300 hover:text-blue-200 disabled:opacity-50"
          >
            {quotesLoading ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
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
              <th
                className="py-2 px-2 text-right"
                title="Hindsight: what you'd be up or down right now at the current stock price relative to this trade. Positive = good call, negative = bad call."
              >
                Hindsight
              </th>
              <th className="py-2 px-2">Notes</th>
              {!readOnly && <th className="py-2 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const pl = perTradePL(t, sorted.slice(0, idx));
              const h = hindsightFor(t);
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
                  <td
                    className={`py-2.5 px-2 font-mono text-right ${
                      h.delta == null
                        ? "text-gray-500"
                        : h.delta >= 0
                        ? "text-profit"
                        : "text-loss"
                    }`}
                  >
                    {h.status === "na" && "—"}
                    {h.status === "loading" && <span className="opacity-50">…</span>}
                    {h.status === "err" && (
                      <span
                        className="text-amber-300/70"
                        title={quoteErrors[t.ticker.toUpperCase()]}
                      >
                        n/a
                      </span>
                    )}
                    {h.status === "ok" && h.delta != null && (
                      <span className="flex flex-col items-end leading-tight">
                        <span>{formatCurrency(h.delta)}</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          @{formatCurrency(h.price!)}
                        </span>
                      </span>
                    )}
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
          const h = hindsightFor(t);
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
                {h.status === "ok" && h.delta != null && (
                  <>
                    <div className="text-gray-400 text-xs">
                      Hindsight <span className="opacity-60">@{formatCurrency(h.price!)}</span>
                    </div>
                    <div
                      className={`text-right font-mono ${
                        h.delta >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {formatCurrency(h.delta)}
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
