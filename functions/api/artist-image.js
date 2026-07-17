// Cloudflare Pages Function → GET /api/artist-image?name=ARTIST
// Returns { img: "<spotify artist image url>" | "" } — looked up server-side with an app
// (client-credentials) token and cached in KV, so browsers never hit Spotify's /search rate limit.
// Requires:  SPOTIFY_SECRET env var  +  the SETTINGS KV binding (already used by /api/goal).

const CLIENT_ID_DEFAULT = '70094dedf6454b8c82c45ee46ebfc392';

async function getAppToken(env){
  const kv = env.SETTINGS;
  if(kv){ const cached = await kv.get('sp_cc'); if(cached){ try{ const o=JSON.parse(cached); if(o.exp > Date.now()+60000) return o.token; }catch(e){} } }
  const id = env.SPOTIFY_ID || CLIENT_ID_DEFAULT;
  const secret = env.SPOTIFY_SECRET;
  if(!secret) return null;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST',
    headers:{ 'content-type':'application/x-www-form-urlencoded', 'Authorization':'Basic '+btoa(id+':'+secret) },
    body:'grant_type=client_credentials'
  });
  if(!r.ok) return null;
  const j = await r.json();
  if(kv && j.access_token){ await kv.put('sp_cc', JSON.stringify({ token:j.access_token, exp: Date.now()+((j.expires_in||3600)*1000) })); }
  return j.access_token || null;
}

export async function onRequestGet(context){
  const env = context.env, kv = env.SETTINGS;
  const H = { 'content-type':'application/json', 'cache-control':'public, max-age=86400' };
  const HN = { 'content-type':'application/json' };
  const name = new URL(context.request.url).searchParams.get('name');
  if(!name) return new Response(JSON.stringify({ img:'' }), { headers:H });

  const cacheKey = 'artimg:' + name.toLowerCase();
  if(kv){ const c = await kv.get(cacheKey); if(c) return new Response(JSON.stringify({ img:c, cached:true }), { headers:H }); } // trust only non-empty cache (self-heals bad empties)

  // Circuit breaker: after a 429, stop hitting Spotify until the cooldown passes so the app-level limit can reset.
  if(kv){ const cd = await kv.get('sp_cooldown'); if(cd && Date.now() < parseInt(cd,10))
    return new Response(JSON.stringify({ img:'', cooling:true, until: parseInt(cd,10) }), { headers:HN }); }

  const token = await getAppToken(env);
  if(!token) return new Response(JSON.stringify({ error:'server not configured (SPOTIFY_SECRET)' }), { status:500, headers:HN });

  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
  let img = '', status = 0, n = 0, matched = '';
  try{
    const sr = await fetch('https://api.spotify.com/v1/search?type=artist&limit=10&market=US&q=' + encodeURIComponent(name), { headers:{ Authorization:'Bearer '+token } });
    status = sr.status;
    if(status === 429){
      const ra = parseInt(sr.headers.get('Retry-After')||'0',10);
      const until = Date.now() + ((ra>0 ? ra : 600) * 1000); // honor Retry-After, else back off 10 min
      if(kv) await kv.put('sp_cooldown', String(until));
      return new Response(JSON.stringify({ img:'', status:429, retryAfter:ra, cooling:true, until }), { headers:HN });
    }
    if(sr.ok){ const sj = await sr.json(); const items = (sj.artists && sj.artists.items) || []; n = items.length;
      const a = items.find(x => norm(x.name) === norm(name)) || items[0]; // exact match, else the top result
      if(a){ img = ((a.images||[])[0]||{}).url || ''; matched = a.name; } }
  }catch(e){ status = -1; }
  if(kv && img) await kv.put(cacheKey, img); // only cache real (non-empty) images
  return new Response(JSON.stringify({ img, status, n, matched }), { headers: img ? H : HN });
}
