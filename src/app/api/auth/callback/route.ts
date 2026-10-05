import { NextRequest, NextResponse } from "next/server";
import { exchangeRequestToken, getAppUrl, isKiteConfigured } from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!isKiteConfigured()) {
    return NextResponse.redirect(`${getAppUrl()}/?error=not_configured`);
  }

  const requestToken = request.nextUrl.searchParams.get("request_token");
  const status = request.nextUrl.searchParams.get("status");

  if (status === "error" || !requestToken) {
    return NextResponse.redirect(`${getAppUrl()}/?error=login_failed`);
  }

  try {
    const { access_token, user_id } = await exchangeRequestToken(requestToken);
    const session = await getSession();
    session.accessToken = access_token;
    session.userId = user_id;
    await session.save();
    return NextResponse.redirect(`${getAppUrl()}/?connected=1`);
  } catch {
    return NextResponse.redirect(`${getAppUrl()}/?error=token_exchange`);
  }
}
