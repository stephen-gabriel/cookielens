import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { LeftNav } from "@/components/layout/LeftNav";
import { RightRail } from "@/components/layout/RightRail";
import { WalletProvider } from "@/lib/providers";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "CookieLens",
  description: "Social discovery for Cookie Chain — understand what's happening on-chain, who's involved, and what you can do next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AuthProvider>
            <Header />
            <div className="mx-auto flex w-full max-w-6xl items-start">
              <aside className="sticky top-14 hidden w-56 shrink-0 self-start md:block">
                <LeftNav />
                <p className="px-3 text-xs leading-relaxed text-text-secondary">
                  Social discovery for Cookie Chain activity.
                </p>
              </aside>
              <main className="min-h-screen min-w-0 flex-1 border-x border-border px-4 pb-24 pt-4 md:pb-10">
                {children}
              </main>
              <aside className="sticky top-14 hidden w-72 shrink-0 self-start lg:block">
                <RightRail />
              </aside>
            </div>
            <BottomNav />
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
          </AuthProvider>
        </WalletProvider>
      </body>
    </html>
  );
}