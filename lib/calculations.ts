import type { Month, Trade } from "./types";

// Total cost/proceeds for a trade. Options are priced per contract × 100 shares.
export function computeTotal(
  tradeType: "stock" | "option",
  quantity: number,
  price: number
): number {
  const multiplier = tradeType === "option" ? 100 : 1;
  return quantity * price * multiplier;
}

// Apply a single trade to a running balance.
export function applyTrade(balance: number, trade: Pick<Trade, "action" | "total">): number {
  return trade.action === "buy" ? balance - trade.total : balance + trade.total;
}

// Recompute balanceAfterTrade for every trade in a month, in chronological/insertion order.
// Returns the updated trades and the ending balance.
export function recalcMonth(
  month: Month,
  trades: Trade[]
): { trades: Trade[]; endingBalance: number } {
  const sorted = sortTrades(trades);
  let balance = month.startingBalance;
  const updated = sorted.map((t) => {
    balance = applyTrade(balance, t);
    return { ...t, balanceAfterTrade: balance };
  });
  return { trades: updated, endingBalance: balance };
}

// Stable sort: by date ascending, then by id (which encodes creation order via timestamp).
export function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

export interface MonthStats {
  startingBalance: number;
  currentBalance: number;
  totalSpent: number;
  totalReceived: number;
  realizedPL: number;
  returnPercent: number;
  tradeCount: number;
}

export function monthStats(month: Month, trades: Trade[]): MonthStats {
  let totalSpent = 0;
  let totalReceived = 0;
  for (const t of trades) {
    if (t.action === "buy") totalSpent += t.total;
    else totalReceived += t.total;
  }
  const realizedPL = month.currentBalance - month.startingBalance;
  const returnPercent =
    month.startingBalance > 0 ? (realizedPL / month.startingBalance) * 100 : 0;
  return {
    startingBalance: month.startingBalance,
    currentBalance: month.currentBalance,
    totalSpent,
    totalReceived,
    realizedPL,
    returnPercent,
    tradeCount: trades.length,
  };
}

// Per-trade realized P/L (display heuristic): sells show their proceeds minus the
// average cost of prior buys of the same ticker within the month. Buys show no P/L.
// This is just an indicator — not a tax-grade FIFO calc.
export function perTradePL(trade: Trade, prior: Trade[]): number | null {
  if (trade.action !== "sell") return null;
  const sameTickerBuys = prior.filter(
    (t) =>
      t.action === "buy" &&
      t.ticker.toUpperCase() === trade.ticker.toUpperCase() &&
      t.tradeType === trade.tradeType
  );
  if (sameTickerBuys.length === 0) return null;
  const totalQty = sameTickerBuys.reduce((s, t) => s + t.quantity, 0);
  const totalCost = sameTickerBuys.reduce((s, t) => s + t.total, 0);
  if (totalQty === 0) return null;
  const avgCostBasis = totalCost / totalQty; // per unit (share or contract×100 already included)
  const costForSold = avgCostBasis * trade.quantity;
  return trade.total - costForSold;
}

// Identity for an open position: same ticker + trade type, and for options the
// same contract (type + strike + expiration). Used to net buys against sells.
export function positionKey(t: Trade): string {
  const ticker = t.ticker.toUpperCase();
  if (t.tradeType === "option") {
    return `${ticker}|opt|${t.optionType ?? ""}|${t.strike ?? ""}|${t.expiration ?? ""}`;
  }
  return `${ticker}|stock`;
}

// Net open quantity per position across all the given trades.
// Positive = still long; 0 or negative = fully closed (or net short, which this
// app doesn't really model — treat as closed).
export function openPositionQty(trades: Trade[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of trades) {
    const key = positionKey(t);
    const cur = out.get(key) ?? 0;
    out.set(key, t.action === "buy" ? cur + t.quantity : cur - t.quantity);
  }
  return out;
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
