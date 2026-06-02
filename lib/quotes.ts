export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  fetchedAt: number;
}

const CACHE_KEY = "trade-journal:quotes:v1";
const CACHE_TTL_MS = 60_000;

export function loadQuoteCache(): Record<string, Quote> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Quote>;
  } catch {
    return {};
  }
}

export function saveQuoteCache(q: Record<string, Quote>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(q));
  } catch {
    // quota or disabled storage — non-fatal
  }
}

export function isFresh(q: Quote, ttl = CACHE_TTL_MS): boolean {
  return Date.now() - q.fetchedAt < ttl;
}

export interface FetchQuotesResult {
  quotes: Record<string, Quote>;
  errors: Record<string, string>;
  source: string | null;
}

export async function fetchQuotes(symbols: string[]): Promise<FetchQuotesResult> {
  const empty: FetchQuotesResult = { quotes: {}, errors: {}, source: null };
  if (symbols.length === 0) return empty;
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));

  let res: Response;
  try {
    res = await fetch(`/api/quote?symbols=${encodeURIComponent(unique.join(","))}`);
  } catch {
    return {
      ...empty,
      errors: Object.fromEntries(unique.map((s) => [s, "network error"])),
    };
  }
  if (!res.ok) {
    return {
      ...empty,
      errors: Object.fromEntries(unique.map((s) => [s, `HTTP ${res.status}`])),
    };
  }
  const data = (await res.json().catch(() => ({}))) as {
    quotes?: Record<
      string,
      { price: number; prevClose: number; timestamp: number }
    >;
    errors?: Record<string, string>;
    source?: string;
  };
  const now = Date.now();
  const quotes: Record<string, Quote> = {};
  for (const [sym, q] of Object.entries(data.quotes ?? {})) {
    quotes[sym] = {
      symbol: sym,
      price: q.price,
      prevClose: q.prevClose,
      fetchedAt: now,
    };
  }
  return {
    quotes,
    errors: data.errors ?? {},
    source: data.source ?? null,
  };
}
