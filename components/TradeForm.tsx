"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trade, TradeType, TradeAction, OptionType } from "@/lib/types";
import { computeTotal, formatCurrency } from "@/lib/calculations";

interface Props {
  monthId: string;
  availableBalance: number;
  initialTrade?: Trade;
  onSubmit: (trade: Omit<Trade, "id" | "total" | "balanceAfterTrade">) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TradeForm({
  monthId,
  availableBalance,
  initialTrade,
  onSubmit,
  onCancel,
  disabled,
}: Props) {
  const [tradeType, setTradeType] = useState<TradeType>(initialTrade?.tradeType ?? "stock");
  const [action, setAction] = useState<TradeAction>(initialTrade?.action ?? "buy");
  const [ticker, setTicker] = useState(initialTrade?.ticker ?? "");
  const [date, setDate] = useState(initialTrade?.date ?? todayISO());
  const [quantity, setQuantity] = useState(initialTrade?.quantity.toString() ?? "");
  const [price, setPrice] = useState(initialTrade?.price.toString() ?? "");
  const [notes, setNotes] = useState(initialTrade?.notes ?? "");
  const [optionType, setOptionType] = useState<OptionType>(initialTrade?.optionType ?? "call");
  const [strike, setStrike] = useState(initialTrade?.strike?.toString() ?? "");
  const [expiration, setExpiration] = useState(initialTrade?.expiration ?? "");
  const [error, setError] = useState<string | null>(null);

  // Reset when switching between create/edit targets.
  useEffect(() => {
    if (!initialTrade) return;
    setTradeType(initialTrade.tradeType);
    setAction(initialTrade.action);
    setTicker(initialTrade.ticker);
    setDate(initialTrade.date);
    setQuantity(initialTrade.quantity.toString());
    setPrice(initialTrade.price.toString());
    setNotes(initialTrade.notes ?? "");
    setOptionType(initialTrade.optionType ?? "call");
    setStrike(initialTrade.strike?.toString() ?? "");
    setExpiration(initialTrade.expiration ?? "");
  }, [initialTrade]);

  const qtyNum = parseFloat(quantity);
  const priceNum = parseFloat(price);
  const total = useMemo(() => {
    if (!Number.isFinite(qtyNum) || !Number.isFinite(priceNum)) return 0;
    return computeTotal(tradeType, qtyNum, priceNum);
  }, [qtyNum, priceNum, tradeType]);

  const projectedBalance =
    action === "buy" ? availableBalance - total : availableBalance + total;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!ticker.trim()) return setError("Ticker is required.");
    if (!date) return setError("Date is required.");
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return setError("Quantity must be > 0.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Price must be > 0.");
    if (tradeType === "option") {
      if (!Number.isFinite(parseFloat(strike)) || parseFloat(strike) <= 0)
        return setError("Strike must be > 0 for options.");
      if (!expiration) return setError("Expiration date is required for options.");
    }
    setError(null);

    const payload: Omit<Trade, "id" | "total" | "balanceAfterTrade"> = {
      monthId,
      date,
      ticker: ticker.trim().toUpperCase(),
      tradeType,
      action,
      quantity: qtyNum,
      price: priceNum,
      notes: notes.trim() || undefined,
      ...(tradeType === "option"
        ? {
            optionType,
            strike: parseFloat(strike),
            expiration,
          }
        : {}),
    };
    onSubmit(payload);

    if (!initialTrade) {
      // Reset for next entry, keep date and trade type for fast repeat entry.
      setTicker("");
      setQuantity("");
      setPrice("");
      setNotes("");
      setStrike("");
      setExpiration("");
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {initialTrade ? "Edit trade" : "Add trade"}
        </h2>
        {!initialTrade && (
          <div className="text-xs text-gray-400">
            Available: <span className="font-mono text-white">{formatCurrency(availableBalance)}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <SegmentedButton
            options={[
              { label: "Stock", value: "stock" },
              { label: "Option", value: "option" },
            ]}
            value={tradeType}
            onChange={(v) => setTradeType(v as TradeType)}
            disabled={disabled}
          />
          <SegmentedButton
            options={[
              { label: "Buy", value: "buy", activeClass: "bg-red-500/80 text-white" },
              { label: "Sell", value: "sell", activeClass: "bg-green-500/80 text-white" },
            ]}
            value={action}
            onChange={(v) => setAction(v as TradeAction)}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ticker">Ticker</label>
            <input
              id="ticker"
              className="input uppercase"
              placeholder="AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={10}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        {tradeType === "option" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-bg-elevated/60 border border-border-subtle">
            <div>
              <label className="label">Option type</label>
              <select
                className="select"
                value={optionType}
                onChange={(e) => setOptionType(e.target.value as OptionType)}
                disabled={disabled}
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="strike">Strike</label>
              <input
                id="strike"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="input"
                placeholder="57"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="expiration">Expiration</label>
              <input
                id="expiration"
                type="date"
                className="input"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="qty">
              {tradeType === "option" ? "Contracts" : "Shares"}
            </label>
            <input
              id="qty"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              className="input"
              placeholder="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="label" htmlFor="price">
              {tradeType === "option" ? "Premium (per share)" : "Price per share"}
            </label>
            <input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input"
              placeholder={tradeType === "option" ? "1.20" : "100.00"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <input
            id="notes"
            className="input"
            placeholder="Earnings play"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="rounded-lg bg-bg-input border border-border-subtle p-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-400 text-xs">
              {action === "buy" ? "Total cost" : "Total received"}
              {tradeType === "option" && " (× 100)"}
            </div>
            <div className="font-mono font-semibold text-lg">{formatCurrency(total)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Balance after</div>
            <div
              className={`font-mono font-semibold text-lg ${
                projectedBalance < 0 ? "text-loss" : ""
              }`}
            >
              {formatCurrency(projectedBalance)}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-loss">{error}</div>}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={disabled}>
            {initialTrade ? "Save changes" : "Add trade"}
          </button>
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function SegmentedButton<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: T; activeClass?: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-bg-input border border-border-subtle p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={`py-2 text-sm font-medium rounded-md transition-colors ${
              active
                ? opt.activeClass ?? "bg-accent-blue text-white"
                : "text-gray-300 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
