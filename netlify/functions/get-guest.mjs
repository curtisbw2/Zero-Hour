// GET /.netlify/functions/get-guest?token=abc123
// Returns the stored guest data for a token, enforcing the 7-day TTL.

import { getStore } from "@netlify/blobs";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{32}$/.test(token);
}

export async function loadGuest(token) {
  if (!validToken(token)) return { error: "bad_token", status: 400 };

  const store = getStore({ name: "guest-intake", consistency: "strong" });
  const record = await store.get(token, { type: "json" });
  if (!record) return { error: "not_found", status: 404 };

  if (Date.now() - record.createdAt > TTL_MS) {
    await store.delete(token);
    return { error: "expired", status: 410 };
  }

  return { record };
}

export default async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  const { record, error, status } = await loadGuest(token);

  if (error) {
    return Response.json({ error }, { status });
  }
  return Response.json(record);
};
