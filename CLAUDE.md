# Notes for AI coding assistants

This is a **Next.js 16** project (App Router, Turbopack). Several APIs and conventions differ from older Next.js — read the relevant guide in `node_modules/next/dist/docs/` before writing or refactoring routing, server components, or build config.

## Project shape

- `src/lib/derive.ts` and `src/lib/score.ts` are the business core. Changes here can shift archetype classification for every wallet — prefer additive changes and run `npm test` (358 tests).
- `src/lib/limitless-api.ts` exports `safeNum()` and `rawToUsdc()`. Use them for any numeric coercion from upstream API responses; raw `Number(x)` can NaN-poison scoring.
- The card visual is server-rendered as a PNG by `src/app/api/card-image/route.tsx` (Satori via `next/og`). The on-screen `TraderCard.tsx` and the rendered PNG must stay visually consistent — when changing the design, update both.
- Card layout uses container query units (`cqw`) for the on-screen card. Fixed pixel sizes for the server-rendered PNG. Don't introduce `position: absolute` with hardcoded px in `TraderCard.tsx` — it'll break responsive scaling.

## Don't

- Don't add `html2canvas` or DOM-screenshot libraries. The server-side `next/og` route is the screenshot path.
- Don't trust the upstream `/pnl-chart` endpoint without sanity-gating. It returns garbage for AMM-heavy wallets — see `derive.ts` comments.
- Don't add env vars unless absolutely needed. Today the app has zero. The Limitless public API requires no auth.
