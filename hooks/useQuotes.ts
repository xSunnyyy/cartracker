"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchQuotes,
  isFresh,
  loadQuoteCache,
  saveQuoteCache,
  type Quote,
} from "@/lib/quotes";

interface QuotesState {
  quotes: Record<string, Quote>;
  loading: boolean;
  errors: Record<string, string>;
  source: string | null;
  lastRefreshed: number | null;
}

export function useQuotes(symbols: string[]) {
  const [state, setState] = useState<QuotesState>(() => ({
    quotes: {},
    loading: false,
    errors: {},
    source: null,
    lastRefreshed: null,
  }));

  // Hydrate cache from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    const cached = loadQuoteCache();
    if (Object.keys(cached).length > 0) {
      setState((s) => ({ ...s, quotes: cached }));
    }
  }, []);

  const unique = useMemo(
    () =>
      Array.from(
        new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))
      ).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbols.join("|")]
  );

  const quotesRef = useRef(state.quotes);
  quotesRef.current = state.quotes;

  const refresh = useCallback(
    async (force = false) => {
      if (unique.length === 0) return;
      const toFetch = force
        ? unique
        : unique.filter(
            (s) => !quotesRef.current[s] || !isFresh(quotesRef.current[s])
          );
      if (toFetch.length === 0) return;

      setState((s) => ({ ...s, loading: true }));
      const result = await fetchQuotes(toFetch);
      setState((s) => {
        const merged = { ...s.quotes, ...result.quotes };
        saveQuoteCache(merged);
        return {
          quotes: merged,
          errors: { ...s.errors, ...result.errors },
          source: result.source ?? s.source,
          loading: false,
          lastRefreshed: Date.now(),
        };
      });
    },
    [unique]
  );

  // Auto-fetch missing/stale quotes whenever the symbol set changes.
  useEffect(() => {
    refresh(false);
  }, [refresh]);

  return { ...state, refresh };
}
