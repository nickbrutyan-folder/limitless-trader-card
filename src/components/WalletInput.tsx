"use client";

import { useState } from "react";

interface WalletInputProps {
  onSubmit: (wallet: string) => void;
  loading: boolean;
}

export function WalletInput({ onSubmit, loading }: WalletInputProps) {
  const [wallet, setWallet] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(wallet.trim());
  const showError = touched && wallet.length > 0 && !isValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (isValid) onSubmit(wallet.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={wallet}
          onChange={(e) => { setWallet(e.target.value); setTouched(false); }}
          onBlur={() => { setTouched(true); setFocused(false); }}
          onFocus={() => setFocused(true)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          disabled={loading}
          className={`w-full rounded-xl px-5 py-4 text-sm font-mono text-white placeholder:text-[#3F3F46] focus:outline-none transition-all duration-150 disabled:opacity-50 ${
            showError
              ? "border border-red-500/40 bg-red-500/[0.03]"
              : focused
              ? "border border-[#dcf68d]/25 bg-white/[0.05]"
              : "border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]"
          }`}
        />
        {wallet.length > 0 && (
          <button
            type="button"
            onClick={() => { setWallet(""); setTouched(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[#52525B] hover:text-white transition-colors text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      {showError && (
        <p className="text-xs text-red-400/70 px-1">
          Enter a valid Ethereum wallet address (0x…)
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !wallet}
        className="w-full py-[17px] text-[13px] font-bold tracking-[0.08em] uppercase transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98] hover:opacity-90"
        style={{
          background: "#dcf68d",
          color: "#080808",
          borderRadius: "10px",
        }}
      >
        {loading ? "Analysing…" : "Reveal My Card"}
      </button>
    </form>
  );
}
