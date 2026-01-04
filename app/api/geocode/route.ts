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

    // Se Google geocoding ritorna 0 risultati -> return 400
    if (json.status !== "OK" || !json.results || json.results.length === 0) {
      return NextResponse.json({ ok: false, error: "Indirizzo non trovato" }, { status: 400 });
    }

    const result = json.results[0];
    
    // Estrai postal_code da address_components
    let postal_code: string | null = null;
    if (result.address_components) {
      for (const component of result.address_components) {
        if (component.types.includes("postal_code")) {
          postal_code = component.long_name || component.short_name;
          break;
        }
      }
    }

    // Se postal_code assente o non matcha /^\d{5}$/ -> return 400
    if (!postal_code || !/^\d{5}$/.test(postal_code)) {
      return NextResponse.json({ ok: false, error: "CAP non valido o non trovato" }, { status: 400 });
    }

    // Tratta "00000" come non valido -> return 400
    if (postal_code === "00000") {
      return NextResponse.json({ ok: false, error: "CAP non valido" }, { status: 400 });
    }

    // Se nel parametro q è presente un CAP 5 cifre, verifica che combaci con postal_code
    const capMatch = q.match(/\b(\d{5})\b/);
    if (capMatch) {
      const capFromQuery = capMatch[1];
      if (capFromQuery !== postal_code) {
        return NextResponse.json({ ok: false, error: "CAP non corrisponde all'indirizzo" }, { status: 400 });
      }
    }

    // Estrai città ufficiale da address_components (priorità: locality > postal_town > administrative_area_level_3)
    let city: string | null = null;
    if (result.address_components) {
      for (const component of result.address_components) {
        if (component.types.includes("locality")) {
          city = component.long_name || component.short_name;
          break;
        }
      }
      if (!city) {
        for (const component of result.address_components) {
          if (component.types.includes("postal_town")) {
            city = component.long_name || component.short_name;
            break;
          }
        }
      }
      if (!city) {
        for (const component of result.address_components) {
          if (component.types.includes("administrative_area_level_3")) {
            city = component.long_name || component.short_name;
            break;
          }
        }
      }
    }

    // Funzione helper per normalizzare stringhe (lowercase, trim, rimuovi accenti)
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // rimuovi accenti
        .replace(/\s+/g, " "); // normalizza spazi
    };

    // Se la richiesta contiene una città, verifica che combaci
    if (city) {
      // Estrai potenziali nomi di città dal parametro q (prima del CAP se presente)
      const qWithoutCap = q.replace(/\b\d{5}\b/g, "").trim();
      const parts = qWithoutCap.split(",").map(p => p.trim()).filter(p => p.length > 0);
      
      // Cerca una città nel parametro q (di solito è l'ultima parte o una parte significativa)
      let cityFromQuery: string | null = null;
      if (parts.length > 0) {
        // Prendi l'ultima parte (di solito è la città) o cerca una parte che non sia un numero
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i];
          // Se non è un numero e ha almeno 3 caratteri, potrebbe essere una città
          if (!/^\d+$/.test(part) && part.length >= 3) {
            cityFromQuery = part;
            break;
          }
        }
      }

      if (cityFromQuery) {
        const normalizedCity = normalizeString(city);
        const normalizedCityFromQuery = normalizeString(cityFromQuery);
        
        // Verifica che la città inserita sia contenuta o combaci con quella di Google
        const cityMatches = 
          normalizedCity === normalizedCityFromQuery ||
          normalizedCity.includes(normalizedCityFromQuery) ||
          normalizedCityFromQuery.includes(normalizedCity);

        if (!cityMatches) {
          return NextResponse.json({ ok: false, error: "Città non coerente con indirizzo e CAP" }, { status: 400 });
        }
      }
    }

    // Risposta JSON deve includere lat/lng, postal_code e city quando valido
    return NextResponse.json({
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address,
      postal_code: postal_code,
      ...(city ? { city: city } : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Fetch error" }, { status: 500 });
  }
}
