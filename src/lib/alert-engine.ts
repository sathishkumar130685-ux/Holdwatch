import type { AlertRule, KiteHolding, TriggeredAlert } from "./types";
import { instrumentKey } from "./kite";

export function evaluateAlerts(
  holdings: KiteHolding[],
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

    const key = instrumentKey(rule.exchange, rule.tradingsymbol);
    const lastPrice = ltpByInstrument[key] ?? holding.last_price;
    const averagePrice = holding.average_price;
    if (averagePrice <= 0) continue;

    const dropPercent = ((averagePrice - lastPrice) / averagePrice) * 100;
    if (dropPercent < rule.dropPercentFromAvg) continue;

    triggered.push({
      ruleId: rule.id,
      tradingsymbol: rule.tradingsymbol,
      exchange: rule.exchange,
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
