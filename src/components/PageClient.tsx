"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { WalletInput } from "@/components/WalletInput";
import { TraderCard } from "@/components/TraderCard";
import { CardBack } from "@/components/CardBack";
import { CardScene } from "@/components/CardScene";
import { ParticleField } from "@/components/ParticleField";
import type { TraderCardData } from "@/lib/types";

type Stage = "landing" | "loading" | "revealing" | "result" | "error";

const ANALYSIS_STEPS = [
  "Connecting to Limitless",
  "Scanning your positions",
  "Analysing trade history",
  "Cross-referencing markets",
  "Calculating win rate",
  "Identifying your archetype",
  "Generating your card",
];

const STEP_DURATIONS = [700, 800, 900, 800, 700, 900, 600];

const EXAMPLE_WALLETS = [
  "0xE6Ea72D7371368Ac060C00947cd4DB70D51a81b5",
];

export function PageClient() {
  const [stage, setStage] = useState<Stage>("landing");
  const [wallet, setWallet] = useState("");
  const [prefillWallet, setPrefillWallet] = useState("");
  const [cardData, setCardData] = useState<TraderCardData | null>(null);
  const [motivation, setMotivation] = useState("");
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "done" | "downloaded" | "needs-https"
  >("idle");

  // Card scene state
  const [showFlash, setShowFlash] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [shaking, setShaking] = useState(false);

  const apiPromiseRef =
    useRef<Promise<{ cardData: TraderCardData; motivation: string }> | null>(
      null
    );
  const abortRef = useRef<AbortController | null>(null);
  const revealTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stepTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoSubmittedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revealTimeouts.current.forEach(clearTimeout);
      stepTimeouts.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  // Auto-load when ?wallet=0x... is in the URL — used by shared tweet links so
  // the recipient lands directly on the relevant card. Server-side
  // generateMetadata in app/page.tsx already injects the matching og:image.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const w = searchParams.get("wallet")?.trim();
    if (w && /^0x[0-9a-fA-F]{40}$/.test(w)) {
      autoSubmittedRef.current = true;
      setPrefillWallet(w);
      handleSubmit(w);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  function handleSubmit(addr: string) {
    // Abort any in-flight request from a previous submit
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setWallet(addr);
    setError("");
    setStepIndex(0);
    setIsFlipped(false);
    setIsCharging(true);
    setCopyState("idle");

    apiPromiseRef.current = fetch(
      `/api/generate?wallet=${encodeURIComponent(addr)}`,
      { signal: controller.signal }
    ).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate card");
      return { cardData: json.cardData, motivation: json.motivation };
    });

    setStage("loading");
  }

  const triggerReveal = useCallback(
    (data: { cardData: TraderCardData; motivation: string }) => {
      setCardData(data.cardData);
      setMotivation(data.motivation);
      setStage("revealing");
      setIsCharging(false);

      // Pre-warm the og:image cache. As soon as the user sees their card, fire
      // a background request to /api/card-image so the PNG is rendered and
      // CDN-cached. By the time they click Share on X, Twitter's crawler hits
      // a warm response (~300ms) instead of cold (~5s) and can promote the
      // unfurl from `summary` to `summary_large_image` mode reliably.
      const wallet = data.cardData.walletAddress;
      fetch(`/api/card-image?wallet=${encodeURIComponent(wallet)}`, {
        method: "GET",
        cache: "force-cache",
      }).catch(() => { /* best-effort */ });

      // Clear any previous reveal timeouts before scheduling new ones
      revealTimeouts.current.forEach(clearTimeout);

      // Smooth sequence: flash bloom → card materializes → subtle shake → settle
      revealTimeouts.current = [
        // t=0ms: soft flash bloom begins
        setTimeout(() => setShowFlash(true), 0),
        // t=200ms: card flips while flash is peaking — the brightness covers the swap
        setTimeout(() => setIsFlipped(true), 200),
        // t=500ms: gentle shake as card spring-settles
        setTimeout(() => setShaking(true), 500),
        // t=750ms: shake ends
        setTimeout(() => setShaking(false), 750),
        // t=800ms: flash has fully faded by now
        setTimeout(() => setShowFlash(false), 800),
        // t=1400ms: transition to interactive result state (let spring finish)
        setTimeout(() => setStage("result"), 1400),
      ];
    },
    []
  );

  function handleReset() {
    abortRef.current?.abort();
    revealTimeouts.current.forEach(clearTimeout);
    stepTimeouts.current.forEach(clearTimeout);
    setStage("landing");
    setWallet("");
    setCardData(null);
    setMotivation("");
    setError("");
    setCopyState("idle");
    setIsFlipped(false);
    setIsCharging(false);
    setShaking(false);
    setShowFlash(false);
  }

  /* ── Loading step progression ───────────────────────────────────────────── */

  useEffect(() => {
    if (stage !== "loading") return;

    let cancelled = false;
    let current = 0;
    stepTimeouts.current = [];

    const advance = () => {
      if (cancelled) return;
      setStepIndex(Math.min(current, ANALYSIS_STEPS.length - 1));

      if (current >= ANALYSIS_STEPS.length) {
        resolveApi();
        return;
      }

      const id = setTimeout(() => {
        if (!cancelled) {
          current++;
          advance();
        }
      }, STEP_DURATIONS[current] ?? 700);
      stepTimeouts.current.push(id);
    };

    async function resolveApi() {
      if (!apiPromiseRef.current || cancelled) return;
      try {
        const result = await apiPromiseRef.current;
        if (cancelled) return;
        triggerReveal(result);
      } catch (e: unknown) {
        if (cancelled) return;
        // Don't show abort errors as user-facing errors
        if (e instanceof DOMException && e.name === "AbortError") return;
        setIsCharging(false);
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStage("error");
      } finally {
        apiPromiseRef.current = null;
      }
    }

    advance();
    return () => {
      cancelled = true;
      stepTimeouts.current.forEach(clearTimeout);
    };
  }, [stage, triggerReveal]);

  /* ── Copy / Share ───────────────────────────────────────────────────────── */

  // Server-rendered card image — pixel-perfect, deterministic. Replaces the
  // earlier html2canvas approach which failed on container queries.
  const fetchCardImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardData) return null;
    const res = await fetch(
      `/api/card-image?wallet=${encodeURIComponent(cardData.walletAddress)}`,
      { cache: "force-cache" }
    );
    if (!res.ok) return null;
    return res.blob();
  }, [cardData]);

  const handleCopyImage = useCallback(async () => {
    if (!cardData || copyState === "copying") return;
    setCopyState("copying");
    try {
      const blob = await fetchCardImage();
      if (!blob) {
        setCopyState("idle");
        return;
      }
      // Clipboard API requires a secure context (HTTPS). On HTTP we surface a
      // clear "needs HTTPS" hint instead of silently downloading.
      const secure =
        typeof window !== "undefined" && window.isSecureContext;
      const hasClipboardWrite =
        typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.write === "function" &&
        typeof ClipboardItem !== "undefined";

      if (secure && hasClipboardWrite) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopyState("done");
          setTimeout(() => setCopyState("idle"), 2000);
          return;
        } catch {
          /* fall through to download */
        }
      } else if (!secure) {
        // Show a hint, then still download as a fallback so the user gets the
        // file. They can then upload manually wherever they need.
        setCopyState("needs-https");
        setTimeout(() => setCopyState("idle"), 4000);
      }
      // Download fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `limitless-${cardData.card.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (secure) {
        setCopyState("downloaded");
        setTimeout(() => setCopyState("idle"), 2500);
      }
    } catch {
      setCopyState("idle");
    }
  }, [cardData, copyState, fetchCardImage]);

  const handleShareX = useCallback(async () => {
    if (!cardData) return;

    // Build a shareable URL that includes ?wallet=... so the page can render
    // wallet-specific og:image / twitter:image meta. When Twitter crawls this
    // URL, it unfurls the actual card preview inline in the tweet — image
    // attaches without any manual paste required.
    const shareUrl =
      typeof window !== "undefined"
        ? (() => {
            const u = new URL(window.location.href);
            u.searchParams.set("wallet", cardData.walletAddress);
            return u.toString();
          })()
        : `https://limitless.exchange/card?wallet=${cardData.walletAddress}`;

    const text = `I'm "${cardData.card.title}" on @trylimitless.\n\n"${motivation}"\n\nWhat kind of trader are you? 👇`;
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

    // Try Web Share API on mobile — attaches the image directly to the share
    // sheet. Falls through to URL-with-unfurl + clipboard on desktop.
    try {
      const blob = await fetchCardImage();
      if (blob && typeof navigator.share === "function") {
        const file = new File([blob], "trader-card.png", {
          type: "image/png",
        });
        const data = { files: [file], text, url: shareUrl } as ShareData;
        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare(data)
        ) {
          await navigator.share(data);
          return;
        }
      }
      // Desktop / no native share: copy image to clipboard so the user can
      // paste it into Twitter, then open the compose window
      if (blob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        } catch {
          /* clipboard not available — user will tweet text only */
        }
      }
      window.open(tweetUrl, "_blank");
    } catch {
      // Last-resort fallback
      window.open(tweetUrl, "_blank");
    }
  }, [cardData, motivation, fetchCardImage]);

  /* ── Derived state ──────────────────────────────────────────────────────── */

  const showCard = true;
  const particleIntensity =
    stage === "loading" || stage === "revealing" ? 0.8 : 0.3;

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden relative">
      {/* Ambient particle field */}
      <ParticleField intensity={particleIntensity} />

      {/* Subtle top vignette */}
      <div
        className="fixed inset-x-0 top-0 h-[300px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,0,0,0.02) 0%, transparent 70%)",
        }}
      />

      {/* Flash overlay on reveal — soft bloom */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, times: [0, 0.15, 0.4, 1], ease: "easeOut" }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 42%, rgba(195,255,0,0.6) 0%, rgba(195,255,0,0.2) 40%, transparent 70%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-4">
        <a
          href="https://limitless.exchange"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/limitless-full-logo.svg"
            alt="Limitless"
            className="h-8 sm:h-9 w-auto"
          />
        </a>
        <a
          href="https://limitless.exchange"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-sans text-black/40 hover:text-black/60 transition-colors"
        >
          limitless.exchange
        </a>
      </header>

      {/* Main content */}
      <main
        className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8 ${
          shaking ? "screen-shake" : ""
        }`}
      >
        {/* ── Card scene — fixed anchor, always vertically centered ── */}
        <div className="relative w-full flex flex-col items-center">
          {/* Title floats above card — absolutely positioned so it doesn't shift layout */}
          <AnimatePresence>
            {stage === "landing" && (
              <motion.div
                key="title-block"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-full mb-6 left-0 right-0 text-center"
              >
                <p className="text-[11px] font-medium tracking-[0.25em] uppercase text-black/40 mb-3">
                  Trader Identity
                </p>
                <h1
                  className="text-4xl sm:text-5xl font-bold leading-[1.1]"
                  style={{ color: "#000000", letterSpacing: "0.02em", fontFamily: "var(--font-nichrome), sans-serif" }}
                >
                  What kind of trader are you?
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card */}
          {showCard && (
            <CardScene
              flipped={isFlipped}
              charging={isCharging}
              interactive={stage === "result"}
              floating={stage === "landing"}
            >
              <CardBack />
              {cardData ? (
                <TraderCard data={cardData} />
              ) : (
                <div className="w-full h-full" />
              )}
            </CardScene>
          )}

          {/* Below-card content floats below — absolutely positioned */}
          <div className="absolute top-full left-0 right-0">
            <AnimatePresence mode="wait">
              {/* Landing: wallet input */}
              {stage === "landing" && (
                <motion.div
                  key="landing"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="mt-6 w-full flex flex-col items-center"
                >
                  <WalletInput onSubmit={handleSubmit} loading={false} prefill={prefillWallet} />

                  <div className="flex flex-wrap gap-3 justify-center mt-5">
                    <span className="text-[11px] font-sans text-black/30">
                      try:
                    </span>
                    {EXAMPLE_WALLETS.map((w) => (
                      <button
                        key={w}
                        onClick={() => setPrefillWallet(w)}
                        className="text-[11px] font-sans text-black/40 hover:text-black/70 transition-colors duration-150"
                      >
                        {w.slice(0, 8)}…
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Loading / Revealing: analysis step text */}
              {(stage === "loading" || stage === "revealing") && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 flex flex-col items-center gap-3"
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={stepIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-[13px] text-black/50 font-medium text-center"
                    >
                      {ANALYSIS_STEPS[stepIndex]}
                    </motion.p>
                  </AnimatePresence>

                  <p className="text-[10px] font-sans text-black/30">
                    {wallet.slice(0, 6)}…{wallet.slice(-4)}
                  </p>
                </motion.div>
              )}

              {/* Result: motivation + action buttons */}
              {stage === "result" && cardData && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="mt-6 flex flex-col items-center w-full max-w-2xl mx-auto"
                >
              {/* Motivation quote */}
              <p className="max-w-[540px] text-center text-sm text-black/50 italic leading-relaxed">
                &ldquo;{motivation}&rdquo;
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-7 w-full max-w-[600px]">
                {/* Share on X */}
                <button
                  onClick={handleShareX}
                  className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 text-[13px] font-bold tracking-[0.07em] uppercase transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: "#c3ff00",
                    color: "#080808",
                    borderRadius: "9999px",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5 fill-current shrink-0"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </button>

                {/* Copy / Save image */}
                <button
                  onClick={handleCopyImage}
                  disabled={copyState === "copying"}
                  className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 text-[13px] font-bold tracking-[0.07em] uppercase transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
                  style={{
                    background: "transparent",
                    color:
                      copyState === "done"
                        ? "#22c55e"
                        : copyState === "needs-https"
                        ? "#f59e0b"
                        : "#000000",
                    borderRadius: "9999px",
                    border:
                      copyState === "done"
                        ? "1px solid rgba(34,197,94,0.25)"
                        : copyState === "needs-https"
                        ? "1px solid rgba(245,158,11,0.35)"
                        : "1px solid rgba(0,0,0,0.15)",
                  }}
                  title={
                    copyState === "needs-https"
                      ? "Browser blocks clipboard copy on plain http://. Image was downloaded instead — switch to https:// to copy directly."
                      : undefined
                  }
                >
                  {copyState === "done" ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied
                    </>
                  ) : copyState === "downloaded" ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Downloaded
                    </>
                  ) : copyState === "needs-https" ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                      Use HTTPS to copy
                    </>
                  ) : copyState === "copying" ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 animate-spin shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          strokeOpacity="0.2"
                        />
                        <path
                          d="M12 2a10 10 0 0 1 10 10"
                          strokeLinecap="round"
                        />
                      </svg>
                      Copying
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Image
                    </>
                  )}
                </button>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="mt-5 text-[11px] font-sans tracking-widest text-black/30 hover:text-black/60 transition-colors uppercase"
              >
                ← analyse another wallet
              </button>
            </motion.div>
          )}

          {/* Error: message + retry input */}
          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 flex flex-col items-center gap-5 w-full max-w-lg mx-auto"
            >
              <div className="w-full bg-red-500/[0.06] border border-red-500/15 rounded-full px-5 py-4 text-sm text-red-400 text-center">
                {error}
              </div>
              <WalletInput onSubmit={handleSubmit} loading={false} />
              <button
                onClick={handleReset}
                className="text-[11px] font-sans tracking-widest text-black/30 hover:text-black/60 transition-colors uppercase"
              >
                ← back to start
              </button>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-10 py-4">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-0 border-t border-black/[0.08] pt-4">
          <a
            href="https://limitless.exchange"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-black/30 hover:text-black/50 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/limitless-full-logo.svg"
              alt=""
              className="h-3 w-auto opacity-30"
            />
            Built on Limitless
          </a>
          <div className="flex items-center gap-4">
            <a
              href="https://limitless.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.15em] uppercase text-black/30 hover:text-black/50 transition-colors"
            >
              Trade
            </a>
            <span className="w-px h-2.5 bg-black/[0.1]" />
            <a
              href="https://x.com/trylimitless"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.15em] uppercase text-black/30 hover:text-black/50 transition-colors"
            >
              @trylimitless
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
