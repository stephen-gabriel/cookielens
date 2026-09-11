import { NextResponse } from "next/server";
import { storeMetadata } from "@/lib/metadata";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, symbol, description, imageBase64, imageContentType } = body as {
    name: string;
    symbol: string;
    description: string;
    imageBase64: string;
    imageContentType: string;
  };
  if (!name || !symbol || !imageBase64) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  storeMetadata(id, { name, symbol, description, imageBase64, imageContentType: imageContentType ?? "image/png" });
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return NextResponse.json({ uri: `${baseUrl}/api/metadata/${id}` });
}