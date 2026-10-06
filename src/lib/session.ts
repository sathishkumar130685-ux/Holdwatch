import {
  getIronSession,
  webCookies,
  type SessionOptions,
} from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  accessToken?: string;
  userId?: string;
};

export function ironSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return {
    password,
    cookieName: "holdwatch_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}

/** Server Components / Route Handlers that return JSON (not redirects). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), ironSessionOptions());
}

/**
 * Route Handlers that redirect: bind session to the same Response so
 * Set-Cookie is not dropped (iron-session + Next.js App Router).
 */
export async function getSessionForResponse(
  request: Request,
  response: Response,
) {
  return getIronSession<SessionData>(
    webCookies(request, response),
    ironSessionOptions(),
  );
}
