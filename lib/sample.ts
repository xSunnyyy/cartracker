import type { AppState, Month, Trade } from "./types";
import { computeTotal, recalcMonth } from "./calculations";

// Sample data: a $200 June 2026 challenge with a handful of stock + option trades.
export function buildSampleState(): AppState {
  const monthId = "m_sample_jun_2026";
  const month: Month = {
    id: monthId,
    name: "June 2026",
    startingBalance: 200,
    currentBalance: 200,
    isClosed: false,
    createdAt: new Date("2026-06-01T09:30:00").toISOString(),
    notes: "Sample $200 monthly challenge.",
  };

  const rawTrades: Omit<Trade, "total" | "balanceAfterTrade">[] = [
    {
      id: "t_1",
      monthId,
      date: "2026-06-02",
      ticker: "AAPL",
      tradeType: "stock",
      action: "buy",
      quantity: 1,
      price: 95,
      notes: "Opening position",
    },
    {
      id: "t_2",
      monthId,
      date: "2026-06-04",
      ticker: "AAPL",
      tradeType: "stock",
      action: "sell",
      quantity: 1,
      price: 102,
      notes: "Quick scalp",
    },
    {
      id: "t_3",
      monthId,
      date: "2026-06-08",
      ticker: "NTNX",
      tradeType: "option",
      action: "buy",
      optionType: "call",
      strike: 57,
      expiration: "2026-06-19",
      quantity: 1,
      price: 1.2,
      notes: "Earnings play",
    },
    {
      id: "t_4",
      monthId,
      date: "2026-06-10",
      ticker: "NTNX",
      tradeType: "option",
      action: "sell",
      optionType: "call",
      strike: 57,
      expiration: "2026-06-19",
      quantity: 1,
      price: 2.0,
      notes: "Closed for profit",
    },
  ];

  const trades: Trade[] = rawTrades.map((t) => ({
    ...t,
    total: computeTotal(t.tradeType, t.quantity, t.price),
    balanceAfterTrade: 0,
  }));

  const { trades: recomputed, endingBalance } = recalcMonth(month, trades);

  return {
    months: [{ ...month, currentBalance: endingBalance }],
    trades: recomputed,
    activeMonthId: monthId,
  };
}
