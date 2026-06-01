export type TradeType = "stock" | "option";
export type TradeAction = "buy" | "sell";
export type OptionType = "call" | "put";

export interface Month {
  id: string;
  name: string;
  startingBalance: number;
  currentBalance: number;
  isClosed: boolean;
  createdAt: string;
  closedAt?: string;
  notes?: string;
}

export interface Trade {
  id: string;
  monthId: string;
  date: string;
  ticker: string;
  tradeType: TradeType;
  action: TradeAction;
  quantity: number;
  price: number;
  total: number;
  balanceAfterTrade: number;
  notes?: string;
  optionType?: OptionType;
  strike?: number;
  expiration?: string;
}

export interface AppState {
  months: Month[];
  trades: Trade[];
  activeMonthId: string | null;
}
