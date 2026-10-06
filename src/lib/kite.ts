import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import type { KiteHolding } from "./types";

const KITE_API = "https://api.kite.trade";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your environment.`);
  }
  return value;
}

export function isKiteConfigured(): boolean {
  return Boolean(
    process.env.KITE_API_KEY &&
      process.env.KITE_API_SECRET &&
      process.env.SESSION_SECRET,
  );
}

function isLocalDevAppUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Public site URL for OAuth redirects (APP_URL, or Vercel’s auto hostname). */
export function resolvePublicAppUrl(): string | null {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(
    /^https?:\/\//,
    "",
  );
  const vercelHost =
    productionHost ||
    process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
  if (fromEnv) {
    // Common mistake: APP_URL=http://localhost:4321 copied into Vercel env.
    if (isLocalDevAppUrl(fromEnv) && vercelHost) {
      return `https://${vercelHost}`;
    }
    return fromEnv;
  }
  if (vercelHost) return `https://${vercelHost}`;
  return null;
}

/** Where to send the browser after OAuth — same host that received /api/auth/callback. */
export function redirectOriginFromRequest(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host.includes("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

export function homeRedirectUrl(
  request: NextRequest,
  searchParams: Record<string, string>,
): string {
  const url = new URL("/", redirectOriginFromRequest(request));
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function kiteOAuthCallbackUrl(): string | null {
  const base = resolvePublicAppUrl();
  return base ? `${base}/api/auth/callback` : null;
}

export function getAppUrl(): string {
  return resolvePublicAppUrl() ?? "http://localhost:4321";
}

export function getKiteLoginUrl(): string {
  const apiKey = requireEnv("KITE_API_KEY");
  return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;
}

export async function exchangeRequestToken(
  requestToken: string,
): Promise<{ access_token: string; user_id: string }> {
  const apiKey = requireEnv("KITE_API_KEY");
  const apiSecret = requireEnv("KITE_API_SECRET");
  const checksum = createHash("sha256")
    .update(apiKey + requestToken + apiSecret)
    .digest("hex");

  const res = await fetch(`${KITE_API}/session/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }),
  });

  const data = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { access_token: string; user_id: string };
  };

  if (!res.ok || data.status === "error" || !data.data?.access_token) {
    throw new Error(data.message ?? "Failed to obtain Kite access token");
  }

  return data.data;
}

async function kiteGet<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const apiKey = requireEnv("KITE_API_KEY");
  const res = await fetch(`${KITE_API}${path}`, {
    headers: {
      Authorization: `token ${apiKey}:${accessToken}`,
      "X-Kite-Version": "3",
    },
    cache: "no-store",
  });

  const data = (await res.json()) as {
    status?: string;
    message?: string;
    data?: T;
  };

  if (!res.ok || data.status === "error") {
    throw new Error(data.message ?? `Kite API error: ${path}`);
  }

  return data.data as T;
}

export async function fetchHoldings(accessToken: string): Promise<KiteHolding[]> {
  return kiteGet<KiteHolding[]>("/portfolio/holdings", accessToken);
}

export async function fetchLtp(
  accessToken: string,
  instruments: string[],
): Promise<Record<string, { last_price: number }>> {
  if (instruments.length === 0) return {};
  const query = instruments.map((i) => `i=${encodeURIComponent(i)}`).join("&");
  return kiteGet<Record<string, { last_price: number }>>(
    `/quote/ltp?${query}`,
    accessToken,
  );
}

export function instrumentKey(exchange: string, tradingsymbol: string): string {
  return `${exchange}:${tradingsymbol}`;
}
