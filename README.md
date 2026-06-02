# Trade Journal

A personal, manual trading journal for tracking a monthly stock + options
challenge (e.g. starting with $200 each month and withdrawing the
remainder at month-end).

## Features

- Create a new trading month with a custom starting balance.
- Log stock buys/sells and option buys/sells (options auto multiply by 100).
- Automatic balance updates after every trade.
- Running profit/loss and monthly return percentage.
- Close month → see withdrawal amount; reopen to keep editing.
- Edit & delete trades; balances recompute automatically.
- Multiple months stored in localStorage.
- Dark, mobile-first responsive UI.
- Sample data preloaded on first visit.

## Tech stack

- Next.js 14 (App Router) + React 18
- TypeScript
- Tailwind CSS
- localStorage persistence (key: `trade-journal:v1`)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Live stock prices

The Trade History shows a **Hindsight** column for each stock trade —
how much you'd be up or down right now at the live price relative to
that trade. Positive numbers (green) mean the trade was a good call in
hindsight; negative numbers (red) mean you'd have been better off doing
the opposite.

Quotes are fetched by the `/api/quote` server route. Two providers, in
order of preference:

1. **Finnhub** — set `FINNHUB_API_KEY` (free tier, 60 req/min, signup at
   <https://finnhub.io/dashboard>). Most reliable.
2. **Yahoo Finance** unauthenticated chart endpoint — used automatically
   if no Finnhub key is set. May rate-limit or be blocked depending on
   region/host.

Options aren't supported (free APIs don't return option chains), so
option rows show `—` in the Hindsight column.

Copy `.env.example` to `.env.local` to configure.

## How balances work

- Stock total: `quantity × price`
- Option total: `quantity × premium × 100`
- Buy: subtract total from balance
- Sell: add total to balance
- Realized P/L: `currentBalance - startingBalance`
- Monthly return: `realizedPL / startingBalance × 100`

All data stays in your browser — no servers, no brokerage APIs, no live prices.
