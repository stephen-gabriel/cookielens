import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { quoteCookiebox } from "@/server/swap";
import { jsonError } from "@/server/http";
import { parseSwapParams } from "@/server/swap-params";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = parseSwapParams(req.nextUrl.searchParams, { requireOwner: false });
  if ("error" in params) return jsonError(params.error, 400);

  const { inputMint, outputMint, amount, inputDecimals, outputDecimals, slippageBps, owner } = params;

  try {
    let quote;
    try {
      quote = await quoteCookiebox({ inputMint, outputMint, amount, inputDecimals, slippageBps, owner });
    } catch (err) {
      if (err instanceof Error && /aggregator/.test(err.message)) {
        return jsonError(`Swap quote service unavailable. ${err.message}`, 502);
      }
      throw err;
    }

    if (!quote) {
      return NextResponse.json({
        ok: true,
        input: { mint: inputMint, decimals: inputDecimals, amount },
        output: { mint: outputMint, decimals: outputDecimals },
        quote: null,
        slippageBps,
      });
    }

    return NextResponse.json({
      ok: true,
      input: { mint: inputMint, decimals: inputDecimals, amount },
      output: { mint: outputMint, decimals: outputDecimals },
      quote,
      slippageBps,
    });
  } catch (err) {
    console.error("swap quote failed", err);
    return jsonError("Failed to get a swap quote.", 500);
  }
}