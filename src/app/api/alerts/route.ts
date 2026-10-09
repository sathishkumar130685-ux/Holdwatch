import { NextRequest, NextResponse } from "next/server";
import { listAlertRules, saveAlertRules } from "@/lib/alerts-store";
import { DAY_DROP_LEVELS, type AlertRule } from "@/lib/types";
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
    dropPercentFromAvg?: number;
    basis?: "average" | "prev_close";
  };

  const basis = body.basis === "prev_close" ? "prev_close" : "average";
  const dropPercentFromAvg = body.dropPercentFromAvg;

  if (!body.tradingsymbol || !body.exchange) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 400 });
  }

  if (
    basis === "average" &&
    (typeof dropPercentFromAvg !== "number" ||
      dropPercentFromAvg <= 0 ||
      dropPercentFromAvg > 100)
  ) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 400 });
  }

  const rules = await listAlertRules(session.userId);
  const rule: AlertRule = {
    id: crypto.randomUUID(),
    tradingsymbol: body.tradingsymbol.toUpperCase(),
    exchange: body.exchange.toUpperCase(),
    basis,
    dropPercentFromAvg: basis === "average" ? dropPercentFromAvg! : 5,
    dropLevels: basis === "prev_close" ? [...DAY_DROP_LEVELS] : undefined,
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
