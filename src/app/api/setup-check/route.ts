import { NextResponse } from "next/server";

/** Safe diagnostics: which env keys exist (no secret values). */
export async function GET() {
  return NextResponse.json({
    hasKiteApiKey: Boolean(process.env.KITE_API_KEY),
    hasKiteApiSecret: Boolean(process.env.KITE_API_SECRET),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    sessionSecretLongEnough: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    appUrl: process.env.APP_URL ?? null,
    ready:
      Boolean(process.env.KITE_API_KEY) &&
      Boolean(process.env.KITE_API_SECRET) &&
      (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
      Boolean(process.env.APP_URL),
  });
}
