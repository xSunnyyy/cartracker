"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, Month, Trade } from "@/lib/types";
import { computeTotal, recalcMonth } from "@/lib/calculations";
import { loadState, saveState } from "@/lib/storage";
import { buildSampleState } from "@/lib/sample";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_STATE: AppState = { months: [], trades: [], activeMonthId: null };

export function useTradingData() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const firstLoad = useRef(true);

  // Hydrate from localStorage on first render (client only).
  useEffect(() => {
    const stored = loadState();
    setState(stored ?? buildSampleState());
    setHydrated(true);
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    saveState(state);
  }, [state, hydrated]);

  // After hydration, persist any seeded sample state so a refresh shows the same data.
  useEffect(() => {
    if (hydrated) saveState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const activeMonth: Month | null =
    state.months.find((m) => m.id === state.activeMonthId) ?? null;
  const tradesForActive: Trade[] = activeMonth
    ? state.trades.filter((t) => t.monthId === activeMonth.id)
    : [];

  const createMonth = useCallback(
    (name: string, startingBalance: number, notes?: string) => {
      const month: Month = {
        id: uid("m"),
        name: name.trim(),
        startingBalance,
        currentBalance: startingBalance,
        isClosed: false,
        createdAt: new Date().toISOString(),
        notes: notes?.trim() || undefined,
      };
      setState((s) => ({
        ...s,
        months: [month, ...s.months],
        activeMonthId: month.id,
      }));
    },
    []
  );

  const selectMonth = useCallback((id: string) => {
    setState((s) => ({ ...s, activeMonthId: id }));
  }, []);

  const deleteMonth = useCallback((id: string) => {
    setState((s) => {
      const months = s.months.filter((m) => m.id !== id);
      const trades = s.trades.filter((t) => t.monthId !== id);
      const activeMonthId =
        s.activeMonthId === id ? months[0]?.id ?? null : s.activeMonthId;
      return { months, trades, activeMonthId };
    });
  }, []);

  const closeMonth = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      months: s.months.map((m) =>
        m.id === id ? { ...m, isClosed: true, closedAt: new Date().toISOString() } : m
      ),
    }));
  }, []);

  const reopenMonth = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      months: s.months.map((m) =>
        m.id === id ? { ...m, isClosed: false, closedAt: undefined } : m
      ),
    }));
  }, []);

  const recomputeForMonth = (monthId: string, allTrades: Trade[], months: Month[]): {
    trades: Trade[];
    months: Month[];
  } => {
    const month = months.find((m) => m.id === monthId);
    if (!month) return { trades: allTrades, months };
    const monthTrades = allTrades.filter((t) => t.monthId === monthId);
    const { trades: recomputed, endingBalance } = recalcMonth(month, monthTrades);
    const recomputedIds = new Set(recomputed.map((t) => t.id));
    const merged = [
      ...allTrades.filter((t) => t.monthId !== monthId || !recomputedIds.has(t.id)),
      ...recomputed,
    ];
    return {
      trades: merged,
      months: months.map((m) =>
        m.id === monthId ? { ...m, currentBalance: endingBalance } : m
      ),
    };
  };

  const addTrade = useCallback(
    (input: Omit<Trade, "id" | "total" | "balanceAfterTrade">) => {
      setState((s) => {
        const total = computeTotal(input.tradeType, input.quantity, input.price);
        const newTrade: Trade = {
          ...input,
          id: uid("t"),
          total,
          balanceAfterTrade: 0,
        };
        const trades = [...s.trades, newTrade];
        const { trades: rebuilt, months } = recomputeForMonth(input.monthId, trades, s.months);
        return { ...s, months, trades: rebuilt };
      });
    },
    []
  );

  const updateTrade = useCallback(
    (id: string, patch: Partial<Omit<Trade, "id" | "monthId">>) => {
      setState((s) => {
        const trades = s.trades.map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch } as Trade;
          merged.total = computeTotal(merged.tradeType, merged.quantity, merged.price);
          return merged;
        });
        const target = trades.find((t) => t.id === id);
        if (!target) return s;
        const { trades: rebuilt, months } = recomputeForMonth(target.monthId, trades, s.months);
        return { ...s, months, trades: rebuilt };
      });
    },
    []
  );

  const deleteTrade = useCallback((id: string) => {
    setState((s) => {
      const target = s.trades.find((t) => t.id === id);
      if (!target) return s;
      const trades = s.trades.filter((t) => t.id !== id);
      const { trades: rebuilt, months } = recomputeForMonth(target.monthId, trades, s.months);
      return { ...s, months, trades: rebuilt };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(EMPTY_STATE);
  }, []);

  const loadSample = useCallback(() => {
    setState(buildSampleState());
  }, []);

  return {
    hydrated,
    state,
    activeMonth,
    tradesForActive,
    createMonth,
    selectMonth,
    deleteMonth,
    closeMonth,
    reopenMonth,
    addTrade,
    updateTrade,
    deleteTrade,
    resetAll,
    loadSample,
  };
}
