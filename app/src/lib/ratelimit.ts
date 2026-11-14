import { NextResponse } from "next/server";

/**
 * Best-effort limit for the routes that cost money (AI calls): at most `max` calls per user per minute on one server
 * instance. It stops a runaway loop or a casual abuser; it is not a hard global limit.
 */
const hits = new Map<string, number[]>();

export function tooMany(userId: string, bucket: string, max = 20): NextResponse | null {
  const now = Date.now(), key = `${bucket}:${userId}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= max) return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return null;
}
