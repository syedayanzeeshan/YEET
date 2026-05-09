import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YEET | Solana-Native Correctness Markets",
  description: "YEET rewards nodes for proving the network wrong through adversarially validated ephemeral compute swarms."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
