import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/kite";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${getAppUrl()}/`, 303);
}
