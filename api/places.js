export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const GOOGLE_KEY = "AIzaSyDitl_in7VSJXt66F-Y3KHeRLAHkSYytH0";

  // Test mode — no query param
  if (!req.query.query) {
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_KEY,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.id",
        },
        body: JSON.stringify({ textQuery: "restaurant Venlo Nederland", maxResultCount: 3 }),
      });
      const data = await r.json();
      res.status(200).json({
        mode: "test",
        status: data.error ? "ERROR" : "OK",
        resultsCount: data.places?.length || 0,
        firstResult: data.places?.[0]?.displayName?.text || "none",
        error: data.error || null,
      });
    } catch (e) {
      res.status(500).json({ mode: "test", error: e.message });
    }
    return;
  }

  // Normal search using Places API (New)
  const { query, lat, lng } = req.query;

  const body = {
    textQuery: query,
    maxResultCount: 10,
  };

  if (lat && lng) {
    body.locationBias = {
      circle: {
        center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        radius: 15000,
      },
    };
  }

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.id,places.nationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();

    // Normalize response to match old format so App.jsx works unchanged
    const results = (data.places || []).map(p => ({
      name: p.displayName?.text || "",
      formatted_address: p.formattedAddress || "",
      rating: p.rating || null,
      place_id: p.id || "",
      phone: p.nationalPhoneNumber || null,
      website: p.websiteUri || null,
    }));

    res.status(200).json({ status: "OK", results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
