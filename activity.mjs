import { getStore } from "@netlify/blobs";

const STORE_NAME = "mharo-agi-activity";
const MAX_EVENTS = 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const dashboardToken = process.env.DASHBOARD_TOKEN || "";
  const supplied = request.headers.get("x-dashboard-token") || "";
  if (!dashboardToken || supplied !== dashboardToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const store = getStore(STORE_NAME);
    const { blobs } = await store.list({ prefix: "events/" });

    const selected = blobs.slice(-MAX_EVENTS);
    const rows = [];

    for (const blob of selected) {
      const entry = await store.get(blob.key, { type: "json" });
      if (entry) rows.push(entry);
    }

    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return json({ rows: rows.slice(0, MAX_EVENTS) });
  } catch (error) {
    console.error("Activity error:", error);
    return json({ error: "Could not read activity" }, 500);
  }
};
