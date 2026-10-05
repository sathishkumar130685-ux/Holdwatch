import { NextResponse } from "next/server";
import { isKiteConfigured } from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function GET() {
  const configured = isKiteConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      userId: null,
    });
  }
  const session = await getSession();
  return NextResponse.json({
    configured: true,
    connected: Boolean(session.accessToken && session.userId),
    userId: session.userId ?? null,
  });
}
