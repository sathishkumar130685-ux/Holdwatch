import { NextRequest, NextResponse } from "next/server";
import {
  exchangeRequestToken,
  homeRedirectUrl,
  isKiteConfigured,
} from "@/lib/kite";
import { getSessionForResponse } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!isKiteConfigured()) {
    const response = NextResponse.redirect(
      homeRedirectUrl(request, { error: "not_configured" }),
    );
    return response;
  }

  const requestToken = request.nextUrl.searchParams.get("request_token");
  const status = request.nextUrl.searchParams.get("status");

  if (status === "error" || !requestToken) {
    return NextResponse.redirect(
      homeRedirectUrl(request, { error: "login_failed" }),
    );
  }

  const successUrl = homeRedirectUrl(request, { connected: "1" });
  const response = NextResponse.redirect(successUrl);

  try {
    const { access_token, user_id } = await exchangeRequestToken(requestToken);
    const session = await getSessionForResponse(request, response);
    session.accessToken = access_token;
    session.userId = user_id;
    await session.save();
    return response;
  } catch {
    return NextResponse.redirect(
      homeRedirectUrl(request, { error: "token_exchange" }),
    );
  }
}
