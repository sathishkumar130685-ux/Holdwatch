# HoldWatch

**GitHub:** [sathishkumar130685-ux/Holdwatch](https://github.com/sathishkumar130685-ux/Holdwatch) — use this repo when importing the project on Vercel.

Web app that connects to **Zerodha Kite Connect**, shows your **equity holdings**, and **suggests when a stock drops** below a percentage you set versus your **average buy price**.

This uses the official **Kite Connect API** (browser OAuth), not the Zerodha Kite MCP server — so it works without Cursor Desktop.

## Features

- Connect Zerodha via Kite login (2FA in browser)
- Holdings table: quantity, average price, LTP, % vs average, P&L
- Per-stock **drop alerts** (e.g. notify when INFY is ≥5% below your average)
- Auto-refresh every 45 seconds while the tab is open + toast notifications

## Setup

1. **Kite Connect app**  
   Register at [developers.kite.trade](https://developers.kite.trade/). Note your **API key** and **API secret**.

2. **Redirect URL**  
   In the app settings, add exactly:
   ```
   http://localhost:4321/api/auth/callback
   ```
   For production, use your deployed URL, e.g. `https://your-domain.com/api/auth/callback`.

3. **Environment**  
   Copy `.env.example` to `.env.local` and fill in values:
   ```bash
   cp .env.example .env.local
   ```

4. **Run**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:4321](http://localhost:4321) → **Connect Zerodha**.

## Put this code on your GitHub repo (one time)

The Kite holdings app **is** HoldWatch. Your GitHub repo may be empty until you push this project once (from a PC or Mac with Git):

```bash
git clone <where-you-have-this-code>
cd Holdwatch   # or kite-holdings
git remote add github https://github.com/sathishkumar130685-ux/Holdwatch.git
git push -u github main
```

Use a [GitHub personal access token](https://github.com/settings/tokens) as the password if Git asks. After `main` appears on GitHub, Vercel can import **Holdwatch** (see below).

## Deploying (free on Vercel)

Your repo already includes `vercel.json` for Next.js. You only need a Vercel project linked to this Git repo and three secrets.

### On your phone (Vercel website)

1. Open **[vercel.com](https://vercel.com)** in the browser and sign in (GitHub login works well).
2. Tap **Add New… → Project**.
3. **Import** the **[Holdwatch](https://github.com/sathishkumar130685-ux/Holdwatch)** repository (connect GitHub first if Vercel does not see it).
4. Leave framework **Next.js** and defaults as-is → **Deploy** (first build may fail until step 5 — that is OK).
5. Open the project → **Settings → Environment Variables**. Add for **Production** (and Preview if you want):

   | Variable | Value |
   |----------|--------|
   | `KITE_API_KEY` | From [developers.kite.trade](https://developers.kite.trade/) |
   | `KITE_API_SECRET` | Same Kite app |
   | `SESSION_SECRET` | Any random string, **32+ characters** |

   `APP_URL` is **optional on Vercel** — the app uses your `*.vercel.app` URL automatically. Set it only if you use a custom domain.

6. **Deployments → … on latest → Redeploy** so the new variables apply.
7. Copy your live URL (e.g. `https://kite-holdings-xyz.vercel.app`). On **developers.kite.trade**, edit your app → **Redirect URL**:
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/auth/callback
   ```
   Must match exactly (https, no trailing slash before `/api`).
8. Open the Vercel URL on your phone → **Connect Zerodha** and complete login.

**Check:** visit `https://YOUR-URL.vercel.app/api/setup-check` — `ready` should be `true`.

### Option — Cursor **Publish** (desktop)

Use the **Publish** control in Cursor chat to connect Vercel and deploy from the repo, then add the same three environment variables and redeploy.

### Custom domain

After adding a domain in Vercel, set `APP_URL` to `https://your-domain.com` and add that domain’s callback URL in Kite Connect.

Set the same core variables on any host (`KITE_API_KEY`, `KITE_API_SECRET`, `SESSION_SECRET`). Use `APP_URL` when the host does not set `VERCEL_URL`.

## Limitations & next steps

- Alerts are **in-app toasts** while the dashboard is open. For push/SMS/email, add a cron job or background worker that calls `/api/watch` and sends via your provider.
- Kite Connect has [usage and pricing rules](https://kite.trade/docs/connect/v3/) — review them for your account.
- **Read-only** in this repo: no orders or GTT placement.

## Tech

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, iron-session, Kite Connect REST API.
