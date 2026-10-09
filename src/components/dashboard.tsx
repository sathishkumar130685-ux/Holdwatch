"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { evaluateAlerts } from "@/lib/alert-engine";
import {
  appendPriceSamples,
  readLocalAlertRules,
  readPriceLog,
  writeLocalAlertRules,
  type PriceSample,
} from "@/lib/price-history";
import type { AlertBasis, AlertRule, TriggeredAlert } from "@/lib/types";

type EnrichedHolding = {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  close_price?: number | null;
  pnl: number;
  day_change_percentage: number;
  drop_from_avg_percent: number;
  drop_from_prev_close_percent?: number | null;
};

const POLL_MS = 45_000;

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function Dashboard({
  initialConfigured,
  initialConnected,
  initialUserId,
  bannerError,
}: {
  initialConfigured: boolean;
  initialConnected: boolean;
  initialUserId: string | null;
  bannerError?: string | null;
}) {
  const [configured] = useState(initialConfigured);
  const [connected, setConnected] = useState(initialConnected);
  const [userId, setUserId] = useState(initialUserId);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(bannerError ?? null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [dropPercent, setDropPercent] = useState("5");
  const [alertBasis, setAlertBasis] = useState<AlertBasis>("prev_close");
  const [priceLog, setPriceLog] = useState<Record<string, PriceSample[]>>({});
  const [historySymbol, setHistorySymbol] = useState("");

  const notifiedRef = useRef<Set<string>>(new Set());
  const [siteOrigin, setSiteOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteOrigin(window.location.origin);
      setPriceLog(readPriceLog());
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "1") return;

    void fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: { connected?: boolean; userId?: string | null }) => {
        if (data.connected) {
          setConnected(true);
          setUserId(data.userId ?? null);
        } else {
          setError(
            "Login completed but the session cookie was not saved. Try Connect again in a private window.",
          );
        }
      })
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.pathname + url.search);
      });
  }, []);

  const visibleTriggered = useMemo(() => {
    const map = new Map<string, TriggeredAlert>();
    for (const alert of triggered) {
      const key =
        alert.basis === "prev_close"
          ? `${alert.exchange}:${alert.tradingsymbol}`
          : alert.ruleId;
      const previous = map.get(key);
      if (!previous || alert.level > previous.level) map.set(key, alert);
    }
    return [...map.values()];
  }, [triggered]);

  const historySamples = useMemo(() => {
    return [...(priceLog[historySymbol] ?? [])].slice(-12).reverse();
  }, [historySymbol, priceLog]);

  const holdingOptions = useMemo(
    () =>
      holdings.map((h) => ({
        value: `${h.exchange}:${h.tradingsymbol}`,
        label: `${h.tradingsymbol} (${h.exchange})`,
      })),
    [holdings],
  );

  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const loadRules = useCallback(async () => {
    const localRules = readLocalAlertRules();
    const res = await fetch("/api/alerts");
    if (!res.ok) {
      if (localRules.length > 0) {
        rulesRef.current = localRules;
        setRules(localRules);
      }
      return;
    }
    const data = await res.json();
    const serverRules = (data.rules ?? []) as AlertRule[];
    if (serverRules.length > 0) {
      rulesRef.current = serverRules;
      setRules(serverRules);
      writeLocalAlertRules(serverRules);
      return;
    }
    if (localRules.length === 0) {
      rulesRef.current = [];
      setRules([]);
      return;
    }
    rulesRef.current = localRules;
    setRules(localRules);
    for (const rule of localRules) {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: rule.exchange,
          tradingsymbol: rule.tradingsymbol,
          basis: rule.basis ?? "average",
          dropPercentFromAvg:
            rule.basis === "prev_close" ? undefined : rule.dropPercentFromAvg,
        }),
      });
    }
  }, []);

  const refreshWatch = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watch");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not refresh prices");
        return;
      }
      const nextHoldings = (data.holdings ?? []) as EnrichedHolding[];
      setHoldings(nextHoldings);
      const triggeredNow = evaluateAlerts(nextHoldings, {}, rulesRef.current);
      setTriggered(triggeredNow);
      setCheckedAt(data.checkedAt ?? null);
      setPriceLog(appendPriceSamples(nextHoldings));
      setHistorySymbol((current) => {
        if (current) return current;
        const first = nextHoldings[0];
        return first ? `${first.exchange}:${first.tradingsymbol}` : "";
      });

      const freshDay = new Map<string, TriggeredAlert[]>();
      for (const alert of triggeredNow) {
        if (alert.basis === "prev_close") {
          const day = alert.triggeredAt.slice(0, 10);
          const key = `${alert.exchange}:${alert.tradingsymbol}:${alert.level}:${day}`;
          if (notifiedRef.current.has(key)) continue;
          notifiedRef.current.add(key);
          const group = `${alert.exchange}:${alert.tradingsymbol}`;
          freshDay.set(group, [...(freshDay.get(group) ?? []), alert]);
          continue;
        }

        const key = `${alert.ruleId}:${alert.triggeredAt.slice(0, 16)}`;
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          toast.warning(alert.message, {
            description: `LTP ${formatInr(alert.lastPrice)} vs avg ${formatInr(alert.averagePrice)}`,
            duration: 12_000,
          });
        }
      }

      for (const alerts of freshDay.values()) {
        const top = alerts[alerts.length - 1];
        const levels = alerts.map((alert) => alert.level).join("%, ");
        toast.warning(
          `${top.tradingsymbol} crossed −${levels}% from yesterday's close`,
          {
            description: `Price ${formatInr(top.lastPrice)} vs close ${formatInr(top.averagePrice)}`,
            duration: 12_000,
          },
        );
      }
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    void loadRules().then(() => refreshWatch());
    const id = window.setInterval(() => void refreshWatch(), POLL_MS);
    return () => window.clearInterval(id);
  }, [connected, loadRules, refreshWatch]);

  async function addRule() {
    const [exchange, tradingsymbol] = selectedSymbol.split(":");
    const pct = Number(dropPercent);
    if (!exchange || !tradingsymbol) return;
    if (alertBasis === "average" && !Number.isFinite(pct)) return;

    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchange,
        tradingsymbol,
        basis: alertBasis,
        dropPercentFromAvg: alertBasis === "average" ? pct : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not save alert");
      return;
    }
    const nextRules = (data.rules ?? []) as AlertRule[];
    rulesRef.current = nextRules;
    setRules(nextRules);
    writeLocalAlertRules(nextRules);
    setDialogOpen(false);
    toast.success(
      alertBasis === "prev_close"
        ? `Day-drop alerts set for ${tradingsymbol} at −1% through −5%`
        : `Alert set for ${tradingsymbol} at −${pct}% from average`,
    );
    void refreshWatch();
  }

  async function removeRule(id: string) {
    const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok) {
      const nextRules = (data.rules ?? []) as AlertRule[];
      rulesRef.current = nextRules;
      setRules(nextRules);
      writeLocalAlertRules(nextRules);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            HoldWatch
          </h1>
          <p className="text-sm text-zinc-600">
            Zerodha holdings with drop alerts from your average buy price.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <a
              href="/api/auth/login"
              className={cn(
                buttonVariants(),
                !configured && "pointer-events-none opacity-50",
              )}
            >
              Connect Zerodha
            </a>
          ) : (
            <>
              <Badge variant="secondary">User {userId}</Badge>
              <Button
                variant="outline"
                onClick={() => void refreshWatch()}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh now"}
              </Button>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="ghost">Log out</Button>
              </form>
            </>
          )}
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!configured && (
        <Alert>
          <AlertTitle>Kite Connect not configured</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Create a Kite Connect app at{" "}
              <a
                href="https://developers.kite.trade/"
                className="font-medium underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                developers.kite.trade
              </a>
              , then add these environment variables:
            </p>
            <ul className="list-inside list-disc text-sm">
              <li>
                <code className="text-xs">KITE_API_KEY</code> and{" "}
                <code className="text-xs">KITE_API_SECRET</code>
              </li>
              <li>
                <code className="text-xs">SESSION_SECRET</code> (32+ random
                characters)
              </li>
              <li>
                <code className="text-xs">APP_URL</code> = your site URL with no
                trailing slash (optional on Vercel — it uses your deployment URL
                automatically)
              </li>
            </ul>
            <p>
              On <strong>Vercel</strong>: Project → Settings → Environment
              Variables → add for Production → <strong>Redeploy</strong>. Locally
              use <code className="text-xs">.env.local</code> instead.
            </p>
            <p>
              In Kite Connect, set the <strong>only</strong> redirect URL to{" "}
              <code className="text-xs">
                {siteOrigin
                  ? `${siteOrigin}/api/auth/callback`
                  : "https://your-app.vercel.app/api/auth/callback"}
              </code>
              . Kite allows one URL per app — if it still says{" "}
              <code className="text-xs">localhost:4321</code>, Zerodha will keep
              sending you to localhost after login.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {connected && visibleTriggered.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900">
              Active suggestions
            </CardTitle>
            <CardDescription className="text-amber-800">
              Stocks that crossed your drop threshold vs your average price.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleTriggered.map((t) => (
              <p key={t.ruleId + t.triggeredAt} className="text-sm text-amber-950">
                {t.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>
              {checkedAt
                ? `Last checked ${new Date(checkedAt).toLocaleString("en-IN")} · auto every ${POLL_MS / 1000}s`
                : "Connect to load holdings"}
            </CardDescription>
          </div>
          {connected && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button />}>
                Add drop alert
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alert when price drops</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>Stock</Label>
                    <Select
                      value={selectedSymbol}
                      onValueChange={(v) => setSelectedSymbol(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose holding" />
                      </SelectTrigger>
                      <SelectContent>
                        {holdingOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Alert when</Label>
                    <Select
                      value={alertBasis}
                      onValueChange={(value) =>
                        setAlertBasis(value === "average" ? "average" : "prev_close")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prev_close">
                          Yesterday&apos;s close falls 1%, 2%, 3%, 4%, and 5%
                        </SelectItem>
                        <SelectItem value="average">
                          Price falls from my average buy
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {alertBasis === "average" && (
                  <div className="grid gap-2">
                    <Label htmlFor="drop">Drop from average (%)</Label>
                    <Input
                      id="drop"
                      type="number"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={dropPercent}
                      onChange={(e) => setDropPercent(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500">
                      Example: 5 means notify when LTP is 5% or more below your
                      average buy price.
                    </p>
                  </div>
                  )}
                  {alertBasis === "prev_close" && (
                    <p className="text-xs text-zinc-500">
                      You get a separate alert each time the stock crosses 1%,
                      2%, 3%, 4%, and 5% below yesterday&apos;s close. This uses
                      the close price on your holdings, so it works on the free
                      Kite app.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => void addRule()} disabled={!selectedSymbol}>
                    Save alert
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!connected ? (
            <p className="text-sm text-zinc-600">
              Connect your Zerodha account to see quantity, average price, LTP,
              and P&amp;L.
            </p>
          ) : holdings.length === 0 ? (
            <p className="text-sm text-zinc-600">No equity holdings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">LTP</TableHead>
                    <TableHead className="text-right">vs Avg</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={`${h.exchange}-${h.tradingsymbol}`}>
                      <TableCell className="font-medium">
                        {h.tradingsymbol}
                        <span className="ml-1 text-xs text-zinc-500">
                          {h.exchange}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{h.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatInr(h.average_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatInr(h.last_price)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          h.drop_from_avg_percent > 0
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {h.drop_from_avg_percent > 0 ? "−" : "+"}
                        {Math.abs(h.drop_from_avg_percent).toFixed(2)}%
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          (h.drop_from_prev_close_percent ?? 0) > 0
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {h.drop_from_prev_close_percent == null
                          ? "—"
                          : `${h.drop_from_prev_close_percent > 0 ? "−" : "+"}${Math.abs(h.drop_from_prev_close_percent).toFixed(2)}%`}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          h.pnl >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatInr(h.pnl)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Price log on this phone</CardTitle>
            <CardDescription>
              Each refresh is saved in this browser. This is not Zerodha&apos;s
              multi-day candle history — that needs the paid Connect API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {holdingOptions.length === 0 ? (
              <p className="text-sm text-zinc-600">
                Prices will appear here after the first refresh.
              </p>
            ) : (
              <>
                <Select
                  value={historySymbol}
                  onValueChange={(value) => setHistorySymbol(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose holding" />
                  </SelectTrigger>
                  <SelectContent>
                    {holdingOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {historySamples.length === 0 ? (
                  <p className="text-sm text-zinc-600">
                    No saved prices for this stock yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">vs close</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historySamples.map((sample) => {
                          const drop =
                            sample.prevClose && sample.prevClose > 0
                              ? ((sample.prevClose - sample.price) /
                                  sample.prevClose) *
                                100
                              : null;
                          return (
                            <TableRow key={sample.at}>
                              <TableCell>
                                {new Date(sample.at).toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatInr(sample.price)}
                              </TableCell>
                              <TableCell
                                className={`text-right ${
                                  (drop ?? 0) > 0
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {drop == null
                                  ? "—"
                                  : `${drop > 0 ? "−" : "+"}${Math.abs(drop).toFixed(2)}%`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Your alerts</CardTitle>
            <CardDescription>
              In-app toasts while this tab is open. For SMS/email, add a
              notifier later (see README).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No alerts yet. Add one to get a suggestion when a holding falls
                below your threshold.
              </p>
            ) : (
              <ul className="space-y-2">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>{r.tradingsymbol}</strong> ({r.exchange}) —{" "}
                      {r.basis === "prev_close"
                        ? "alert at −1%, −2%, −3%, −4%, and −5% from yesterday's close"
                        : `alert at −${r.dropPercentFromAvg}% from average`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeRule(r.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
