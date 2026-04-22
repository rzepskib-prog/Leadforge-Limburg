export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const GOOGLE_KEY = "AIzaSyDitl_in7VSJXt66F-Y3KHeRLAHkSYytH0";
  const testUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+Venlo+Nederland&key=" + GOOGLE_KEY;

  try {
    const r = await fetch(testUrl);
    const data = await r.json();
    res.status(200).json({
      status: data.status,
      resultsCount: data.results?.length || 0,
      firstResult: data.results?.[0]?.name || "none",
      error_message: data.error_message || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
