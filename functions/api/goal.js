// Cloudflare Pages Function → /api/goal
//   GET  /api/goal?uid=SPOTIFY_ID   → { goal: number|null }
//   POST /api/goal  { uid, goal }    → { ok: true }
// Stores each user's daily goal in a KV namespace so it syncs across devices.
// Bind a KV namespace to this Pages project as the variable name  SETTINGS.

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

export async function onRequestGet(context) {
  const kv = context.env && context.env.SETTINGS;
  const uid = new URL(context.request.url).searchParams.get('uid');
  if (!kv) return new Response(JSON.stringify({ error: 'KV not bound (SETTINGS)' }), { status: 500, headers: JSON_HEADERS });
  if (!uid) return new Response(JSON.stringify({ goal: null }), { headers: JSON_HEADERS });
  const v = await kv.get('goal:' + uid);
  return new Response(JSON.stringify({ goal: v ? parseInt(v, 10) : null }), { headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const kv = context.env && context.env.SETTINGS;
  if (!kv) return new Response(JSON.stringify({ error: 'KV not bound (SETTINGS)' }), { status: 500, headers: JSON_HEADERS });
  let body = {};
  try { body = await context.request.json(); } catch (e) {}
  const uid = body.uid;
  const goal = parseInt(body.goal, 10);
  if (!uid || !(goal > 0)) return new Response(JSON.stringify({ error: 'bad input' }), { status: 400, headers: JSON_HEADERS });
  await kv.put('goal:' + uid, String(goal));
  return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
}
