import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/lib/providers";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CookiePump",
  description: "Launch memecoins on Cookie Chain in 60 seconds — fair bonding curve, instant trading, zero gatekeeping.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Header />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#12121a",
                color: "#e0e0e0",
                border: "1px solid #1e1e2e",
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}