import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 500 });

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?address=" +
    encodeURIComponent(q) +
    "&key=" +
    apiKey;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "OK")
      return NextResponse.json({ ok: false, error: json.status }, { status: 400 });

    const result = json.results[0];
    return NextResponse.json({
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Fetch error" }, { status: 500 });
  }
}
