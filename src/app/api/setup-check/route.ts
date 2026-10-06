import { NextResponse } from "next/server";
import { kiteOAuthCallbackUrl, resolvePublicAppUrl } from "@/lib/kite";

/** Safe diagnostics: which env keys exist (no secret values). */
export async function GET() {
  const appUrl = resolvePublicAppUrl();
  const kiteRedirectUrl = kiteOAuthCallbackUrl();
  return NextResponse.json({
    hasKiteApiKey: Boolean(process.env.KITE_API_KEY),
    hasKiteApiSecret: Boolean(process.env.KITE_API_SECRET),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    sessionSecretLongEnough: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    appUrl,
    kiteRedirectUrl,
    kiteRedirectHint:
      "Kite Connect allows only ONE redirect URL. It must match kiteRedirectUrl exactly. If it still points to localhost, Zerodha will always send you to localhost after login.",
    appUrlFromVercel: Boolean(!process.env.APP_URL && process.env.VERCEL_URL),
    ready:
      Boolean(process.env.KITE_API_KEY) &&
      Boolean(process.env.KITE_API_SECRET) &&
      (process.env.SESSION_SECRET?.length ?? 0) >= 32 &&
      Boolean(appUrl),
  });
}
