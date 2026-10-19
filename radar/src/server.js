// API HTTP et interface web de Souk Radar (aucune dépendance externe).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openDb } = require('./db');
const { normalizeUrl, scanStore, storeStats } = require('./stores');
const { importAds, listAds, fetchMetaAds } = require('./ads');
const { analyzeHook } = require('./hooks');
const { computeTrends } = require('./trends');

const PORT = Number(process.env.PORT) || 4000;
const SCAN_INTERVAL_MIN = Number(process.env.SCAN_INTERVAL_MIN) || 60;
const MAX_BODY = 5 * 1024 * 1024;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Requête trop volumineuse'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('Introuvable');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function createApp({ db, fetchImpl = fetch } = {}) {
  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, pattern, handler });
  const getStore = (id) => {
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    if (!store) throw new HttpError(404, 'Boutique introuvable');
    return store;
  };

  route('GET', /^\/api\/dashboard$/, () => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    const ads = listAds(db, { limit: 500 });
    return {
      stores: db.prepare('SELECT COUNT(*) AS n FROM stores').get().n,
      products: db.prepare('SELECT COUNT(*) AS n FROM products WHERE removed_at IS NULL').get().n,
      ads: ads.length,
      winners: ads.filter((a) => a.winner).length,
      suppliers: db.prepare('SELECT COUNT(*) AS n FROM suppliers').get().n,
      newProducts7d: db.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'new_product' AND created_at >= ?`).get(since).n,
      estimatedRevenue7d: db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM events WHERE type = 'sale_estimate' AND created_at >= ?`).get(since).n,
      topWinners: ads.filter((a) => a.winner).sort((a, b) => b.days_running - a.days_running).slice(0, 5),
    };
  });

  // --- Boutiques concurrentes ---
  route('GET', /^\/api\/stores$/, () =>
    db.prepare('SELECT * FROM stores ORDER BY created_at DESC').all().map((s) => ({ ...s, stats: storeStats(db, s.id, 30) })),
  );
  route('POST', /^\/api\/stores$/, async ({ body }) => {
    let url;
    try {
      url = normalizeUrl(body.url);
    } catch {
      throw new HttpError(400, 'URL de boutique invalide');
    }
    if (db.prepare('SELECT id FROM stores WHERE url = ?').get(url)) throw new HttpError(409, 'Boutique déjà suivie');
    const id = Number(
      db.prepare('INSERT INTO stores (url, name, created_at) VALUES (?, ?, ?)').run(url, body.name || new URL(url).hostname, Date.now()).lastInsertRowid,
    );
    const scan = await scanStore(db, getStore(id), fetchImpl);
    return { store: getStore(id), scan };
  });
  route('GET', /^\/api\/stores\/(\d+)$/, ({ params }) => {
    const store = getStore(params[0]);
    return {
      store,
      stats: storeStats(db, store.id, 30),
      products: db.prepare('SELECT * FROM products WHERE store_id = ? ORDER BY removed_at IS NOT NULL, first_seen_at DESC').all(store.id),
      events: db
        .prepare(
          `SELECT e.*, p.title, p.url FROM events e LEFT JOIN products p ON p.id = e.product_id
           WHERE e.store_id = ? ORDER BY e.created_at DESC LIMIT 200`,
        )
        .all(store.id),
    };
  });
  route('POST', /^\/api\/stores\/(\d+)\/scan$/, ({ params }) => scanStore(db, getStore(params[0]), fetchImpl));
  route('DELETE', /^\/api\/stores\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM stores WHERE id = ?').run(getStore(params[0]).id);
    return { ok: true };
  });
  route('GET', /^\/api\/events$/, () =>
    db
      .prepare(
        `SELECT e.*, p.title, p.url, s.name AS store_name FROM events e
         LEFT JOIN products p ON p.id = e.product_id JOIN stores s ON s.id = e.store_id
         ORDER BY e.created_at DESC LIMIT 100`,
      )
      .all(),
  );

  // --- Publicités et hooks ---
  route('GET', /^\/api\/ads$/, ({ query }) =>
    listAds(db, {
      q: query.get('q'),
      hookType: query.get('hookType'),
      language: query.get('language'),
      winnersOnly: query.get('winners') === '1',
    }),
  );
  route('POST', /^\/api\/ads$/, ({ body }) => {
    if (!body.text && !body.transcript) throw new HttpError(400, 'Texte ou transcription requis');
    importAds(db, [body], 'manual');
    return { ok: true };
  });
  route('POST', /^\/api\/ads\/import$/, ({ body }) => ({ imported: importAds(db, body.ads, body.source || 'import') }));
  route('POST', /^\/api\/ads\/meta-sync$/, async ({ body }) => {
    const ads = await fetchMetaAds({ token: process.env.META_ACCESS_TOKEN, searchTerms: body.searchTerms }, fetchImpl);
    return { imported: importAds(db, ads, 'meta') };
  });
  route('DELETE', /^\/api\/ads\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM ads WHERE id = ?').run(params[0]);
    return { ok: true };
  });
  route('POST', /^\/api\/hooks\/analyze$/, ({ body }) => analyzeHook(body.text));
  route('GET', /^\/api\/trends$/, ({ query }) => computeTrends(db, { days: Number(query.get('days')) || 7 }));

  // --- Fournisseurs ---
  route('GET', /^\/api\/suppliers$/, ({ query }) => {
    const q = `%${query.get('q') || ''}%`;
    return db
      .prepare('SELECT * FROM suppliers WHERE name LIKE ? OR category LIKE ? OR city LIKE ? OR notes LIKE ? ORDER BY name')
      .all(q, q, q, q);
  });
  route('POST', /^\/api\/suppliers$/, ({ body }) => {
    if (!body.name) throw new HttpError(400, 'Nom du fournisseur requis');
    const fields = ['type', 'city', 'category', 'contact', 'url', 'moq', 'notes'].map((k) => body[k] || null);
    const id = db
      .prepare('INSERT INTO suppliers (name, type, city, category, contact, url, moq, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(body.name, ...fields, Date.now()).lastInsertRowid;
    return { id: Number(id) };
  });
  route('DELETE', /^\/api\/suppliers\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(params[0]);
    return { ok: true };
  });

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!match) return send(res, 404, { error: 'Route inconnue' });
    try {
      const body = ['POST', 'PUT'].includes(req.method) ? await readJson(req) : {};
      const params = url.pathname.match(match.pattern).slice(1);
      send(res, 200, await match.handler({ body, params, query: url.searchParams }));
    } catch (err) {
      send(res, err.status || 500, { error: err.message || 'Erreur serveur' });
    }
  };
}

// Rescanne régulièrement toutes les boutiques suivies, l'une après l'autre
function startScheduler(db, fetchImpl = fetch) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const store of db.prepare('SELECT * FROM stores').all()) await scanStore(db, store, fetchImpl);
    } finally {
      running = false;
    }
  };
  return setInterval(tick, SCAN_INTERVAL_MIN * 60 * 1000);
}

if (require.main === module) {
  const db = openDb();
  http.createServer(createApp({ db })).listen(PORT, () => {
    console.log(`Souk Radar : http://localhost:${PORT} (scan des boutiques toutes les ${SCAN_INTERVAL_MIN} min)`);
  });
  startScheduler(db);
}

module.exports = { createApp, startScheduler };
