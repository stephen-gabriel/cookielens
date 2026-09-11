import { NextResponse } from "next/server";
import { getMetadata } from "@/lib/metadata";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getMetadata(id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const host = _request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return NextResponse.json({
    name: data.name,
    symbol: data.symbol,
    description: data.description,
    image: `${baseUrl}/api/metadata/${id}/image`,
  });
}