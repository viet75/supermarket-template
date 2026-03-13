import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const zip = searchParams.get("zip"); // CAP entered by the user (optional)
  const city = searchParams.get("city"); // City entered by the user (optional)
  if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 500 });

  // Build the Google URL with URLSearchParams
  const geocodeParams = new URLSearchParams();
  geocodeParams.set("address", q);
  geocodeParams.set("language", "it");
  geocodeParams.set("region", "it");
  
  // If the zip parameter is present (5 digits, != 00000), add components
  if (zip) {
    const zipTrimmed = String(zip).trim();
    if (/^\d{5}$/.test(zipTrimmed) && zipTrimmed !== "00000") {
      geocodeParams.set("components", `country:IT|postal_code:${zipTrimmed}`);
    }
  }
  
  geocodeParams.set("key", apiKey);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams.toString()}`;

  const MAPS_UNAVAILABLE = {
    ok: false,
    code: "MAPS_UNAVAILABLE",
    message: "Maps service temporarily unavailable. Please try again later.",
  } as const;

  try {
    const res = await fetch(url);

    // Handling Google Maps errors: quota, billing, limits
    if (res.status === 429 || res.status === 403) {
      return NextResponse.json(MAPS_UNAVAILABLE, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const json = await res.json();

    // If Google geocoding returns 0 results -> return 400
    if (json.status !== "OK" || !json.results || json.results.length === 0) {
      return NextResponse.json({ ok: false, error: "Address not found" }, { status: 400 });
    }

    const result = json.results[0];
    
    // Extract postal_code from address_components
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
      return NextResponse.json({ ok: false, error: "Invalid postal code or not found" }, { status: 400 });
    }

    // Treat "00000" as invalid -> return 400
    if (postal_code === "00000") {
      return NextResponse.json({ ok: false, error: "Invalid postal code" }, { status: 400 });
    }

    // If zip is present, validate format and compare with postal_code
    if (zip) {
      const zipTrimmed = String(zip).trim();
      // Validate format /^\d{5}$/ and zip !== "00000" (keep block for invalid CAP)
      if (!/^\d{5}$/.test(zipTrimmed) || zipTrimmed === "00000") {
        return NextResponse.json({ ok: false, error: "Invalid postal code" }, { status: 400 });
      }
      
      // If Google returns location_type = ROOFTOP or RANGE_INTERPOLATED,
      // accept the address even if postal_code does not match perfectly
      const locationType = result.geometry.location_type;
      const isPreciseLocation = locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED";
      
      // Compare zip with postal_code only if not a precise location
      if (!isPreciseLocation && zipTrimmed !== postal_code) {
        return NextResponse.json({ ok: false, error: "Postal code does not match the address" }, { status: 400 });
      }
    }

    // Extract official city from address_components (priority: locality > postal_town > administrative_area_level_3 > administrative_area_level_2)
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

    // Helper function to normalize strings (lowercase, trim, remove accents)
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\s+/g, " "); // normalize spaces
    };

    // If city is present, city validation is REQUIRED
    if (city) {
      // If cityFromGoogle is null -> return 400 "City not verifiable for this address"
      if (!cityFromGoogle) {
        return NextResponse.json({ ok: false, error: "City not verifiable for this address" }, { status: 400 });
      }
      
      // Otherwise compare with include/equal logic
      const normalizedCity = normalizeString(cityFromGoogle);
      const normalizedCityFromParam = normalizeString(city);
      
      // Verify that the city entered is contained or matches with that of Google
      const cityMatches = 
        normalizedCity === normalizedCityFromParam ||
        normalizedCity.includes(normalizedCityFromParam) ||
        normalizedCityFromParam.includes(normalizedCity);

      if (!cityMatches) {
        return NextResponse.json({ ok: false, error: "City not consistent with address and postal code" }, { status: 400 });
      }
    }

    // JSON response must include lat/lng, postal_code and city_google when valid
    return NextResponse.json({
      ok: true,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address,
      postal_code: postal_code,
      ...(cityFromGoogle ? { city_google: cityFromGoogle } : {}),
    });
  } catch (e) {
    // Network, timeout, parsing: user-friendly message, no technical details
    return NextResponse.json(MAPS_UNAVAILABLE, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
