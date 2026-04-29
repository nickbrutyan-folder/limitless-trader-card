import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the generate route's pure helper functions and request validation.
 * We extract and test `isValidAddress` and `interpolateMotivation` by importing
 * the route module, but since they're not exported we replicate the logic here
 * to test the contract. For the full route handler, we mock the API layer.
 */

// ─── isValidAddress (replicated — matches route.ts logic) ────────────────────

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

describe("isValidAddress", () => {
  it("accepts valid lowercase address", () => {
    expect(isValidAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
  });

  it("accepts valid checksummed address", () => {
    expect(isValidAddress("0xABCDEF1234567890abcdef1234567890ABCDEF12")).toBe(true);
  });

  it("rejects address without 0x prefix", () => {
    expect(isValidAddress("1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });

  it("rejects too-short address", () => {
    expect(isValidAddress("0x1234")).toBe(false);
  });

  it("rejects too-long address", () => {
    expect(isValidAddress("0x1234567890abcdef1234567890abcdef1234567890")).toBe(false);
  });

  it("rejects address with invalid characters", () => {
    expect(isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAddress("")).toBe(false);
  });

  it("rejects ENS names", () => {
    expect(isValidAddress("vitalik.eth")).toBe(false);
  });
});

// ─── interpolateMotivation (replicated — matches route.ts logic) ─────────────

function interpolateMotivation(
  template: string,
  stats: { winRate: number; pnl: number; volume: number; bestDay: number },
  totalVolume: number,
  tradeCount: number,
): string {
  return template
    .replace("{win_rate}", stats.winRate === -1 ? "strong" : String(Math.round(stats.winRate)))
    .replace("{pnl}", `$${Math.abs(stats.pnl).toLocaleString()}`)
    .replace("{trades}", Math.round(tradeCount).toLocaleString())
    .replace("{best_trade}", `$${stats.bestDay.toLocaleString()}`)
    .replace("{total_volume}", `$${Math.round(totalVolume).toLocaleString()}`);
}

describe("interpolateMotivation", () => {
  const stats = { winRate: 68, pnl: 5000, volume: 50000, bestDay: 1200 };

  it("replaces {win_rate} with numeric value", () => {
    const result = interpolateMotivation("Rate: {win_rate}%", stats, 50000, 200);
    expect(result).toBe("Rate: 68%");
  });

  it("replaces {win_rate} with 'strong' when -1", () => {
    const result = interpolateMotivation(
      "Your {win_rate} performance",
      { ...stats, winRate: -1 },
      50000,
      200,
    );
    expect(result).toBe("Your strong performance");
  });

  it("replaces {pnl} with absolute value", () => {
    const result = interpolateMotivation("Down {pnl}", { ...stats, pnl: -3000 }, 50000, 200);
    expect(result).toContain("$3,000");
  });

  it("replaces {best_trade}", () => {
    const result = interpolateMotivation("Best: +{best_trade}", stats, 50000, 200);
    expect(result).toContain("$1,200");
  });

  it("replaces {total_volume}", () => {
    const result = interpolateMotivation("Volume: {total_volume}", stats, 100000, 200);
    expect(result).toContain("$100,000");
  });

  it("replaces {trades} with formatted trade count, not dollars", () => {
    const result = interpolateMotivation("{trades} trades", stats, 75000, 250);
    expect(result).toBe("250 trades");
    expect(result).not.toContain("$");
  });

  it("handles template with no placeholders", () => {
    const result = interpolateMotivation("No placeholders here.", stats, 50000, 200);
    expect(result).toBe("No placeholders here.");
  });

  it("handles template with all placeholders at once", () => {
    const template = "{win_rate} {pnl} {trades} {best_trade} {total_volume}";
    const result = interpolateMotivation(template, stats, 50000, 200);
    expect(result).not.toContain("{");
  });
});

// ─── GET route handler ───────────────────────────────────────────────────────

// Mock the API layer so we can test the route handler without network calls
vi.mock("@/lib/limitless-api", () => ({
  fetchPortfolioData: vi.fn(),
  fetchMarketDetails: vi.fn(),
  rawToUsdc: (raw: string | number, decimals = 6) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n / Math.pow(10, decimals) : 0;
  },
  safeNum: (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  },
}));

import { GET } from "../../../app/api/generate/route";
import { NextRequest } from "next/server";
import * as api from "@/lib/limitless-api";

function makeRequest(wallet?: string): NextRequest {
  const url = wallet
    ? `http://localhost/api/generate?wallet=${wallet}`
    : "http://localhost/api/generate";
  return new NextRequest(url);
}

describe("GET /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when wallet param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("wallet");
  });

  it("returns 400 for invalid wallet format", async () => {
    const res = await GET(makeRequest("not-an-address"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("invalid");
  });

  it("returns 400 for short wallet address", async () => {
    const res = await GET(makeRequest("0x1234"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with card data for valid wallet", async () => {
    const mockPortfolio = {
      tradedVolume: { data: "10000" },
      positions: {
        points: "0",
        accumulativePoints: "500",
        rewards: {
          todaysRewards: "0",
          totalUnpaidRewards: "0",
          rewardsChartData: [],
          rewardsByEpoch: [],
        },
        amm: [],
        clob: [],
        group: [],
      },
      pnlChart: {
        timeframe: "all",
        data: [
          { timestamp: 1, value: 0 },
          { timestamp: 2, value: 50 },
          { timestamp: 3, value: 30 },
          { timestamp: 4, value: 80 },
        ],
      },
    };

    vi.mocked(api.fetchPortfolioData).mockResolvedValue(mockPortfolio);
    vi.mocked(api.fetchMarketDetails).mockResolvedValue(new Map());

    const wallet = "0x1234567890abcdef1234567890abcdef12345678";
    const res = await GET(makeRequest(wallet));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cardData).toBeDefined();
    expect(body.cardData.card).toBeDefined();
    expect(body.cardData.card.id).toBeTruthy();
    expect(body.cardData.stats).toBeDefined();
    expect(body.cardData.walletAddress).toBe(wallet);
    expect(body.motivation).toBeTruthy();
    expect(body.topScore).toBeGreaterThanOrEqual(0);
    expect(body.scores).toBeInstanceOf(Array);
    expect(body.scores.length).toBeLessThanOrEqual(5);
  });

  it("returns 404 when upstream API returns 404", async () => {
    vi.mocked(api.fetchPortfolioData).mockRejectedValue(
      new Error("Limitless API 404: /portfolio/0x.../traded-volume — Not Found"),
    );

    const res = await GET(makeRequest("0x1234567890abcdef1234567890abcdef12345678"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("returns 500 for generic upstream errors", async () => {
    vi.mocked(api.fetchPortfolioData).mockRejectedValue(
      new Error("network timeout"),
    );

    const res = await GET(makeRequest("0x1234567890abcdef1234567890abcdef12345678"));
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control header on success", async () => {
    const mockPortfolio = {
      tradedVolume: { data: "5000" },
      positions: {
        points: "0", accumulativePoints: "100",
        rewards: { todaysRewards: "0", totalUnpaidRewards: "0", rewardsChartData: [], rewardsByEpoch: [] },
        amm: [], clob: [], group: [],
      },
      pnlChart: { timeframe: "all", data: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 10 }] },
    };

    vi.mocked(api.fetchPortfolioData).mockResolvedValue(mockPortfolio);
    vi.mocked(api.fetchMarketDetails).mockResolvedValue(new Map());

    const res = await GET(makeRequest("0x1234567890abcdef1234567890abcdef12345678"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
