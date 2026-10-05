import { Dashboard } from "@/components/dashboard";
import { isKiteConfigured } from "@/lib/kite";
import { getSession } from "@/lib/session";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Kite API keys are missing. Add them to .env.local.",
  login_failed: "Zerodha login was cancelled or failed.",
  token_exchange: "Could not complete login. Check API secret and redirect URL.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  let configured = false;
  let connected = false;
  let userId: string | null = null;

  try {
    configured = isKiteConfigured();
    if (configured) {
      const session = await getSession();
      connected = Boolean(session.accessToken && session.userId);
      userId = session.userId ?? null;
    }
  } catch {
    configured = false;
  }

  const bannerError = params.error
    ? ERROR_MESSAGES[params.error] ?? "Login error"
    : null;

  return (
    <Dashboard
      initialConfigured={configured}
      initialConnected={connected}
      initialUserId={userId}
      bannerError={bannerError}
    />
  );
}
