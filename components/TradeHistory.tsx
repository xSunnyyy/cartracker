"use client";

import { useMemo, useState } from "react";
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

type SortKey =
  | "date"
  | "ticker"
  | "type"
  | "action"
  | "quantity"
  | "price"
  | "total"
  | "balance"
  | "pl"
  | "hindsight"
  | "notes";
type SortDir = "asc" | "desc";

interface EnrichedRow {
  trade: Trade;
  pl: number | null;
  hindsightDelta: number | null;
  hindsightPrice: number | null;
  hindsightStatus: "ok" | "loading" | "na" | "err";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getSortValue(row: EnrichedRow, key: SortKey): string | number | null {
  const t = row.trade;
  switch (key) {
    case "date":
      return t.date;
    case "ticker":
      return t.ticker.toUpperCase();
    case "type":
      // Stocks first, then options grouped by contract.
      return t.tradeType === "option"
        ? `option|${t.optionType ?? ""}|${t.strike ?? 0}|${t.expiration ?? ""}`
        : "stock";
    case "action":
      return t.action;
    case "quantity":
      return t.quantity;
    case "price":
      return t.price;
    case "total":
      return t.total;
    case "balance":
      return t.balanceAfterTrade;
    case "pl":
      return row.pl;
    case "hindsight":
      return row.hindsightDelta;
    case "notes":
      return t.notes ?? "";
  }
}

function compareRows(
  a: EnrichedRow,
  b: EnrichedRow,
  key: SortKey,
  dir: SortDir
): number {
  const va = getSortValue(a, key);
  const vb = getSortValue(b, key);
  // Push nulls to the end regardless of direction so "no value" stays out of
  // the way.
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;

  let cmp = 0;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  if (cmp === 0) {
    // Stable tie-breaker: chronological by id (which encodes creation time).
    cmp = a.trade.id < b.trade.id ? -1 : a.trade.id > b.trade.id ? 1 : 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "ticker", label: "Ticker" },
  { key: "type", label: "Type" },
  { key: "action", label: "Action" },
  { key: "quantity", label: "Qty" },
  { key: "price", label: "Price" },
  { key: "total", label: "Total" },
  { key: "balance", label: "Balance" },
  { key: "pl", label: "P/L" },
  { key: "hindsight", label: "Hindsight" },
  { key: "notes", label: "Notes" },
];

export function TradeHistory({ trades, readOnly, onEdit, onDelete, onSell }: Props) {
  const chronological = sortTrades(trades);
  const openQty = openPositionQty(chronological);

  const stockSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          chronological
            .filter((t) => t.tradeType === "stock")
            .map((t) => t.ticker.toUpperCase())
        )
      ),
    [chronological]
  );

  const {
    quotes,
    loading: quotesLoading,
    errors: quoteErrors,
    source,
    lastRefreshed,
    refresh,
  } = useQuotes(stockSymbols);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const remainingFor = (t: Trade): number => {
    if (t.action !== "buy") return 0;
    return Math.max(0, openQty.get(positionKey(t)) ?? 0);
  };

  // Hindsight is only meaningful for sells: did you sell above or below the
  // current price? delta = (sellPrice − currentPrice) × qty. Positive = sold
  // higher than now (good call, green). Negative = missed out (red).
  const hindsightFor = (
    t: Trade
  ): {
    delta: number | null;
    price: number | null;
    status: "ok" | "loading" | "na" | "err";
  } => {
    if (t.tradeType !== "stock" || t.action !== "sell") {
      return { delta: null, price: null, status: "na" };
    }
    const q = quotes[t.ticker.toUpperCase()];
    if (!q) {
      if (quoteErrors[t.ticker.toUpperCase()])
        return { delta: null, price: null, status: "err" };
      return {
        delta: null,
        price: null,
        status: quotesLoading ? "loading" : "na",
      };
    }
    return {
      delta: (t.price - q.price) * t.quantity,
      price: q.price,
      status: "ok",
    };
  };

  // Compute P/L and Hindsight against the *chronological* order so cost-basis
  // and per-trade metrics stay correct regardless of how the user sorts.
  const enriched: EnrichedRow[] = useMemo(() => {
    return chronological.map((t, idx) => {
      const h = hindsightFor(t);
      return {
        trade: t,
        pl: perTradePL(t, chronological.slice(0, idx)),
        hindsightDelta: h.delta,
        hindsightPrice: h.price,
        hindsightStatus: h.status,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronological, quotes, quoteErrors, quotesLoading]);

  const sortedRows: EnrichedRow[] = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return arr;
  }, [enriched, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric/date columns default to descending (most recent / largest first)
      // since that's what people usually want when they click.
      const numericDefault: SortKey[] = [
        "date",
        "quantity",
        "price",
        "total",
        "balance",
        "pl",
        "hindsight",
      ];
      setSortDir(numericDefault.includes(key) ? "desc" : "asc");
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="opacity-25 ml-1">↕</span>;
    return (
      <span className="text-gray-200 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
    );
  };

  if (chronological.length === 0) {
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

  // Reusable cell renderer for header columns.
  const SortHeader = ({
    label,
    keyName,
    align,
    title,
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right";
    title?: string;
  }) => (
    <th
      onClick={() => toggleSort(keyName)}
      title={title}
      className={`py-2 px-2 cursor-pointer select-none hover:text-gray-200 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <span className="inline-flex items-center">
        {label}
        {sortArrow(keyName)}
      </span>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">Trade history</h2>
          <span className="text-xs text-gray-400">{chronological.length} trades</span>
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
              title="Quote provider couldn't return a price for some symbols. Try refreshing or set TWELVEDATA_API_KEY."
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

      {/* Mobile sort selector */}
      <div className="md:hidden mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-400">Sort by</span>
        <select
          className="select py-1.5 text-xs flex-1"
          value={sortKey}
          onChange={(e) => {
            const k = e.target.value as SortKey;
            setSortKey(k);
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="btn-ghost text-xs px-3 py-1.5"
          aria-label="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-border-subtle">
              <SortHeader label="Date" keyName="date" />
              <SortHeader label="Ticker" keyName="ticker" />
              <SortHeader label="Type" keyName="type" />
              <SortHeader label="Action" keyName="action" />
              <SortHeader label="Qty" keyName="quantity" align="right" />
              <SortHeader label="Price" keyName="price" align="right" />
              <SortHeader label="Total" keyName="total" align="right" />
              <SortHeader label="Balance" keyName="balance" align="right" />
              <SortHeader label="P/L" keyName="pl" align="right" />
              <SortHeader
                label="Hindsight"
                keyName="hindsight"
                align="right"
                title="Hindsight (sells only): (sellPrice − currentPrice) × qty. Positive = sold above current price. Negative = missed out."
              />
              <SortHeader label="Notes" keyName="notes" />
              {!readOnly && <th className="py-2 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const t = row.trade;
              const pl = row.pl;
              const h = {
                delta: row.hindsightDelta,
                price: row.hindsightPrice,
                status: row.hindsightStatus,
              };
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
        {sortedRows.map((row) => {
          const t = row.trade;
          const pl = row.pl;
          const h = {
            delta: row.hindsightDelta,
            price: row.hindsightPrice,
            status: row.hindsightStatus,
          };
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
                      Hindsight{" "}
                      <span className="opacity-60">@{formatCurrency(h.price!)}</span>
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
