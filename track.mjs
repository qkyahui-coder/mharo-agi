import { getStore } from "@netlify/blobs";

const STORE_NAME = "mharo-agi-activity";
const MAX_BODY_BYTES = 24_000;
const MAX_META_KEYS = 20;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function cleanMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, MAX_META_KEYS);
  const out = {};
  for (const [key, val] of entries) {
    const safeKey = String(key).slice(0, 60);
    if (typeof val === "string") out[safeKey] = val.slice(0, 300);
    else if (typeof val === "number" || typeof val === "boolean" || val === null) out[safeKey] = val;
  }
  return out;
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

    const body = await request.json();
    const event = String(body?.event || "").slice(0, 80);
    const sessionId = String(body?.session_id || "").slice(0, 120);

    if (!event || !sessionId) return json({ error: "event and session_id are required" }, 400);

    const allowedEvents = new Set([
      "app_opened",
      "reading_started",
      "touch_me",
      "conversation_scrolled",
      "page_visible_again"
    ]);
    if (!allowedEvents.has(event)) return json({ error: "Unsupported event" }, 400);

    const row = {
      created_at: new Date().toISOString(),
      event,
      session_id: sessionId,
      path: String(body?.path || "/").slice(0, 300),
      referrer: String(body?.referrer || "").slice(0, 500),
      user_agent: String(request.headers.get("user-agent") || "").slice(0, 500),
      meta: cleanMeta(body?.meta)
    };

    const store = getStore(STORE_NAME);
    const key = `events/${Date.now()}-${crypto.randomUUID()}`;
    await store.setJSON(key, row);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Tracking error:", error);
    return json({ error: "Tracking request failed" }, 500);
  }
};
