"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WalletInput } from "@/components/WalletInput";
import { TraderCard } from "@/components/TraderCard";
import { CardBack } from "@/components/CardBack";
import { CardScene } from "@/components/CardScene";
import { ParticleField } from "@/components/ParticleField";
import type { TraderCardData } from "@/lib/types";

type Stage = "landing" | "loading" | "revealing" | "result" | "error";

const ANALYSIS_STEPS = [
  "Pulling on-chain data",
  "Analysing trade history",
  "Cross-referencing markets",
  "Calculating win rate",
  "Measuring positions",
  "Identifying archetype",
  "Building your card",
];

const STEP_DURATIONS = [700, 800, 900, 800, 700, 900, 600];

const EXAMPLE_WALLETS = [
  "0xE6Ea72D7371368Ac060C00947cd4DB70D51a81b5",
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [wallet, setWallet] = useState("");
  const [cardData, setCardData] = useState<TraderCardData | null>(null);
  const [motivation, setMotivation] = useState("");
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "done">(
    "idle"
  );

  // Card scene state
  const [showFlash, setShowFlash] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [shaking, setShaking] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const apiPromiseRef =
    useRef<Promise<{ cardData: TraderCardData; motivation: string }> | null>(
      null
    );
  const abortRef = useRef<AbortController | null>(null);
  const revealTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stepTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revealTimeouts.current.forEach(clearTimeout);
      stepTimeouts.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

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
      setShowFlash(true);

      // Clear any previous reveal timeouts before scheduling new ones
      revealTimeouts.current.forEach(clearTimeout);
      revealTimeouts.current = [
        setTimeout(() => setShowFlash(false), 600),
        setTimeout(() => setIsFlipped(true), 100),
        setTimeout(() => setShaking(true), 200),
        setTimeout(() => setShaking(false), 500),
        setTimeout(() => setStage("result"), 1100),
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

  const handleCopyImage = useCallback(async () => {
    if (!cardRef.current || copyState === "copying") return;
    setCopyState("copying");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCopyState("idle");
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopyState("done");
          setTimeout(() => setCopyState("idle"), 2000);
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "limitless-trader-card.png";
          a.click();
          // Delay revoke to ensure browser reads the blob
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setCopyState("idle");
        }
      }, "image/png");
    } catch {
      setCopyState("idle");
    }
  }, [copyState]);

  function handleShareX() {
    if (!cardData) return;
    const text = encodeURIComponent(
      `I'm ${cardData.card.title} on Limitless Exchange.\n\n"${motivation}"\n\nDiscover your trader archetype 👇`
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  }

  /* ── Derived state ──────────────────────────────────────────────────────── */

  const showCard = stage !== "error";
  const particleIntensity =
    stage === "loading" || stage === "revealing" ? 0.8 : 0.3;

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col overflow-hidden relative">
      {/* Ambient particle field */}
      <ParticleField intensity={particleIntensity} />

      {/* Flash overlay on reveal */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 45%, #DCF58C 0%, rgba(220,245,140,0.4) 30%, transparent 70%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main
        className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 ${
          shaking ? "screen-shake" : ""
        }`}
      >
        {/* ── Title (landing only) ── */}
        <AnimatePresence>
          {stage === "landing" && (
            <motion.h1
              key="title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-8 text-center"
              style={{ color: "#E4E4E7", letterSpacing: "-0.025em" }}
            >
              What kind of trader are you?
            </motion.h1>
          )}
        </AnimatePresence>

        {/* ── Card scene (persists across landing → loading → reveal → result) ── */}
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

        {/* ── Below-card content (transitions between stages) ── */}
        <AnimatePresence mode="wait">
          {/* Landing: wallet input */}
          {stage === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mt-8 w-full flex flex-col items-center"
            >
              <WalletInput onSubmit={handleSubmit} loading={false} />

              <div className="flex flex-wrap gap-3 justify-center mt-5">
                <span className="text-[11px] font-mono text-[#3F3F46]">
                  try:
                </span>
                {EXAMPLE_WALLETS.map((w) => (
                  <button
                    key={w}
                    onClick={() => handleSubmit(w)}
                    className="text-[11px] font-mono text-[#52525B] hover:text-[#A1A1AA] transition-colors duration-150"
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
                  className="text-[13px] text-[#52525B] font-medium text-center"
                >
                  {ANALYSIS_STEPS[stepIndex]}
                </motion.p>
              </AnimatePresence>

              <p className="text-[10px] font-mono text-[#27272A]">
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
              className="mt-6 flex flex-col items-center w-full max-w-2xl"
            >
              {/* Motivation quote */}
              <p className="max-w-[540px] text-center text-sm text-[#52525B] italic leading-relaxed">
                &ldquo;{motivation}&rdquo;
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-7 w-full max-w-[600px]">
                {/* Share on X */}
                <button
                  onClick={handleShareX}
                  className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 text-[13px] font-bold tracking-[0.07em] uppercase transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: "#DCF58C",
                    color: "#080808",
                    borderRadius: "10px",
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
                      copyState === "done" ? "#22c55e" : "#52525B",
                    borderRadius: "10px",
                    border:
                      copyState === "done"
                        ? "1px solid rgba(34,197,94,0.25)"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
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
                      Save Image
                    </>
                  )}
                </button>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="mt-5 text-[11px] font-mono tracking-widest text-[#3F3F46] hover:text-[#52525B] transition-colors uppercase"
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
              className="flex flex-col items-center gap-6 w-full max-w-lg"
            >
              <div className="w-full bg-red-500/[0.06] border border-red-500/15 rounded-xl px-5 py-4 text-sm text-red-400 text-center">
                {error}
              </div>
              <WalletInput onSubmit={handleSubmit} loading={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden off-screen card for html2canvas screenshot */}
      {cardData && (
        <div
          ref={cardRef}
          className="fixed pointer-events-none"
          style={{ left: "-9999px", top: 0 }}
        >
          <div style={{ width: "620px" }}>
            <TraderCard data={cardData} />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center px-6 py-4">
        <span className="text-[10px] tracking-[0.22em] uppercase text-[#1e1e20]">
          limitless.exchange
        </span>
      </footer>
    </div>
  );
}
