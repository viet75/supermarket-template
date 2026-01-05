import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const zip = searchParams.get("zip"); // CAP inserito dall'utente (opzionale)
  const city = searchParams.get("city"); // Città inserita dall'utente (opzionale)
  if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 500 });

  // Costruisci la URL Google con URLSearchParams
  const geocodeParams = new URLSearchParams();
  geocodeParams.set("address", q);
  geocodeParams.set("language", "it");
  geocodeParams.set("region", "it");
  
  // Se è presente il parametro zip valido (5 cifre, != 00000), aggiungi components
  if (zip) {
    const zipTrimmed = String(zip).trim();
    if (/^\d{5}$/.test(zipTrimmed) && zipTrimmed !== "00000") {
      geocodeParams.set("components", `country:IT|postal_code:${zipTrimmed}`);
    }
  }
  
  geocodeParams.set("key", apiKey);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams.toString()}`;

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

    // Se zip è presente, valida formato e confronta con postal_code
    if (zip) {
      const zipTrimmed = String(zip).trim();
      // Valida formato /^\d{5}$/ e zip !== "00000" (mantieni blocco per CAP non valido)
      if (!/^\d{5}$/.test(zipTrimmed) || zipTrimmed === "00000") {
        return NextResponse.json({ ok: false, error: "CAP non valido" }, { status: 400 });
      }
      
      // Se Google restituisce location_type = ROOFTOP o RANGE_INTERPOLATED,
      // accetta l'indirizzo anche se postal_code non matcha perfettamente
      const locationType = result.geometry.location_type;
      const isPreciseLocation = locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED";
      
      // Confronta zip con postal_code solo se non è una location precisa
      if (!isPreciseLocation && zipTrimmed !== postal_code) {
        return NextResponse.json({ ok: false, error: "CAP non corrisponde all'indirizzo" }, { status: 400 });
      }
    }

    // Estrai città ufficiale da address_components (priorità: locality > postal_town > administrative_area_level_3 > administrative_area_level_2)
    let cityFromGoogle: string | null = null;
    if (result.address_components) {
      for (const component of result.address_components) {
        if (component.types.includes("locality")) {
          cityFromGoogle = component.long_name || component.short_name;
          break;
        }
      }
      if (!cityFromGoogle) {
        for (const component of result.address_components) {
          if (component.types.includes("postal_town")) {
            cityFromGoogle = component.long_name || component.short_name;
            break;
          }
        }
      }
      if (!cityFromGoogle) {
        for (const component of result.address_components) {
          if (component.types.includes("administrative_area_level_3")) {
            cityFromGoogle = component.long_name || component.short_name;
            break;
          }
        }
      }
      if (!cityFromGoogle) {
        for (const component of result.address_components) {
          if (component.types.includes("administrative_area_level_2")) {
            cityFromGoogle = component.long_name || component.short_name;
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

    // Se city è presente, la validazione città è OBBLIGATORIA
    if (city) {
      // Se cityFromGoogle è null -> return 400 "Città non verificabile per questo indirizzo"
      if (!cityFromGoogle) {
        return NextResponse.json({ ok: false, error: "Città non verificabile per questo indirizzo" }, { status: 400 });
      }
      
      // Altrimenti confronta con logica include/equal
      const normalizedCity = normalizeString(cityFromGoogle);
      const normalizedCityFromParam = normalizeString(city);
      
      // Verifica che la città inserita sia contenuta o combaci con quella di Google
      const cityMatches = 
        normalizedCity === normalizedCityFromParam ||
        normalizedCity.includes(normalizedCityFromParam) ||
        normalizedCityFromParam.includes(normalizedCity);

      if (!cityMatches) {
        return NextResponse.json({ ok: false, error: "Città non coerente con indirizzo e CAP" }, { status: 400 });
      }
    }

    // Risposta JSON deve includere lat/lng, postal_code e city_google quando valido
    return NextResponse.json({
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address,
      postal_code: postal_code,
      ...(cityFromGoogle ? { city_google: cityFromGoogle } : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Fetch error" }, { status: 500 });
  }
}
