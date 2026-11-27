// Iron and Mat server (Cloudflare Worker).
// Keeps your secrets off the public app: the WHOOP client secret and, optionally, an Anthropic API key.
//
// Variables and Secrets to add in Cloudflare (Settings > Variables and Secrets):
//   ACCESS_CODE          Secret  a long passphrase you make up; enter the same one in the app
//   ALLOWED_ORIGIN       Text    https://mhnz666.github.io
//   WHOOP_CLIENT_ID      Text    from the WHOOP developer dashboard
//   WHOOP_CLIENT_SECRET  Secret  from the WHOOP developer dashboard
//   ANTHROPIC_API_KEY    Secret  for reading cardio photos and instant Claude reviews

const MODEL = "claude-sonnet-5-5";
const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer";
const WHOOP_PATHS = /^\/v[12]\/(recovery|cycle|activity\/sleep|activity\/workout|user\/profile\/basic|user\/measurement\/body)(\/[\w-]+)*(\?[\w=&:.%+-]*)?$/;

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
    if (request.method === "GET") return reply(200, { ok: true, message: "Iron and Mat server is running." });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    if (origin && request.headers.get("Origin") !== origin) return reply(403, { error: "Not allowed from this site." });
    if (!env.ACCESS_CODE || request.headers.get("X-Access-Code") !== env.ACCESS_CODE) return reply(401, { error: "Wrong access code." });

    let body = {};
    try { body = await request.json(); } catch (e) { return reply(400, { error: "Bad request." }); }
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    // WHOOP: swap the one-time login code for tokens
    if (path === "/whoop/token" || path === "/whoop/refresh") {
      if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) return reply(500, { error: "WHOOP is not set up on the server." });
      const form = new URLSearchParams({ client_id: env.WHOOP_CLIENT_ID, client_secret: env.WHOOP_CLIENT_SECRET });
      if (path === "/whoop/token") {
        if (!body.code || !body.redirect_uri) return reply(400, { error: "Missing code." });
        form.set("grant_type", "authorization_code");
        form.set("code", String(body.code));
        form.set("redirect_uri", String(body.redirect_uri));
      } else {
        if (!body.refresh_token) return reply(400, { error: "Missing refresh token." });
        form.set("grant_type", "refresh_token");
        form.set("refresh_token", String(body.refresh_token));
        form.set("scope", "offline");
      }
      const r = await fetch(WHOOP_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return reply(r.status === 400 || r.status === 401 ? 401 : 502, { error: "WHOOP login failed (" + r.status + ")." });
      return reply(200, { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in });
    }

    // WHOOP: read data (only the endpoints this app uses)
    if (path === "/whoop/get") {
      const p = String(body.path || "");
      if (!body.access_token || !WHOOP_PATHS.test(p)) return reply(400, { error: "Not an allowed WHOOP request." });
      const r = await fetch(WHOOP_API + p, { headers: { Authorization: "Bearer " + body.access_token } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return reply(r.status === 401 ? 401 : r.status === 429 ? 429 : 502, { error: "WHOOP returned " + r.status + "." });
      return reply(200, j);
    }

    // Read a cardio machine screen from a photo (needs ANTHROPIC_API_KEY)
    if (path === "/cardio/read") {
      if (!env.ANTHROPIC_API_KEY) return reply(501, { error: "Photo reading is not set up on this server." });
      const img = String(body.image || "");
      if (!img || img.length > 2000000 || !/^[A-Za-z0-9+/=]+$/.test(img)) return reply(400, { error: "Missing or oversized photo." });
      const ask = "This is a photo of a gym cardio machine's display (bike, BikeErg, air bike or rower). Read only what is clearly visible. " +
        "Reply with JSON only, no other text, using this shape: {\"machine\": \"BikeErg|Echo bike|Rower|Other|\", \"min\": number or null (total elapsed time in minutes, decimals allowed), " +
        "\"dist\": number or null (distance in km; convert metres to km), \"w\": number or null (average watts), \"hr\": number or null (average heart rate), " +
        "\"mhr\": number or null (max heart rate), \"cal\": number or null (calories), \"notes\": \"short note on anything unclear\"}. " +
        "Use null for anything you cannot read with confidence. Never guess.";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
          { type: "text", text: ask } ] }] }),
      });
      if (!r.ok) return reply(r.status === 429 ? 429 : 502, { error: "Anthropic API error " + r.status });
      const j = await r.json();
      const t = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const m = t.match(/\{[\s\S]*\}/);
      let out = {};
      try { out = m ? JSON.parse(m[0]) : {}; } catch (e) { return reply(502, { error: "Could not read the screen." }); }
      const n = (v) => (typeof v === "number" && isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : null);
      return reply(200, { machine: String(out.machine || "").slice(0, 20), min: n(out.min), dist: n(out.dist), w: n(out.w), hr: n(out.hr), mhr: n(out.mhr), cal: n(out.cal), notes: String(out.notes || "").slice(0, 200) });
    }

    // Instant Claude review (optional)
    if (path === "/" || path === "/review") {
      if (!env.ANTHROPIC_API_KEY) return reply(501, { error: "Instant reviews are not set up on this server." });
      const prompt = String(body.prompt || "");
      if (!prompt || prompt.length > 12000) return reply(400, { error: "Missing or oversized prompt." });
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
      });
      if (!r.ok) return reply(r.status === 429 ? 429 : 502, { error: "Anthropic API error " + r.status });
      const j = await r.json();
      return reply(200, { text: (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") });
    }

    return reply(404, { error: "Unknown route." });
  },
};
