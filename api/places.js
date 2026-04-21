export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { query, lat, lng, radius = 15000 } = req.query;
  if (!query) { res.status(400).json({ error: "Missing query" }); return; }

  const GOOGLE_KEY = "AIzaSyDitl_in7VSJXt66F-Y3KHeRLAHkSYytH0";
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
