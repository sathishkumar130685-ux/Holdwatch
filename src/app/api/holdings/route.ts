import { NextResponse } from "next/server";
import { fetchHoldings, isKiteConfigured } from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function GET() {
  if (!isKiteConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const holdings = await fetchHoldings(session.accessToken);
    return NextResponse.json({ holdings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load holdings";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
