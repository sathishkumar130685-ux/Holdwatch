import type { AlertRule } from "./types";

export type PriceSample = {
  at: string;
  price: number;
  prevClose: number | null;
};

const STORAGE_KEY = "holdwatch-price-log-v1";
const RULES_KEY = "holdwatch-alert-rules-v1";
const MAX_SAMPLES = 600;

export function instrumentLogKey(exchange: string, tradingsymbol: string) {
  return `${exchange}:${tradingsymbol}`;
}

export function readPriceLog(): Record<string, PriceSample[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PriceSample[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function appendPriceSamples(
  holdings: Array<{
    exchange: string;
    tradingsymbol: string;
    last_price: number;
    close_price?: number | null;
  }>,
): Record<string, PriceSample[]> {
  if (typeof window === "undefined") return {};
  const log = readPriceLog();
  const at = new Date().toISOString();

  for (const holding of holdings) {
    const key = instrumentLogKey(holding.exchange, holding.tradingsymbol);
    const samples = log[key] ?? [];
    samples.push({
      at,
      price: holding.last_price,
      prevClose:
        typeof holding.close_price === "number" ? holding.close_price : null,
    });
    log[key] = samples.slice(-MAX_SAMPLES);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function readLocalAlertRules(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlertRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalAlertRules(rules: AlertRule[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}
