/**
 * Limitless Exchange API client — typed wrappers around the public portfolio endpoints.
 *
 * Actual response shapes (verified against live API):
 *
 * GET /portfolio/{account}/traded-volume → {"data":"1023868"}
 * GET /portfolio/{account}/pnl-chart?timeframe=all → {"timeframe":"all","data":[{timestamp,value},...]}
 * GET /portfolio/{account}/positions → {rewards,points,accumulativePoints,amm[],clob[],group[]}
 * GET /markets/{slug} → {id,slug,title,categories,tags,...}
 */

const BASE = "https://api.limitless.exchange";

// ─── Response types ───────────────────────────────────────────────────────────

export interface TradedVolumeResponse {
  data: string; // raw USDC string, e.g. "1023868"
}

export interface PnlDataPoint {
  timestamp: number;
  value: number; // cumulative P&L in USDC (already decimal)
}

export interface PnlChartResponse {
  timeframe: string;
  data: PnlDataPoint[];
}

export interface ClobPositionSide {
  cost: string;           // raw USDC 6 decimals
  fillPrice: string;      // raw price 6 decimals (e.g. "460000" = 0.46)
  marketValue: string;    // raw USDC 6 decimals
  realisedPnl: string;
  unrealizedPnl: string;
}

export interface MarketInfo {
  id: number;
  slug: string;
  title?: string;
  status?: string;        // "FUNDED", "RESOLVED", etc.
  closed?: boolean;
  expirationDate?: string;
  deadline?: string;
  winningOutcomeIndex?: number;
  collateralToken?: { decimals: number; symbol: string };
  // From full market endpoint:
  categories?: string[];
  tags?: string[];
  createdAt?: string;
  volume?: string;
  prices?: { yes: number; no: number };
}

export interface ClobPosition {
  market: MarketInfo;
  latestTrade?: {
    outcomeTokenPrice?: number;
    latestNoPrice?: number;
    latestYesPrice?: number;
  };
  positions: {
    yes?: ClobPositionSide;
    no?: ClobPositionSide;
  };
  tokensBalance?: { yes?: string; no?: string };
  orders?: { liveOrders?: unknown[]; totalCollateralLocked?: string };
  rewards?: Record<string, unknown>;
  makerAddress?: string;
}

export interface AmmPosition {
  collateralAmount: string;
  outcomeIndex: number;
  outcomeTokenAmount: string;
  // Already in decimal USDC, e.g. "1010.487684" or "-61.970459". "0" means the
  // position is still open / not yet resolved.
  realizedPnl?: string;
  unrealizedPnl?: string;
  latestTrade?: { createdAt?: string };
  market: MarketInfo;
  account: string;
}

export interface PositionsResponse {
  points: string;               // "0.00000000"
  accumulativePoints: string;   // "44302.32700000"
  rewards: {
    todaysRewards: string;
    totalUnpaidRewards: string;
    totalUserRewardsLastEpoch?: string;
    rewardsChartData: unknown[];
    rewardsByEpoch: unknown[];
  };
  amm: AmmPosition[];
  clob: ClobPosition[];
  group: unknown[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: 300 }, // cache for 5 min — handles 1000+ concurrent users
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Limitless API ${res.status}: ${url} — ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export function getTradedVolume(account: string) {
  return fetchJson<TradedVolumeResponse>(
    `${BASE}/portfolio/${account}/traded-volume`
  );
}

export function getPositions(account: string) {
  return fetchJson<PositionsResponse>(
    `${BASE}/portfolio/${account}/positions`
  );
}

export function getPnlChart(account: string) {
  return fetchJson<PnlChartResponse>(
    `${BASE}/portfolio/${account}/pnl-chart?timeframe=all`
  );
}

export function getMarket(slugOrAddress: string) {
  return fetchJson<MarketInfo>(`${BASE}/markets/${slugOrAddress}`);
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface RawPortfolioData {
  tradedVolume: TradedVolumeResponse;
  positions: PositionsResponse;
  pnlChart: PnlChartResponse;
}

export async function fetchPortfolioData(
  account: string
): Promise<RawPortfolioData> {
  const [tradedVolume, positions, pnlChart] = await Promise.all([
    getTradedVolume(account),
    getPositions(account),
    getPnlChart(account),
  ]);
  return { tradedVolume, positions, pnlChart };
}

/**
 * Fetch full market details for each unique slug in positions.
 * The positions already embed partial market info; this enriches with categories/tags.
 */
export async function fetchMarketDetails(
  positions: PositionsResponse
): Promise<Map<string, MarketInfo>> {
  const slugs = new Set<string>();
  for (const pos of positions.clob) {
    if (pos.market?.slug) slugs.add(pos.market.slug);
  }
  for (const pos of positions.amm) {
    if (pos.market?.slug) slugs.add(pos.market.slug);
  }

  const marketMap = new Map<string, MarketInfo>();
  const slugArr = Array.from(slugs);

  for (let i = 0; i < slugArr.length; i += 10) {
    const batch = slugArr.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((s) => getMarket(s)));
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        marketMap.set(batch[idx], result.value);
      }
    });
  }

  return marketMap;
}

/** Convert raw USDC string (6 decimals) to a float */
export function rawToUsdc(raw: string | number, decimals = 6): number {
  return Number(raw) / Math.pow(10, decimals);
}
