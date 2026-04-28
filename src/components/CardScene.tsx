"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CardSceneProps {
  flipped: boolean;
  charging: boolean;
  interactive: boolean;
  floating: boolean;
  children: [ReactNode, ReactNode]; // [back, front]
}

export function CardScene({
  flipped,
  charging,
  interactive,
  floating,
  children,
}: CardSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });

  /* ── Pointer tracking for tilt + holo (mouse + touch) ───────────────────── */

  const updateTilt = useCallback(
    (clientX: number, clientY: number) => {
      if (!interactive) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      setTilt({ x: (0.5 - y) * 15, y: (x - 0.5) * 15 });
      setGlare({ x: x * 100, y: y * 100 });
    },
    [interactive]
  );

  const resetTilt = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => updateTilt(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) updateTilt(e.touches[0].clientX, e.touches[0].clientY);
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", resetTilt);
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", resetTilt);

    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", resetTilt);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", resetTilt);
    };
  }, [updateTilt, resetTilt]);

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <motion.div
      animate={floating ? { y: [0, -8, 0] } : { y: 0 }}
      transition={
        floating
          ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", stiffness: 120, damping: 20, mass: 0.8 }
      }
      className="w-full max-w-[540px] sm:max-w-[620px]"
    >
      <div ref={containerRef} className="relative">
        {/* Tilt layer — only active in result state */}
        <motion.div
          animate={{
            rotateX: interactive ? tilt.x : 0,
            rotateY: interactive ? tilt.y : 0,
          }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ perspective: "1200px" }}
        >
          {/* Aspect-ratio container */}
          <div
            className="relative w-full"
            style={{ aspectRatio: "1.65 / 1" }}
          >
            {/* Card faces — smooth reveal with scale + fade */}
            <AnimatePresence mode="wait">
              {!flipped ? (
                <motion.div
                  key="back"
                  className="absolute inset-0"
                  initial={false}
                  animate={charging ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                  exit={{
                    scale: 0.92,
                    opacity: 0,
                    filter: "brightness(2)",
                  }}
                  transition={
                    charging
                      ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                  }
                >
                  {children[0]}
                </motion.div>
              ) : (
                <motion.div
                  key="front"
                  className="absolute inset-0"
                  initial={{ scale: 0.88, opacity: 0, filter: "brightness(1.8)" }}
                  animate={{ scale: 1, opacity: 1, filter: "brightness(1)" }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    scale: {
                      type: "spring",
                      stiffness: 300,
                      damping: 22,
                      mass: 0.8,
                    },
                    opacity: { duration: 0.3, ease: "easeOut" },
                  }}
                >
                  {children[1]}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Charging effects — pulsing border + scan line */}
            <AnimatePresence>
              {charging && (
                <motion.div
                  className="absolute inset-0 rounded-[20px] pointer-events-none z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 rounded-[20px] card-charge-border" />
                  <div className="absolute inset-0 rounded-[20px] card-scan-line" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Holographic overlay — only in interactive (result) state */}
        {interactive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none z-20"
          >
            {/* Rainbow refraction */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                background: `linear-gradient(${
                  135 + (glare.x - 50) * 2
                }deg, #ff000040, #ff880040, #ffff0040, #00ff0040, #0088ff40, #8800ff40, #ff000040)`,
                mixBlendMode: "color-dodge",
              }}
            />
            {/* Spot glare following cursor */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.12) 0%, transparent 50%)`,
              }}
            />
          </motion.div>
        )}

        {/* Ambient accent glow behind card */}
        <AnimatePresence>
          {(flipped || charging) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                opacity: charging ? 0.18 : 0.1,
                scale: charging ? [0.75, 0.85, 0.75] : 0.8,
              }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={
                charging
                  ? { opacity: { duration: 0.5 }, scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }
                  : { duration: 0.6 }
              }
              className="absolute inset-0 -z-10 blur-3xl rounded-full"
              style={{ background: "#c3ff00" }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
