import { NextResponse } from "next/server";
import { getMetadata } from "@/lib/metadata";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getMetadata(id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = Buffer.from(data.imageBase64, "base64");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": data.imageContentType, "Content-Length": String(buffer.length) },
  });
}