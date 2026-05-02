# Limitless Trader Cards

Wallet → archetype card. A user pastes their wallet address, the app reads their on-chain trading activity on [Limitless Exchange](https://limitless.exchange), classifies them into one of **48 archetypes**, and renders a shareable image card with their real stats.

![card example](public/limitless-icon.png)

## How it works

```
wallet ─▶ Limitless public API ─▶ derive ~30 metrics ─▶ 48 scorers ─▶ pick highest ─▶ render card
```

1. User submits a wallet on `/`.
2. `/api/generate` fetches `traded-volume`, `pnl-chart`, and `positions` from the Limitless public API in parallel.
3. `lib/derive.ts` produces ~30 derived metrics (volume, win rate, P&L, best day, position concentration, category mix, etc.) — with sanity gates that fall back to position-summed math when the upstream `pnl-chart` returns garbage values.
4. `lib/score.ts` runs 48 scorer functions against those metrics and selects the highest scorer.
5. The result page shows the card visually, plus action buttons that fetch a server-rendered PNG from `/api/card-image` for sharing or copying.

## 48 archetypes

Grouped into 7 clusters in [`src/lib/cards.ts`](src/lib/cards.ts):

| Cluster | Cards | Examples |
|---|---|---|
| Volume & Size | 8 | The Whale, The Shrimp, The Sniper |
| Win Rate & P&L | 9 | The Oracle, The Comeback Kid, The Rekt |
| Frequency & Timing | 5 | The Scout, The Grinder, The Closer |
| Market Category | 10 | The Crypto Maximalist, The Sports Bettor |
| Position & Hold | 5 | The Diamond Hands, The Hedger |
| Probability Preference | 6 | The Moonshot, The Degen, The Quant |
| Ecosystem Engagement | 5 | The OG, The Point Farmer |

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**, **TypeScript 5**
- **Tailwind CSS v4**
- **Framer Motion** — page transitions and card flip animation
- **Inter** + **MD Nichrome** typography
- **next/og** (Satori) — server-side card image generation, no html2canvas, no browser rendering quirks
- **Vitest** — 358 tests covering scorers, derivation, archetype coverage, and the API route

No env vars, no API keys. The Limitless public API is open.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build
npm start        # serve the production build
npm test         # run the full test suite (~250ms)
npm run lint     # ESLint
```

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # main UI: 5-stage state machine (landing → loading → revealing → result/error)
│   ├── layout.tsx                # fonts, metadata, OG
│   └── api/
│       ├── generate/route.ts     # orchestration: fetch → derive → classify → respond (JSON)
│       ├── card-image/route.tsx  # server-rendered card PNG (1920×1080) via next/og
│       └── debug/route.ts        # raw upstream API viewer (dev-only; gated in production)
├── components/
│   ├── TraderCard.tsx            # the card component (lime/black, responsive cqw sizing)
│   ├── CardBack.tsx              # back face shown before reveal
│   ├── CardScene.tsx             # 3D flip + tilt + holographic effects
│   ├── WalletInput.tsx           # wallet input + validation
│   └── ParticleField.tsx         # ambient background particles
└── lib/
    ├── limitless-api.ts          # typed API client + safe number helpers
    ├── derive.ts                 # raw API → 30+ metrics (with sanity gates)
    ├── score.ts                  # 48 scorers + classifyTrader()
    ├── cards.ts                  # 48 archetype configs
    ├── types.ts                  # shared interfaces
    └── __tests__/                # vitest suite
```

## API

### `GET /api/generate?wallet=0x...`

Returns the classified card data, motivation text, derived stats, and the top 5 archetype scores.

```json
{
  "cardData": { "card": {...}, "stats": {...}, "walletAddress": "0x..." },
  "motivation": "One of the first on Limitless...",
  "derived": { "totalVolumeUsdc": 1304873, "winRate": 0.75, ... },
  "topScore": 142,
  "scores": [{ "id": "og", "title": "The OG", "score": 142 }, ...]
}
```

### `GET /api/card-image?wallet=0x...`

Returns a 1920×1080 PNG of the card, ready to share or embed. Server-rendered via `next/og` — pixel-perfect, deterministic, browser-independent.

### `GET /api/debug?wallet=0x...`

Raw upstream API responses for development. **Disabled in production** by default. To enable on production, set `ENABLE_DEBUG_ROUTE=1` in the environment.

## Caching

- Limitless API responses are cached for 5 minutes via Next.js `revalidate`.
- `/api/generate` returns `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- `/api/card-image` returns `Cache-Control: public, max-age=300, s-maxage=300`. Same-wallet hits are served from edge cache.

## Data correctness notes

The upstream `pnl-chart` endpoint at `api.limitless.exchange` has been observed to return **physically-impossible** P&L values for wallets with sparse chart history (e.g. `-$14M` on a wallet that has only ever traded `$2.2M` total). [`derive.ts`](src/lib/derive.ts) handles this defensively:

1. **Chart trust gate** — only trust `pnl-chart` when it has ≥3 datapoints AND every value satisfies `|value| ≤ totalVolume`. Otherwise fall back to position-summed P&L from `/positions`.
2. **Win rate** — combines closed CLOB and AMM positions (the upstream API's chart-based win rate breaks for AMM-heavy traders).
3. **Best day** — falls back to single-trade max when daily-PnL data is sparse.
4. **NaN safety** — `safeNum()` helper wraps every numeric coercion so a malformed upstream value can't poison scoring downstream.

## Deployment

The app is a stock Next.js app. Three working patterns:

### Vercel

```bash
npx vercel
```

Auto-detected. No build configuration needed.

### Subdomain on a VPS

1. DNS: `A` record `card.yourdomain.com → <vps-ip>`
2. `pm2 start npm --name limitless-trader-card -- start` (defaults to port 3000; set `PORT=3010` to override)
3. nginx site:
   ```nginx
   server {
     listen 80;
     server_name card.yourdomain.com;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
4. `certbot --nginx -d card.yourdomain.com` for SSL.

### Path under an existing Next.js app (e.g. `yourdomain.com/card`)

Add to the parent app's `next.config.ts`:

```ts
async rewrites() {
  return [
    { source: '/card',         destination: 'http://<vps-ip>/card' },
    { source: '/card/:path*',  destination: 'http://<vps-ip>/card/:path*' },
  ];
}
```

Then set `basePath: '/card'` and `assetPrefix: '/card'` in this project's `next.config.ts`.

## Tests

358 tests across 5 files. Covers all 48 scorers, derivation logic (including AMM win-rate, sparse-chart fallback, NaN propagation), and the `/api/generate` route. Run with `npm test`.
