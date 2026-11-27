// Iron and Mat review server (Cloudflare Worker).
// It keeps your Anthropic API key private and only answers the app.
//
// Settings to add in Cloudflare (Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY  (Secret)  your key from console.anthropic.com
//   ACCESS_CODE        (Secret)  a long passphrase you make up; enter the same one in the app
//   ALLOWED_ORIGIN     (Text)    https://mhnz666.github.io

const MODEL = "claude-sonnet-5-5";
const MAX_PROMPT = 12000;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Access-Code",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    if (origin && request.headers.get("Origin") !== origin) return reply(403, { error: "Not allowed from this site." });
    if (!env.ACCESS_CODE || request.headers.get("X-Access-Code") !== env.ACCESS_CODE) return reply(401, { error: "Wrong access code." });
    if (!env.ANTHROPIC_API_KEY) return reply(500, { error: "The server has no API key set." });

    let prompt = "";
    try { prompt = String((await request.json()).prompt || ""); } catch (e) { return reply(400, { error: "Bad request." }); }
    if (!prompt || prompt.length > MAX_PROMPT) return reply(400, { error: "Missing or oversized prompt." });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return reply(r.status === 429 ? 429 : 502, { error: "Anthropic API error " + r.status });
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    return reply(200, { text });
  },
};
