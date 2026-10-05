import { NextResponse } from "next/server";
import { getKiteLoginUrl, isKiteConfigured } from "@/lib/kite";

export async function GET() {
  if (!isKiteConfigured()) {
    return NextResponse.json(
      { error: "Kite API is not configured. See README for setup." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(getKiteLoginUrl());
}
