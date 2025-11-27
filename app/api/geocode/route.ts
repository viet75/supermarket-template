// app/api/geocode/route.ts
import { NextResponse } from "next/server";

/**
 * API interna che fa da proxy a Nominatim.
 * Aggiunge User-Agent (obbligatorio dai ToS) e centralizza la logica.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
    )}&format=json&limit=3&countrycodes=IT&addressdetails=1`;

    try {
        // Rispetta il rate limit Nominatim
        await new Promise((r) =>
            setTimeout(r, Number(process.env.GEOCODE_RATE_MS ?? 1200))
        );

        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    process.env.GEOCODE_USER_AGENT ??
                    "supermarket-pwa/1.0 (+contatto@example.com)",
                "Accept-Language": "it",
            },
            cache: "no-store", // disabilita cache
        });

        if (!res.ok) {
            console.error("❌ Errore Nominatim:", res.status, res.statusText);
            return NextResponse.json({ error: "Errore Nominatim" }, { status: res.status });
        }

        const data = await res.json();

        // Se nessun risultato → restituisci array vuoto
        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json([]);
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error("❌ Errore server geocode:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
