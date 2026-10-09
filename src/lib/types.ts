export type KiteHolding = {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  close_price?: number;
  day_change?: number;
  pnl: number;
  day_change_percentage: number;
};

export type AlertBasis = "average" | "prev_close";

export const DAY_DROP_LEVELS = [1, 2, 3, 4, 5] as const;

export type AlertRule = {
  id: string;
  tradingsymbol: string;
  exchange: string;
  enabled: boolean;
  /** average: one threshold vs buy price. prev_close: 1–5% vs yesterday. */
  basis?: AlertBasis;
  /** Fire when LTP is at least this % below your average buy price */
  dropPercentFromAvg: number;
  /** Used when basis is prev_close. */
  dropLevels?: number[];
  createdAt: string;
};

export type TriggeredAlert = {
  ruleId: string;
  tradingsymbol: string;
  exchange: string;
  basis: AlertBasis;
  /** Crossed threshold: average rule uses its one percent; day rule uses 1–5. */
  level: number;
  message: string;
  lastPrice: number;
  averagePrice: number;
  dropPercent: number;
  triggeredAt: string;
};
