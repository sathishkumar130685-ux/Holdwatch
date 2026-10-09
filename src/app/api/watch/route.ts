import { NextResponse } from "next/server";
import { listAlertRules } from "@/lib/alerts-store";
import { evaluateAlerts, previousClose } from "@/lib/alert-engine";
import {
  fetchHoldings,
  fetchLtp,
  instrumentKey,
  isKiteConfigured,
  KitePermissionError,
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
    // Personal (free) Kite apps can read holdings, which already include
    // last_price, but /quote/ltp returns 403 Insufficient permission.
    let ltpRaw: Record<string, { last_price: number }> = {};
    try {
      ltpRaw = await fetchLtp(session.accessToken, instruments);
    } catch (error) {
      if (!(error instanceof KitePermissionError)) throw error;
    }
    const ltpByInstrument: Record<string, number> = {};
    for (const [key, value] of Object.entries(ltpRaw)) {
      ltpByInstrument[key] = value.last_price;
    }

    const triggered = evaluateAlerts(holdings, ltpByInstrument, rules);

    const enriched = holdings.map((h) => {
      const key = instrumentKey(h.exchange, h.tradingsymbol);
      const lastPrice = ltpByInstrument[key] ?? h.last_price;
      const prevClose = previousClose(h);
      const dropFromAvg =
        h.average_price > 0
          ? ((h.average_price - lastPrice) / h.average_price) * 100
          : 0;
      const dropFromPrevClose =
        prevClose && prevClose > 0
          ? ((prevClose - lastPrice) / prevClose) * 100
          : null;
      return {
        ...h,
        last_price: lastPrice,
        close_price: prevClose ?? h.close_price,
        drop_from_avg_percent: dropFromAvg,
        drop_from_prev_close_percent: dropFromPrevClose,
      };
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
