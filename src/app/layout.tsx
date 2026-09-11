import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/lib/providers";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CookieLens",
  description: "Portfolio tracker and market analytics for Cookie Chain — watch your COOK and every token on the chain in one place.",
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