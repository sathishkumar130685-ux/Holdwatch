import { NextResponse } from "next/server";
import { resolvePublicAppUrl } from "@/lib/kite";

/** Safe diagnostics: which env keys exist (no secret values). */
export async function GET() {
  const appUrl = resolvePublicAppUrl();
  return NextResponse.json({
    hasKiteApiKey: Boolean(process.env.KITE_API_KEY),
    hasKiteApiSecret: Boolean(process.env.KITE_API_SECRET),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    sessionSecretLongEnough: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    appUrl,
    appUrlFromVercel: Boolean(!process.env.APP_URL && process.env.VERCEL_URL),
    ready:
      Boolean(process.env.KITE_API_KEY) &&
      Boolean(process.env.KITE_API_SECRET) &&
      (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
      Boolean(appUrl),
  });
}
