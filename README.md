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

## How balances work

- Stock total: `quantity × price`
- Option total: `quantity × premium × 100`
- Buy: subtract total from balance
- Sell: add total to balance
- Realized P/L: `currentBalance - startingBalance`
- Monthly return: `realizedPL / startingBalance × 100`

All data stays in your browser — no servers, no brokerage APIs, no live prices.
