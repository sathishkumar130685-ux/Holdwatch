import { NextRequest, NextResponse } from "next/server";
import { listAlertRules, saveAlertRules } from "@/lib/alerts-store";
import type { AlertRule } from "@/lib/types";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  const rules = await listAlertRules(session.userId);
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = (await request.json()) as {
    tradingsymbol: string;
    exchange: string;
    dropPercentFromAvg: number;
  };

  if (
    !body.tradingsymbol ||
    !body.exchange ||
    typeof body.dropPercentFromAvg !== "number" ||
    body.dropPercentFromAvg <= 0 ||
    body.dropPercentFromAvg > 100
  ) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 400 });
  }

  const rules = await listAlertRules(session.userId);
  const rule: AlertRule = {
    id: crypto.randomUUID(),
    tradingsymbol: body.tradingsymbol.toUpperCase(),
    exchange: body.exchange.toUpperCase(),
    dropPercentFromAvg: body.dropPercentFromAvg,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  const next = [...rules.filter((r) => !(r.tradingsymbol === rule.tradingsymbol && r.exchange === rule.exchange)), rule];
  await saveAlertRules(session.userId, next);
  return NextResponse.json({ rules: next });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const rules = await listAlertRules(session.userId);
  const next = rules.filter((r) => r.id !== id);
  await saveAlertRules(session.userId, next);
  return NextResponse.json({ rules: next });
}
