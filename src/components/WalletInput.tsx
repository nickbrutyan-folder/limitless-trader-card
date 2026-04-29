"use client";

import { useState, useEffect } from "react";

interface WalletInputProps {
  onSubmit: (wallet: string) => void;
  loading: boolean;
  prefill?: string;
}

export function WalletInput({ onSubmit, loading, prefill }: WalletInputProps) {
  const [wallet, setWallet] = useState(prefill ?? "");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (prefill) {
      setWallet(prefill);
      setTouched(false);
    }
  }, [prefill]);

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(wallet.trim());
  const showError = touched && wallet.length > 0 && !isValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (isValid) onSubmit(wallet.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl flex flex-col gap-3 rounded-2xl p-3 sm:p-3 border border-black/[0.08]"
      style={{ background: "rgba(0,0,0,0.02)" }}
    >
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value);
              setTouched(false);
            }}
            onBlur={() => {
              setTouched(true);
              setFocused(false);
            }}
            onFocus={() => setFocused(true)}
            placeholder="Add wallet e.g. 0xE6Ea72D7...1a81b5"
            spellCheck={false}
            autoComplete="off"
            disabled={loading}
            className={`w-full rounded-full px-5 py-4 text-sm text-black placeholder:text-black/30 focus:outline-none transition-all duration-150 disabled:opacity-50 ${
              showError
                ? "border border-red-500/40 bg-red-500/[0.03]"
                : focused
                ? "border border-black/20 bg-black/[0.03]"
                : "border border-black/[0.08] bg-black/[0.02] hover:border-black/15"
            }`}
          />
          {wallet.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setWallet("");
                setTouched(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-black/30 hover:text-black transition-colors text-sm leading-none"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !isValid}
          className="shrink-0 w-full sm:w-auto px-8 py-[17px] text-[13px] font-bold tracking-[0.08em] uppercase transition-all duration-150 active:scale-[0.98] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "#c3ff00",
            color: "#080808",
            borderRadius: "9999px",
          }}
        >
          {loading ? "Analysing…" : "Reveal My Card"}
        </button>
      </div>

      {showError && (
        <p className="text-xs text-red-400/70 px-1">
          Enter a valid Ethereum wallet address (0x…)
        </p>
      )}
    </form>
  );
}
