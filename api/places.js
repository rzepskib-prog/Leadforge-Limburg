export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const GOOGLE_KEY = process.env.GOOGLE_API_KEY || "AIzaSyDitl_in7VSJXt66F-Y3KHeRLAHkSYytH0";
  const { query, lat, lng } = req.query;

  const body = {
    textQuery: query || "restaurant Venlo Nederland",
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
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.id,places.nationalPhoneNumber,places.websiteUri,places.userRatingCount",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }

    const results = (data.places || []).map(p => ({
      name: p.displayName?.text || "",
      formatted_address: p.formattedAddress || "",
      rating: p.rating || null,
      place_id: p.id || "",
      phone: p.nationalPhoneNumber || null,
      website: p.websiteUri || null,
      user_ratings_total: p.userRatingCount || 0,
    }));

    res.status(200).json({ status: "OK", results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
