import { NextResponse } from "next/server";

// Server-side quote proxy. Two providers, in order of preference:
//   1. Twelve Data (if TWELVEDATA_API_KEY is set) — free tier 8 req/min,
//      800 req/day. Reliable, supports batch fetch by comma-separated symbols.
//   2. Yahoo Finance unofficial chart endpoint — no auth, but Yahoo blocks
//      many cloud-provider IPs (including AWS/Vercel), so it's only useful
//      as a last-resort dev fallback.
//
// Options aren't supported — only equities.

interface QuoteData {
  price: number;
  prevClose: number;
  timestamp: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Twelve Data /quote returns {symbol, close, previous_close, timestamp, ...}
// for a single symbol, or {SYM1: {...}, SYM2: {...}} for multiple.
// Errored symbols come back as {code, message, status: "error"}.
interface TDQuote {
  symbol?: string;
  close?: string;
  previous_close?: string;
  timestamp?: number | string;
  status?: string;
  code?: number;
  message?: string;
}

function parseTwelveData(raw: TDQuote): QuoteData | null {
  if (!raw || raw.status === "error" || raw.code) return null;
  const price = raw.close != null ? parseFloat(String(raw.close)) : NaN;
  if (!Number.isFinite(price) || price === 0) return null;
  const prevClose =
    raw.previous_close != null ? parseFloat(String(raw.previous_close)) : NaN;
  const ts = raw.timestamp != null ? Number(raw.timestamp) * 1000 : Date.now();
  return {
    price,
    prevClose: Number.isFinite(prevClose) ? prevClose : 0,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
  };
}

async function fetchTwelveData(
  symbols: string[],
  apiKey: string
): Promise<{ quotes: Record<string, QuoteData>; errors: Record<string, string> }> {
  const quotes: Record<string, QuoteData> = {};
  const errors: Record<string, string> = {};
  const url =
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(","))}` +
    `&apikey=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    for (const s of symbols) errors[s] = `twelvedata HTTP ${r.status}`;
    return { quotes, errors };
  }
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown> | TDQuote;

  // Single-symbol response shape: the quote object itself.
  if (symbols.length === 1) {
    const q = parseTwelveData(data as TDQuote);
    if (q) quotes[symbols[0]] = q;
    else errors[symbols[0]] = (data as TDQuote).message ?? "no data";
    return { quotes, errors };
  }

  // Multi-symbol response shape: { SYM: quoteObj }.
  for (const sym of symbols) {
    const entry = (data as Record<string, TDQuote>)[sym];
    const q = entry ? parseTwelveData(entry) : null;
    if (q) quotes[sym] = q;
    else errors[sym] = entry?.message ?? "no data";
  }
  return { quotes, errors };
}

async function fetchYahoo(symbol: string): Promise<QuoteData | null> {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`,
    {
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    }
  );
  if (!r.ok) return null;
  const d = (await r.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          regularMarketTime?: number;
          chartPreviousClose?: number;
        };
      }>;
    };
  };
  const meta = d?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  return {
    price: meta.regularMarketPrice,
    prevClose:
      typeof meta.previousClose === "number"
        ? meta.previousClose
        : meta.chartPreviousClose ?? 0,
    timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {}, errors: {}, source: "none" });
  }

  const twelveKey = process.env.TWELVEDATA_API_KEY;
  const quotes: Record<string, QuoteData> = {};
  const errors: Record<string, string> = {};
  let source: "twelvedata" | "yahoo" | "mixed" | "none" = "none";

  if (twelveKey) {
    try {
      const td = await fetchTwelveData(symbols, twelveKey);
      Object.assign(quotes, td.quotes);
      Object.assign(errors, td.errors);
      if (Object.keys(td.quotes).length > 0) source = "twelvedata";
    } catch (e) {
      for (const s of symbols) errors[s] = (e as Error).message || "twelvedata error";
    }
  }

  // Fallback for any symbols still missing.
  const missing = symbols.filter((s) => !quotes[s]);
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (sym) => {
        try {
          const q = await fetchYahoo(sym);
          if (q) {
            quotes[sym] = q;
            delete errors[sym];
            source = source === "twelvedata" ? "mixed" : "yahoo";
          } else if (!errors[sym]) {
            errors[sym] = "no data";
          }
        } catch (e) {
          if (!errors[sym]) errors[sym] = (e as Error).message || "fetch error";
        }
      })
    );
  }

  return NextResponse.json({ quotes, errors, source });
}
