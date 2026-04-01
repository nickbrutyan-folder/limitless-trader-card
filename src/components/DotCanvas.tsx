"use client";

import { useEffect, useRef } from "react";

// Noise-wave dot field:
// Each grid point's size + opacity is driven by overlapping sine waves (pseudo-Perlin).
// Creates slow organic undulation — premium ambient texture.
// Shape type (circle vs square) morphs by zone over time, not per-frame random.
// Color: near-white, very low opacity — keeps lime accent exclusively on UI.

const GRID_STEP = 44;
const MIN_R = 0.6;
const MAX_R = 3.6;
const SPEED = 0.00045; // very slow — full wave cycle ≈ 4–5 min
const FPS = 30;

// Multi-octave sine noise, returns 0–1
function noise(x: number, y: number, t: number): number {
  const n1 = Math.sin(x * 0.007 + t) * Math.sin(y * 0.0085 + t * 0.71);
  const n2 = Math.sin(x * 0.014 - t * 0.53) * Math.sin(y * 0.0055 + t * 1.27);
  const n3 = Math.sin(x * 0.004 + y * 0.006 + t * 0.34);
  return (n1 * 0.5 + n2 * 0.32 + n3 * 0.18 + 1) / 2;
}

export function DotCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    let rafId: number;
    let lastTime = 0;
    const interval = 1000 / FPS;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function draw(now: number) {
      rafId = requestAnimationFrame(draw);
      if (now - lastTime < interval) return;
      lastTime = now;

      if (!canvas || !ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      t += SPEED;

      // Vignette: shapes near the edges are more visible than dead center
      const cx = width / 2;
      const cy = height / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      for (let gx = GRID_STEP / 2; gx < width + GRID_STEP; gx += GRID_STEP) {
        for (let gy = GRID_STEP / 2; gy < height + GRID_STEP; gy += GRID_STEP) {
          const n = noise(gx, gy, t);

          // Radial fade: shapes toward edges are slightly more visible
          const dx = (gx - cx) / maxDist;
          const dy = (gy - cy) / maxDist;
          const radial = 0.3 + 0.7 * (dx * dx + dy * dy);

          const r = MIN_R + n * (MAX_R - MIN_R);
          // Total opacity range: ~1% – 5.5%
          const opacity = (0.012 + n * 0.043) * radial;

          // Shape zones morph slowly — not per-frame random, so no flicker
          const isCircle = Math.sin(gx * 0.018 + gy * 0.014 + t * 0.08) > 0;

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = "#e8f0d0"; // slightly warm white, not pure #fff

          if (isCircle) {
            ctx.beginPath();
            ctx.arc(gx, gy, r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
          }

          ctx.restore();
        }
      }
    }

    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}
