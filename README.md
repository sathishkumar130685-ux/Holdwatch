# HoldWatch

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

## Deploying

Set the same variables on your host (`KITE_API_KEY`, `KITE_API_SECRET`, `SESSION_SECRET`, `APP_URL`). Update the Kite app redirect URL to match `APP_URL/api/auth/callback`.

## Limitations & next steps

- Alerts are **in-app toasts** while the dashboard is open. For push/SMS/email, add a cron job or background worker that calls `/api/watch` and sends via your provider.
- Kite Connect has [usage and pricing rules](https://kite.trade/docs/connect/v3/) — review them for your account.
- **Read-only** in this repo: no orders or GTT placement.

## Tech

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, iron-session, Kite Connect REST API.
