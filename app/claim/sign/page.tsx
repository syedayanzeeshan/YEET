"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardPaste, Loader2, Wallet } from "lucide-react";
import {
  connectPhantomWallet,
  deserializeTransaction,
  explorerTxUrl,
  loadPendingClaimTx,
  signAndSendPreparedTransaction,
  type SolanaWallet
} from "@/app/lib/solana/yeetProgram";

function resolveEncodedTx(pendingId: string | null, legacyTx: string | null, pasted: string): string {
  if (pasted.trim()) return pasted.trim();
  if (pendingId) {
    const stored = loadPendingClaimTx(pendingId);
    if (stored) return stored;
  }
  if (legacyTx && legacyTx.length < 1800) {
    return legacyTx;
  }
  return "";
}

function ClaimSignContent() {
  const searchParams = useSearchParams();
  const pendingId = searchParams.get("pending");
  const legacyTx = searchParams.get("tx");

  const [pastedTx, setPastedTx] = useState("");
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [status, setStatus] = useState("Connect Phantom with the node wallet, then approve.");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const encodedTx = useMemo(
    () => resolveEncodedTx(pendingId, legacyTx, pastedTx),
    [pendingId, legacyTx, pastedTx]
  );

  const feePayer = useMemo(() => {
    if (!encodedTx) return null;
    try {
      return deserializeTransaction(encodedTx).feePayer?.toBase58() ?? null;
    } catch {
      return null;
    }
  }, [encodedTx]);

  const walletMatches = Boolean(
    wallet && feePayer && wallet.publicKey.toBase58() === feePayer
  );

  const canApprove = Boolean(encodedTx && wallet && walletMatches && !signature);

  useEffect(() => {
    if (pendingId && !loadPendingClaimTx(pendingId) && !legacyTx) {
      queueMicrotask(() =>
        setStatus(
          "Transaction not found in this browser. Paste the copied transaction blob below (from the demo panel)."
        )
      );
    } else if (!encodedTx && !pendingId && !legacyTx) {
      queueMicrotask(() => setStatus("Paste the prepared transaction from the On-chain Claims panel."));
    }
  }, [pendingId, legacyTx, encodedTx]);

  const connect = useCallback(async () => {
    const connected = await connectPhantomWallet();
    if (!connected) {
      setStatus("Phantom not found. Install Phantom and switch it to devnet.");
      setWallet(null);
      return;
    }
    setWallet(connected);

    if (!encodedTx) {
      setStatus("Connect wallet, then paste the prepared transaction blob.");
      return;
    }

    if (feePayer && connected.publicKey.toBase58() !== feePayer) {
      setStatus(
        `Connected ${connected.publicKey.toBase58().slice(0, 8)}… — switch Phantom to ${feePayer.slice(0, 8)}… or paste the correct tx.`
      );
      return;
    }

    setStatus("Ready. Approve in Phantom — a fresh blockhash is applied when you confirm.");
  }, [encodedTx, feePayer]);

  async function signAndSend() {
    if (!encodedTx || !wallet) return;
    setBusy(true);
    setStatus("Waiting for Phantom approval…");
    try {
      const sig = await signAndSendPreparedTransaction(wallet, encodedTx);
      setSignature(sig);
      setStatus("Claim submitted on-chain.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-white">Sign claim</h1>
        <p className="mt-2 text-sm text-white/55">
          Use the wallet address you entered on the demo panel. On another device, paste the copied transaction
          blob — not the browser URL.
        </p>
      </div>

      {feePayer ? (
        <div className="border border-white/10 bg-panel/80 p-4 text-xs text-white/60">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Required signer</div>
          <div className="mt-1 break-all font-mono text-white">{feePayer}</div>
        </div>
      ) : null}

      <label className="grid gap-1 text-xs text-white/60">
        Paste prepared transaction (base64)
        <textarea
          className="min-h-[80px] border border-white/10 bg-black/30 px-3 py-2 font-mono text-[10px] text-white outline-none focus:border-pulse"
          placeholder="Paste from “Copy tx for other device” on the claims panel"
          value={pastedTx}
          onChange={(event) => setPastedTx(event.target.value)}
        />
      </label>

      <p className="text-sm text-white/65">{status}</p>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => void connect()}
          className="inline-flex h-11 items-center justify-center gap-2 border border-pulse/35 bg-pulse/15 text-xs font-bold uppercase tracking-[0.16em] text-pulse"
        >
          <Wallet size={16} />
          Connect Phantom
        </button>
        <button
          type="button"
          disabled={!canApprove || busy}
          onClick={() => void signAndSend()}
          className="inline-flex h-11 items-center justify-center gap-2 border border-acid/35 bg-acid/15 text-xs font-bold uppercase tracking-[0.16em] text-acid disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Approve claim tx
        </button>
        {!encodedTx ? (
          <p className="flex items-center gap-1 text-[10px] text-amber">
            <ClipboardPaste size={12} />
            Paste the transaction blob to enable approve.
          </p>
        ) : null}
        {encodedTx && wallet && !walletMatches ? (
          <p className="text-[10px] text-amber">Phantom account must match the required signer above.</p>
        ) : null}
      </div>

      {signature ? (
        <a
          href={explorerTxUrl(signature)}
          target="_blank"
          rel="noreferrer"
          className="break-all border border-acid/30 bg-acid/10 p-3 text-xs text-acid"
        >
          {signature}
        </a>
      ) : null}
    </main>
  );
}

export default function ClaimSignPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6 text-white/50">
          Loading claim transaction…
        </main>
      }
    >
      <ClaimSignContent />
    </Suspense>
  );
}
