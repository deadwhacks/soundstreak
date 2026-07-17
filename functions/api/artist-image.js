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
  const name = new URL(context.request.url).searchParams.get('name');
  if(!name) return new Response(JSON.stringify({ img:'' }), { headers:H });

  const cacheKey = 'artimg:' + name.toLowerCase();
  if(kv){ const c = await kv.get(cacheKey); if(c !== null && c !== undefined) return new Response(JSON.stringify({ img:c }), { headers:H }); }

  const token = await getAppToken(env);
  if(!token) return new Response(JSON.stringify({ error:'server not configured (SPOTIFY_SECRET)' }), { status:500, headers:{ 'content-type':'application/json' } });

  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
  let img = '', ok = false;
  try{
    const sr = await fetch('https://api.spotify.com/v1/search?type=artist&limit=8&q=' + encodeURIComponent(name), { headers:{ Authorization:'Bearer '+token } });
    if(sr.ok){ ok = true; const sj = await sr.json(); const items = (sj.artists && sj.artists.items) || [];
      const a = items.find(x => norm(x.name) === norm(name)); // exact match only
      if(a) img = ((a.images||[])[0]||{}).url || ''; }
  }catch(e){}
  if(kv && ok) await kv.put(cacheKey, img); // cache result (incl. confirmed "no match"); skip caching on failure
  return new Response(JSON.stringify({ img }), { headers: ok ? H : { 'content-type':'application/json' } });
}
