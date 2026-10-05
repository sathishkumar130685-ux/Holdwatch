export type KiteHolding = {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change_percentage: number;
};

export type AlertRule = {
  id: string;
  tradingsymbol: string;
  exchange: string;
  enabled: boolean;
  /** Fire when LTP is at least this % below your average buy price */
  dropPercentFromAvg: number;
  createdAt: string;
};

export type TriggeredAlert = {
  ruleId: string;
  tradingsymbol: string;
  exchange: string;
  message: string;
  lastPrice: number;
  averagePrice: number;
  dropPercent: number;
  triggeredAt: string;
};
