"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WalletInput } from "@/components/WalletInput";
import { AnalysisLoader } from "@/components/AnalysisLoader";
import { TraderCard } from "@/components/TraderCard";
import { DotCanvas } from "@/components/DotCanvas";
import type { TraderCardData } from "@/lib/types";

type Stage = "landing" | "loading" | "result" | "error";

const EXAMPLE_WALLETS = [
  "0xE6Ea72D7371368Ac060C00947cd4DB70D51a81b5",
];

const TITLE = "What kind of trader are you?";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [wallet, setWallet] = useState("");
  const [cardData, setCardData] = useState<TraderCardData | null>(null);
  const [motivation, setMotivation] = useState("");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "done">("idle");
  const cardRef = useRef<HTMLDivElement>(null);
  const apiPromiseRef = useRef<Promise<{ cardData: TraderCardData; motivation: string }> | null>(null);

  function handleSubmit(addr: string) {
    setWallet(addr);
    setError("");
    apiPromiseRef.current = fetch(`/api/generate?wallet=${encodeURIComponent(addr)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to generate card");
        return { cardData: json.cardData, motivation: json.motivation };
      });
    setStage("loading");
  }

  async function handleLoaderComplete() {
    if (!apiPromiseRef.current) return;
    try {
      const result = await apiPromiseRef.current;
      setCardData(result.cardData);
      setMotivation(result.motivation);
      setStage("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStage("error");
    } finally {
      apiPromiseRef.current = null;
    }
  }

  function handleReset() {
    setStage("landing");
    setWallet("");
    setCardData(null);
    setError("");
    setCopyState("idle");
  }

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
        if (!blob) { setCopyState("idle"); return; }
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopyState("done");
          setTimeout(() => setCopyState("idle"), 2000);
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "limitless-trader-card.png";
          a.click();
          URL.revokeObjectURL(url);
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

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col overflow-hidden">

      {/* Background canvas */}
      <DotCanvas />

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10">
        <AnimatePresence mode="wait">

          {/* ── LANDING ── */}
          {stage === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center w-full max-w-xl"
            >
              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-10"
                style={{ color: "#E4E4E7", letterSpacing: "-0.025em" }}
              >
                {TITLE}
              </motion.h1>

              {/* Input */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="w-full"
              >
                <WalletInput onSubmit={handleSubmit} loading={false} />
              </motion.div>

              {/* Example wallets */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-3 justify-center mt-5"
              >
                <span className="text-[11px] font-mono text-[#3F3F46]">try:</span>
                {EXAMPLE_WALLETS.map((w) => (
                  <button
                    key={w}
                    onClick={() => handleSubmit(w)}
                    className="text-[11px] font-mono text-[#52525B] hover:text-[#A1A1AA] transition-colors duration-150"
                  >
                    {w.slice(0, 8)}…
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {stage === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnalysisLoader wallet={wallet} onComplete={handleLoaderComplete} />
            </motion.div>
          )}

          {/* ── RESULT ── */}
          {stage === "result" && cardData && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full max-w-2xl"
            >
              {/* Card */}
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <TraderCard data={cardData} />
              </motion.div>

              {/* Quote — below card */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="max-w-[540px] text-center text-sm text-[#52525B] italic leading-relaxed mt-5"
              >
                &ldquo;{motivation}&rdquo;
              </motion.p>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="flex flex-col sm:flex-row gap-2.5 mt-7 w-full max-w-[600px]"
              >
                {/* Share on X */}
                <button
                  onClick={handleShareX}
                  className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 text-[13px] font-bold tracking-[0.07em] uppercase transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: "#dcf68d",
                    color: "#080808",
                    borderRadius: "10px",
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share on X
                </button>

                {/* Copy image */}
                <button
                  onClick={handleCopyImage}
                  disabled={copyState === "copying"}
                  className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 text-[13px] font-bold tracking-[0.07em] uppercase transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
                  style={{
                    background: "transparent",
                    color: copyState === "done" ? "#22c55e" : "#52525B",
                    borderRadius: "10px",
                    border: copyState === "done"
                      ? "1px solid rgba(34,197,94,0.25)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {copyState === "done" ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copied
                    </>
                  ) : copyState === "copying" ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                      </svg>
                      Copying
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Save Image
                    </>
                  )}
                </button>
              </motion.div>

              {/* Analyse another */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                onClick={handleReset}
                className="mt-5 text-[11px] font-mono tracking-widest text-[#3F3F46] hover:text-[#52525B] transition-colors uppercase"
              >
                ← analyse another wallet
              </motion.button>
            </motion.div>
          )}

          {/* ── ERROR ── */}
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

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center px-6 py-4">
        <span className="text-[10px] tracking-[0.22em] uppercase text-[#1e1e20]">
          limitless.exchange
        </span>
      </footer>
    </div>
  );
}
