import { NextResponse } from "next/server";

// Server-side quote proxy. Two providers, in order of preference:
//   1. Finnhub (if FINNHUB_API_KEY is set) — free tier, 60 req/min, reliable.
//   2. Yahoo Finance unofficial chart endpoint — no auth, may rate-limit or
//      block depending on region/host.
//
// Returns { quotes: { SYMBOL: { price, prevClose, timestamp } }, errors,
// source }. Options aren't supported — only equities.

interface QuoteData {
  price: number;
  prevClose: number;
  timestamp: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function fetchFinnhub(symbol: string, apiKey: string): Promise<QuoteData | null> {
  const r = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    { cache: "no-store" }
  );
  if (!r.ok) return null;
  const d = (await r.json()) as { c?: number; pc?: number; t?: number };
  if (!d || typeof d.c !== "number" || d.c === 0) return null;
  return {
    price: d.c,
    prevClose: typeof d.pc === "number" ? d.pc : 0,
    timestamp: d.t ? d.t * 1000 : Date.now(),
  };
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

  const apiKey = process.env.FINNHUB_API_KEY;
  const quotes: Record<string, QuoteData> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        let q: QuoteData | null = null;
        if (apiKey) q = await fetchFinnhub(sym, apiKey);
        if (!q) q = await fetchYahoo(sym);
        if (q) quotes[sym] = q;
        else errors[sym] = "no data";
      } catch (e) {
        errors[sym] = (e as Error).message || "fetch error";
      }
    })
  );

  return NextResponse.json({
    quotes,
    errors,
    source: apiKey ? "finnhub" : "yahoo",
  });
}
