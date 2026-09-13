import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildCookieboxSwapTx } from "@/server/swap";
import { parseSwapParams } from "@/server/swap-params";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const inputMint = typeof body.inputMint === "string" ? body.inputMint.trim() : "";
  const outputMint = typeof body.outputMint === "string" ? body.outputMint.trim() : "";
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const inputDecimals =
    typeof body.inputDecimals === "number" && Number.isInteger(body.inputDecimals)
      ? body.inputDecimals
      : 9;
  const slippageBps =
    typeof body.slippageBps === "number" && Number.isInteger(body.slippageBps) ? body.slippageBps : 300;

  const sp = new URLSearchParams({
    inputMint,
    outputMint,
    owner,
    amount,
    inputDecimals: String(inputDecimals),
    outputDecimals: String(9),
    slippageBps: String(slippageBps),
  });

  const parsed = parseSwapParams(sp, { requireOwner: true });
  if ("error" in parsed) return jsonError(parsed.error, 400);

  try {
    const built = await buildCookieboxSwapTx({
      inputMint: parsed.inputMint,
      outputMint: parsed.outputMint,
      amount: parsed.amount,
      inputDecimals: parsed.inputDecimals,
      slippageBps: parsed.slippageBps,
      owner: parsed.owner as string,
    });

    return NextResponse.json({
      ok: true,
      transactionBase64: built.transactionBase64,
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
      quote: built.route,
    });
  } catch (err) {
    console.error("swap build failed", err);
    if (err instanceof Error && /aggregator/.test(err.message)) {
      return jsonError(`Swap service unavailable. ${err.message}`, 502);
    }
    return jsonError("Failed to build swap transaction.", 500);
  }
}