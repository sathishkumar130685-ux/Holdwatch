import { NextResponse } from "next/server";
import { isKiteConfigured } from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    configured: isKiteConfigured(),
    connected: Boolean(session.accessToken && session.userId),
    userId: session.userId ?? null,
  });
}
