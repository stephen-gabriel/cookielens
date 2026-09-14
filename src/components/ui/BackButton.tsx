"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * One-level back affordance: pops the SPA history when there is one,
 * otherwise returns to the home feed.
 */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);

  return (
    <button
      onClick={goBack}
      className="-ml-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-text-secondary transition hover:bg-border/40 hover:text-text-primary"
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}