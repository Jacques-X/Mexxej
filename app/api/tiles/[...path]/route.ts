import { NextRequest, NextResponse } from "next/server";

// Force this function to run in a US region — the Google Map Tiles API
// blocks requests from EEA IP addresses. Running server-side in the US
// bypasses that restriction while the key itself remains valid.
export const preferredRegion = "iad1";
export const runtime = "nodejs";

const UPSTREAM = "https://tile.googleapis.com/v1/3dtiles";
const API_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const tileUrl = new URL(`${UPSTREAM}/${path.join("/")}`);

  // Add the API key server-side; forward any other query params Cesium sends
  tileUrl.searchParams.set("key", API_KEY);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "key") tileUrl.searchParams.set(key, value);
  });

  let upstream: Response;
  try {
    upstream = await fetch(tileUrl.toString(), { cache: "no-store" });
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";

  // JSON responses (root.json, tileset.json) may contain absolute tile.googleapis.com
  // URLs. Rewrite them so Cesium always routes through this proxy.
  if (contentType.includes("json")) {
    let text = await upstream.text();
    text = text.replace(
      /https:\/\/tile\.googleapis\.com\/v1\/3dtiles\//g,
      "/api/tiles/"
    );
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // Binary tiles — stream through as-is
  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
