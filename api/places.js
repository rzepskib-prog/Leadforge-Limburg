export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const GOOGLE_KEY = "AIzaSyDitl_in7VSJXt66F-Y3KHeRLAHkSYytH0";

  // If no query param — run a test and return diagnostic info
  if (!req.query.query) {
    const testUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+Venlo+Nederland&key=" + GOOGLE_KEY;
    try {
      const r = await fetch(testUrl);
      const data = await r.json();
      res.status(200).json({
        mode: "test",
        status: data.status,
        resultsCount: data.results?.length || 0,
        firstResult: data.results?.[0]?.name || "none",
        error_message: data.error_message || null,
      });
    } catch (e) {
      res.status(500).json({ mode: "test", error: e.message });
    }
    return;
  }

  // Normal search
  const { query, lat, lng, radius = 15000 } = req.query;
  const url = "https://maps.googleapis.com/maps/api/place/textsearch/json" +
    "?query=" + encodeURIComponent(query) +
    (lat && lng ? "&location=" + lat + "," + lng : "") +
    "&radius=" + radius +
    "&key=" + GOOGLE_KEY;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
