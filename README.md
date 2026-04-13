# Limitless Trader Cards

Social card generator that analyses on-chain trading activity on [Limitless Exchange](https://limitless.exchange), classifies traders into one of **48 archetypes**, and renders a shareable card with real stats.

## How It Works

1. User pastes their wallet address
2. App fetches portfolio data from the Limitless public API (volume, positions, P&L chart)
3. A scoring engine evaluates ~20 derived data points against 48 archetype scorers
4. The highest-scoring archetype is selected and rendered as a card with the trader's real stats

## 48 Archetypes

Archetypes are grouped into 7 clusters:

| Cluster | Cards | Examples |
|---------|-------|---------|
| Volume & Size | 8 | The Whale, The Shrimp, The Sniper |
| Win Rate & P&L | 9 | The Oracle, The Comeback Kid, The Rekt |
| Frequency & Timing | 5 | The Scout, The Grinder, The Closer |
| Market Category | 10 | The Crypto Maximalist, The Sports Bettor |
| Position & Hold | 5 | The Diamond Hands, The Hedger |
| Probability Preference | 6 | The Moonshot, The Degen, The Quant |
| Ecosystem Engagement | 5 | The OG, The Point Farmer |

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4**
- **Framer Motion** — page transitions and animations
- **html2canvas** — copy-to-clipboard / save-as-image
- **Limitless Exchange API** — public REST endpoints, no API key required

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main page (landing -> loading -> result)
│   └── api/
│       ├── generate/route.ts # Orchestration: fetch -> derive -> classify -> respond
│       └── debug/route.ts    # Raw API response viewer
├── components/
│   ├── TraderCard.tsx        # The card component
│   ├── WalletInput.tsx       # Wallet address input
│   ├── AnalysisLoader.tsx    # Loading screen with progress bar
│   └── DotCanvas.tsx         # Animated background
└── lib/
    ├── limitless-api.ts      # Typed API client for Limitless endpoints
    ├── derive.ts             # Derives ~20 data points from raw API responses
    ├── score.ts              # 48 scorer functions + classification engine
    ├── cards.ts              # Card configs (title, motivation template, cluster)
    └── types.ts              # Shared TypeScript interfaces
```

## Getting Started

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

No environment variables or API keys needed — the Limitless API is public.

## Deploy

One-click deploy to Vercel:

```bash
npx vercel
```

Or connect this repo to Vercel via the dashboard. No build configuration needed — Next.js is auto-detected.

## API Endpoints

### `GET /api/generate?wallet=0x...`

Returns the classified card data, motivation text, derived stats, and top 5 archetype scores.

### `GET /api/debug?wallet=0x...`

Returns raw responses from all 3 Limitless API endpoints for debugging.

## Caching

- Limitless API responses are cached for 5 minutes via Next.js `revalidate`
- Generate endpoint returns `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
- Same wallet won't re-hit the Limitless API within the cache window
