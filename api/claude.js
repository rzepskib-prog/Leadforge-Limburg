export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "GROQ_API_KEY not set in Vercel environment variables" }); return; }

  try {
    const { messages } = req.body;
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);

    // Return in same format as Claude so App.jsx works unchanged
    res.status(200).json({
      content: [{ type: "text", text: data.choices?.[0]?.message?.content || "" }]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
