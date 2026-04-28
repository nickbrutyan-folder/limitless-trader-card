import type { CardConfig } from "./types";

export const CARD_CONFIGS: CardConfig[] = [
  // Cluster 1 — Volume & Size
  { id: "whale", title: "The Whale", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "You've moved {total_volume} through Limitless — that puts you in the top tier. When you enter a market, people notice. Size talks, and yours is loud." },
  { id: "shrimp", title: "The Shrimp", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "With {trades} trades and a modest stack, you're proof that you don't need size to stay in the game. Every shrimp in the sea adds up." },
  { id: "shark", title: "The Shark", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "A {win_rate}% win rate at meaningful size? You're not gambling — you're hunting. Methodical, profitable, and consistently dangerous." },
  { id: "swarm", title: "The Swarm", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "You've fired off {trades} micro-bets and built real volume through sheer frequency. One bee is nothing — but a swarm moves markets." },
  { id: "sniper", title: "The Sniper", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "You wait. You watch. Then you strike with 10x your usual size. Your best trade of +{best_trade} says it all — patience is your edge." },
  { id: "arrival", title: "The Arrival", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "New to Limitless but already moving serious size. {total_volume} traded and you're just getting started. The platform hasn't seen you coming." },
  { id: "size-queen", title: "The Size Queen", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "Every bet near max exposure, every time. You don't do half measures — it's full size or nothing. Bold and unapologetic." },
  { id: "dripper", title: "The Dripper", accentColour: "#c3ff00", cluster: "volume", motivationTemplate: "Sub-$5 positions spread across dozens of markets. You're everywhere at once, dripping capital like a slow IV — covering every angle." },

  // Cluster 2 — Win Rate & P&L Shape
  { id: "oracle", title: "The Oracle", accentColour: "#C6E040", cluster: "winrate", motivationTemplate: "Your {win_rate}% win rate puts you in rare company on Limitless. You don't chase — you wait for your spot, and you're right more often than not." },
  { id: "rekt", title: "The Rekt", accentColour: "#c3ff00", cluster: "winrate", motivationTemplate: "Down {pnl} with a {win_rate}% hit rate — but you're still here. Most would've quit. The fact that you haven't says more than any P&L chart." },
  { id: "comeback-kid", title: "The Comeback Kid", accentColour: "#10B981", cluster: "winrate", motivationTemplate: "You dropped 40%+ and clawed it all back. That V-shaped recovery isn't luck — it's grit. Down bad to new highs. Respect." },
  { id: "one-hit-wonder", title: "The One-Hit Wonder", accentColour: "#F59E0B", cluster: "winrate", motivationTemplate: "One trade. +{best_trade}. That single call accounts for nearly all your lifetime P&L. Lightning struck once — will it strike again?" },
  { id: "slow-rug", title: "The Slow Rug", accentColour: "#6B7280", cluster: "winrate", motivationTemplate: "No blow-ups, no drama — just a slow, steady bleed. Your P&L has been gently sliding for a while. Sometimes the quietest losses are the hardest to spot." },
  { id: "ascent", title: "The Ascent", accentColour: "#22D3EE", cluster: "winrate", motivationTemplate: "Something clicked. Your recent performance is dramatically outpacing everything before it. The P&L curve just went exponential — and people are noticing." },
  { id: "mid-curve", title: "The Mid Curve", accentColour: "#9CA3AF", cluster: "winrate", motivationTemplate: "{trades} trades and your P&L is almost exactly zero. You're the market's equilibrium — perfectly balanced, as all things should be." },
  { id: "hodler", title: "The HODLer", accentColour: "#FB923C", cluster: "winrate", motivationTemplate: "Multiple open positions deep in the red, and you're still holding. Diamond hands or denial? Either way, you're committed." },
  { id: "contrarian-king", title: "The Contrarian King", accentColour: "#8B5CF6", cluster: "winrate", motivationTemplate: "You bet against the crowd at sub-40% odds — and win more often than you should. A {win_rate}% hit rate on contrarian calls is genuinely impressive." },

  // Cluster 3 — Frequency & Timing
  { id: "scout", title: "The Scout", accentColour: "#4ADE80", cluster: "timing", motivationTemplate: "First in, every time. You're entering markets within hours of creation — before the crowd even knows they exist. The early bird catches the edge." },
  { id: "grinder", title: "The Grinder", accentColour: "#D97706", cluster: "timing", motivationTemplate: "{trades} trades and counting. High points, high activity, relentless consistency. You don't take breaks — Limitless is your arena." },
  { id: "tourist", title: "The Tourist", accentColour: "#94A3B8", cluster: "timing", motivationTemplate: "Fewer than 5 trades. A quick look around, then gone. Maybe you'll come back — or maybe Limitless was just a stop on the tour." },
  { id: "sprinter", title: "The Sprinter", accentColour: "#F43F5E", cluster: "timing", motivationTemplate: "You burned bright — high activity, fast trades, real volume. Then silence. A burst of energy that's since cooled off. Ready for round two?" },
  { id: "closer", title: "The Closer", accentColour: "#14B8A6", cluster: "timing", motivationTemplate: "You don't enter early. You wait until the final hours before resolution, armed with maximum information. Late entry, high conviction. The closer always knows." },

  // Cluster 4 — Market Category Preference
  { id: "sports-bettor", title: "The Sports Bettor", accentColour: "#22C55E", cluster: "category", motivationTemplate: "75%+ of your book is sports. You know the games, you know the odds, and Limitless is your sportsbook. Ball don't lie — and neither does your record." },
  { id: "crypto-maximalist", title: "The Crypto Maximalist", accentColour: "#F7931A", cluster: "category", motivationTemplate: "Crypto markets dominate your portfolio. Price action, launches, on-chain events — if it's crypto, you're in. A true maximalist through and through." },
  { id: "political-animal", title: "The Political Animal", accentColour: "#DC2626", cluster: "category", motivationTemplate: "Elections, policy moves, geopolitical events — your portfolio reads like a political briefing. You trade the headlines others just argue about." },
  { id: "pop-culture-prophet", title: "The Pop Culture Prophet", accentColour: "#E879F9", cluster: "category", motivationTemplate: "Celebrity drama, entertainment, viral moments — you're trading the culture. While others follow markets, you follow the zeitgeist." },
  { id: "macro-mind", title: "The Macro Mind", accentColour: "#3B82F6", cluster: "category", motivationTemplate: "Central banks, economic indicators, global events — your trades reflect a macro worldview. You see the big picture and trade accordingly." },
  { id: "generalist", title: "The Generalist", accentColour: "#A3E635", cluster: "category", motivationTemplate: "No category dominates your book. Sports, crypto, politics, culture — you trade it all. A true generalist with range across every vertical." },
  { id: "narrative-trader", title: "The Narrative Trader", accentColour: "#FB7185", cluster: "category", motivationTemplate: "You chase the story. Trending markets, viral moments, breaking news — you're in within 48 hours of creation. The narrative is your signal." },
  { id: "specialist", title: "The Specialist", accentColour: "#2DD4BF", cluster: "category", motivationTemplate: "90%+ of your trades in one hyper-specific niche. You've gone deep where others go wide — and that focus is your competitive edge." },
  { id: "trend-chaser", title: "The Trend Chaser", accentColour: "#FACC15", cluster: "category", motivationTemplate: "Your category mix shifts with the wind. Whatever's hot, you're there. Crypto one week, politics the next — always following the attention." },
  { id: "contrarian", title: "The Contrarian", accentColour: "#7C3AED", cluster: "category", motivationTemplate: "Low-volume, low-attention markets — that's where you live. While everyone crowds into the popular picks, you're quietly trading what they ignore." },

  // Cluster 5 — Position & Hold Behaviour
  { id: "diamond-hands", title: "The Diamond Hands", accentColour: "#c3ff00", cluster: "position", motivationTemplate: "You hold to resolution. No early exits, no panic sells. Once you're in, you're in until the market decides. Conviction incarnate." },
  { id: "locked-in", title: "The Locked In", accentColour: "#F97316", cluster: "position", motivationTemplate: "1-3 markets hold 80%+ of your exposure. High conviction, high stakes. You pick your spots and go all in. No hedging, no diversifying — just conviction." },
  { id: "diversifier", title: "The Diversifier", accentColour: "#06B6D4", cluster: "position", motivationTemplate: "No single market exceeds 5% of your book. Risk-managed, spread wide, textbook portfolio construction. You sleep well at night." },
  { id: "accumulator", title: "The Accumulator", accentColour: "#84CC16", cluster: "position", motivationTemplate: "You don't just enter once — you press your winners. The same markets keep appearing with bigger size. When you're right, you add more." },
  { id: "hedger", title: "The Hedger", accentColour: "#8B5CF6", cluster: "position", motivationTemplate: "YES and NO on correlated markets simultaneously. You're not betting — you're constructing positions. The hedger always has a plan B." },

  // Cluster 6 — Probability Preference
  { id: "moonshot", title: "The Moonshot", accentColour: "#EAB308", cluster: "probability", motivationTemplate: "Sub-20% outcomes, every time. You're buying lottery tickets with edge. When one hits, it hits big — and +{best_trade} proves it." },
  { id: "safe-hands", title: "The Safe Hands", accentColour: "#22C55E", cluster: "probability", motivationTemplate: "70%+ probability entries across your book. Low variance, high conviction — you take what the market gives you and compound steadily." },
  { id: "coin-flip", title: "The Coin Flip", accentColour: "#A1A1AA", cluster: "probability", motivationTemplate: "45-55% odds, right in the sweet spot. You seek genuine uncertainty — the markets where nobody truly knows. That's where edge lives." },
  { id: "quant", title: "The Quant", accentColour: "#06B6D4", cluster: "probability", motivationTemplate: "Markets consistently move your way after entry. You're finding mispriced outcomes before the crowd corrects them. Systematic and sharp." },
  { id: "degen", title: "The Degen", accentColour: "#c3ff00", cluster: "probability", motivationTemplate: "Sub-10% outcomes. Only miracles. Every position is a moonshot that makes the moonshot traders look conservative. Full degen, no apologies." },
  { id: "efficiency-trader", title: "The Efficiency Trader", accentColour: "#10B981", cluster: "probability", motivationTemplate: "Your bet sizing tracks probability like a formula. Kelly criterion energy — disciplined, calculated, and mathematically optimal." },

  // Cluster 7 — Ecosystem Engagement
  { id: "point-farmer", title: "The Point Farmer", accentColour: "#A3E635", cluster: "ecosystem", motivationTemplate: "Points-to-volume ratio off the charts. You've optimised for platform rewards above all else. The farm is real, and you're harvesting." },
  { id: "og", title: "The OG", accentColour: "#F59E0B", cluster: "ecosystem", motivationTemplate: "One of the first on Limitless. High tenure, high points, deep history. When others were sleeping on prediction markets, you were already here." },
  { id: "lurker", title: "The Lurker", accentColour: "#6B7280", cluster: "ecosystem", motivationTemplate: "Dozens of markets in your watchlist, pennies in each. You're observing the entire platform — participating just enough to stay connected." },
  { id: "true-believer", title: "The True Believer", accentColour: "#3B82F6", cluster: "ecosystem", motivationTemplate: "Sustained activity, never went quiet, high accumulative points. You believe in prediction markets and you've been proving it every single day." },
  { id: "hype-trader", title: "The Hype Trader", accentColour: "#EC4899", cluster: "ecosystem", motivationTemplate: "You show up for the big moments — high-volume, high-profile markets. When the platform buzzes, you're right there in the thick of it." },
];

export function getCardById(id: string): CardConfig | undefined {
  return CARD_CONFIGS.find((c) => c.id === id);
}
