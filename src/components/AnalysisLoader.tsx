"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { text: "Pulling on-chain data", duration: 700 },
  { text: "Analysing trade history", duration: 800 },
  { text: "Cross-referencing markets", duration: 900 },
  { text: "Calculating win rate", duration: 800 },
  { text: "Measuring positions", duration: 700 },
  { text: "Identifying archetype", duration: 900 },
  { text: "Building your card", duration: 600 },
];

const TOTAL = STEPS.reduce((a, s) => a + s.duration, 0);

export function AnalysisLoader({
  wallet,
  onComplete,
}: {
  wallet: string;
  onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    let current = 0;
    let totalElapsed = 0;

    const runStep = () => {
      if (current >= STEPS.length) {
        setProgress(100);
        setTimeout(() => {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, 400);
        return;
      }
      setStepIndex(current);
      const duration = STEPS[current].duration;
      const start = totalElapsed;

      const tick = setInterval(() => {
        const elapsed = start + duration;
        setProgress(Math.min(99, Math.round((elapsed / TOTAL) * 100)));
      }, 50);

      setTimeout(() => {
        clearInterval(tick);
        totalElapsed = STEPS.slice(0, current + 1).reduce((a, s) => a + s.duration, 0);
        setProgress(Math.round((totalElapsed / TOTAL) * 100));
        current++;
        runStep();
      }, duration);
    };

    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const short = wallet.slice(0, 6) + "…" + wallet.slice(-4);

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] w-full max-w-md mx-auto px-4">

      {/* Wallet label */}
      <p className="text-[10px] font-mono tracking-[0.2em] text-[#27272A] uppercase mb-10">
        {short}
      </p>

      {/* Step text */}
      <div className="h-5 mb-4 flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[13px] text-center text-[#52525B] font-medium"
          >
            {STEPS[stepIndex]?.text}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[280px] mb-3">
        <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#dcf68d]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      <span className="text-[10px] font-mono text-[#27272A] tabular-nums">{progress}%</span>
    </div>
  );
}
