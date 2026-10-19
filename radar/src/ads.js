// Bibliothèque de publicités : import, synchronisation Meta et analyse des hooks.
const { analyzeHook } = require('./hooks');

const DAY = 24 * 3600 * 1000;
const META_API = 'https://graph.facebook.com/v21.0/ads_archive';

function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function upsertAd(db, ad, source = 'manual', now = Date.now()) {
  const externalId = String(ad.id || ad.external_id || ad.url || ad.landing_url || `${ad.page_name}:${ad.text}`).slice(0, 500);
  // Le hook vidéo se lit dans la transcription des premières secondes quand elle existe
  const analysis = analyzeHook(ad.transcript || ad.text);
  const startedAt = toTimestamp(ad.started_at) ?? now;
  const active = ad.active === undefined ? 1 : ad.active ? 1 : 0;
  db.prepare(
    `INSERT INTO ads (source, external_id, page_name, platform, text, transcript, video_url, landing_url,
                      started_at, last_seen_at, active, hook, hook_types, hook_score, language, price_mad, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (source, external_id) DO UPDATE SET
       page_name = excluded.page_name, platform = excluded.platform, text = excluded.text,
       transcript = excluded.transcript, video_url = excluded.video_url, landing_url = excluded.landing_url,
       started_at = MIN(ads.started_at, excluded.started_at), last_seen_at = excluded.last_seen_at,
       active = excluded.active, hook = excluded.hook, hook_types = excluded.hook_types,
       hook_score = excluded.hook_score, language = excluded.language, price_mad = excluded.price_mad`,
  ).run(
    source,
    externalId,
    ad.page_name || null,
    ad.platform || null,
    ad.text || '',
    ad.transcript || null,
    ad.video_url || null,
    ad.landing_url || null,
    startedAt,
    toTimestamp(ad.last_seen_at) ?? now,
    active,
    analysis.hook,
    analysis.types.join(','),
    analysis.score,
    analysis.language,
    analysis.priceMad,
    now,
  );
}

function importAds(db, list, source = 'manual') {
  if (!Array.isArray(list)) throw new Error('Format attendu : un tableau JSON de publicités');
  const now = Date.now();
  db.exec('BEGIN');
  try {
    for (const ad of list) upsertAd(db, ad, source, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return list.length;
}

// Une pub qui tourne depuis longtemps est rentable : c'est le meilleur signal de « winner »
function withMetrics(row, now = Date.now()) {
  const end = row.active ? now : row.last_seen_at;
  const daysRunning = Math.max(1, Math.round((end - row.started_at) / DAY));
  return {
    ...row,
    hook_types: row.hook_types ? row.hook_types.split(',') : [],
    days_running: daysRunning,
    winner: Boolean(row.active && daysRunning >= 7),
  };
}

function listAds(db, { q, hookType, language, winnersOnly, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(text LIKE ? OR page_name LIKE ? OR transcript LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (hookType) {
    where.push("(',' || hook_types || ',') LIKE ?");
    params.push(`%,${hookType},%`);
  }
  if (language) {
    where.push('language = ?');
    params.push(language);
  }
  const sql = `SELECT * FROM ads ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY active DESC, started_at ASC LIMIT ?`;
  const rows = db.prepare(sql).all(...params, Math.min(Number(limit) || 100, 500)).map((r) => withMetrics(r));
  return winnersOnly ? rows.filter((r) => r.winner) : rows;
}

// Bibliothèque publicitaire Meta. Attention : hors Union européenne, l'API ne renvoie
// que les publicités politiques / à caractère social. Pour le Maroc, les pubs
// e-commerce doivent être importées autrement (voir README).
async function fetchMetaAds({ token, searchTerms, country = 'MA', limit = 100 }, fetchImpl = fetch) {
  if (!token) throw new Error('META_ACCESS_TOKEN manquant');
  const params = new URLSearchParams({
    access_token: token,
    search_terms: searchTerms || '',
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: 'ALL',
    ad_type: 'ALL',
    limit: String(limit),
    fields: 'id,page_name,ad_creative_bodies,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,publisher_platforms',
  });
  const res = await fetchImpl(`${META_API}?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `Erreur Meta HTTP ${res.status}`);
  return (body.data || []).map((a) => ({
    id: a.id,
    page_name: a.page_name,
    platform: (a.publisher_platforms || []).join(','),
    text: (a.ad_creative_bodies || []).join('\n'),
    landing_url: a.ad_snapshot_url,
    started_at: a.ad_delivery_start_time,
    active: !a.ad_delivery_stop_time,
    last_seen_at: a.ad_delivery_stop_time || undefined,
  }));
}

module.exports = { importAds, listAds, fetchMetaAds, upsertAd, withMetrics };
