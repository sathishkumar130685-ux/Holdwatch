import { NextRequest, NextResponse } from "next/server";
import { homeRedirectUrl } from "@/lib/kite";
import { getSessionForResponse } from "@/lib/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(homeRedirectUrl(request, {}), 303);
  const session = await getSessionForResponse(request, response);
  session.destroy();
  return response;
}
