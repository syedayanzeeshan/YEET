"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { connectInjectedWallet } from "@/app/lib/wallet";

export function WalletButton() {
  const [address, setAddress] = useState<string>("");

  async function connect() {
    const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown> } }).ethereum;
    setAddress(await connectInjectedWallet(ethereum));
  }

  return (
    <button
      onClick={connect}
      className="inline-flex h-10 items-center gap-2 border border-pulse/30 bg-pulse/10 px-3 text-xs uppercase tracking-[0.18em] text-pulse shadow-glow transition hover:bg-pulse/20"
      type="button"
    >
      <Wallet size={16} />
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Wallet"}
    </button>
  );
}
