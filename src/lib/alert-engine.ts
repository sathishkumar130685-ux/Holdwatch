import type { AlertRule, KiteHolding, TriggeredAlert } from "./types";
import { DAY_DROP_LEVELS } from "./types";

type HoldingPrice = Pick<
  KiteHolding,
  "tradingsymbol" | "exchange" | "average_price" | "last_price" | "day_change"
> & {
  close_price?: number | null;
};

export function previousClose(holding: HoldingPrice): number | null {
  if (typeof holding.close_price === "number" && holding.close_price > 0) {
    return holding.close_price;
  }
  if (
    typeof holding.day_change === "number" &&
    Number.isFinite(holding.day_change) &&
    holding.last_price > 0
  ) {
    const derived = holding.last_price - holding.day_change;
    return derived > 0 ? derived : null;
  }
  return null;
}

export function evaluateAlerts(
  holdings: HoldingPrice[],
  ltpByInstrument: Record<string, number>,
  rules: AlertRule[],
): TriggeredAlert[] {
  const now = new Date().toISOString();
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const holding = holdings.find(
      (h) =>
        h.tradingsymbol === rule.tradingsymbol &&
        h.exchange === rule.exchange,
    );
    if (!holding) continue;

    const key = `${rule.exchange}:${rule.tradingsymbol}`;
    const lastPrice = ltpByInstrument[key] ?? holding.last_price;
    const basis = rule.basis ?? "average";

    if (basis === "prev_close") {
      const prevClose = previousClose(holding);
      if (!prevClose) continue;
      const dropPercent = ((prevClose - lastPrice) / prevClose) * 100;
      const levels = rule.dropLevels?.length
        ? rule.dropLevels
        : [...DAY_DROP_LEVELS];
      for (const level of levels) {
        if (dropPercent < level) continue;
        triggered.push({
          ruleId: rule.id,
          tradingsymbol: rule.tradingsymbol,
          exchange: rule.exchange,
          basis,
          level,
          message: `${rule.tradingsymbol} is down ${dropPercent.toFixed(
            2,
          )}% from yesterday's close (crossed ${level}%)`,
          lastPrice,
          averagePrice: prevClose,
          dropPercent,
          triggeredAt: now,
        });
      }
      continue;
    }

    const averagePrice = holding.average_price;
    if (averagePrice <= 0) continue;

    const dropPercent = ((averagePrice - lastPrice) / averagePrice) * 100;
    if (dropPercent < rule.dropPercentFromAvg) continue;

    triggered.push({
      ruleId: rule.id,
      tradingsymbol: rule.tradingsymbol,
      exchange: rule.exchange,
      basis: "average",
      level: rule.dropPercentFromAvg,
      message: `${rule.tradingsymbol} is down ${dropPercent.toFixed(
        2,
      )}% from your average (alert at ${rule.dropPercentFromAvg}%)`,
      lastPrice,
      averagePrice,
      dropPercent,
      triggeredAt: now,
    });
  }

  return triggered;
}
