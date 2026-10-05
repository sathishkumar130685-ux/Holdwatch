import { NextResponse } from "next/server";
import { listAlertRules } from "@/lib/alerts-store";
import { evaluateAlerts } from "@/lib/alert-engine";
import {
  fetchHoldings,
  fetchLtp,
  instrumentKey,
  isKiteConfigured,
} from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function GET() {
  if (!isKiteConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session.accessToken || !session.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const holdings = await fetchHoldings(session.accessToken);
    const rules = await listAlertRules(session.userId);
    const instruments = holdings.map((h) =>
      instrumentKey(h.exchange, h.tradingsymbol),
    );
    const ltpRaw = await fetchLtp(session.accessToken, instruments);
    const ltpByInstrument: Record<string, number> = {};
    for (const [key, value] of Object.entries(ltpRaw)) {
      ltpByInstrument[key] = value.last_price;
    }

    const triggered = evaluateAlerts(holdings, ltpByInstrument, rules);

    const enriched = holdings.map((h) => {
      const key = instrumentKey(h.exchange, h.tradingsymbol);
      const lastPrice = ltpByInstrument[key] ?? h.last_price;
      const dropFromAvg =
        h.average_price > 0
          ? ((h.average_price - lastPrice) / h.average_price) * 100
          : 0;
      return { ...h, last_price: lastPrice, drop_from_avg_percent: dropFromAvg };
    });

    return NextResponse.json({
      holdings: enriched,
      triggered,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Watch check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
