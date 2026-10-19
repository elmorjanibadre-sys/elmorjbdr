// Suivi des boutiques concurrentes : récupération du catalogue, détection des
// changements (nouveaux produits, prix, ruptures) et estimation des ventes.
const USER_AGENT = 'SoukRadar/0.1 (+veille concurrentielle)';
const SHOPIFY_PAGE_SIZE = 250;
const SHOPIFY_MAX_PAGES = 20;
const GENERIC_MAX_PAGES = 40;

function normalizeUrl(input) {
  const raw = String(input || '').trim();
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL invalide');
  // Empêche de faire scanner le réseau interne du serveur
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(url.hostname)) {
    throw new Error('Adresse interne refusée');
  }
  return url.origin;
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return null;
  return res.json();
}

async function getText(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.text();
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Boutiques Shopify : le catalogue public est exposé sur /products.json
function mapShopifyProduct(origin, p) {
  const variants = p.variants || [];
  const prices = variants.map((v) => toNumber(v.price)).filter((n) => n !== null);
  const quantities = variants.map((v) => v.inventory_quantity).filter(Number.isFinite);
  return {
    externalId: String(p.id),
    title: p.title,
    url: `${origin}/products/${p.handle}`,
    image: p.images?.[0]?.src || null,
    price: prices.length ? Math.min(...prices) : null,
    available: variants.some((v) => v.available !== false),
    // Rarement exposé ; quand il l'est, il permet d'estimer les ventes réelles
    inventory: quantities.length ? quantities.reduce((a, b) => a + b, 0) : null,
  };
}

async function fetchShopifyCatalog(origin, fetchImpl) {
  const first = await getJson(`${origin}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=1`, fetchImpl);
  if (!first || !Array.isArray(first.products)) return null;
  const products = [...first.products];
  let page = 1;
  let batch = first.products;
  while (batch.length === SHOPIFY_PAGE_SIZE && page < SHOPIFY_MAX_PAGES) {
    page += 1;
    const next = await getJson(`${origin}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`, fetchImpl);
    batch = next?.products || [];
    products.push(...batch);
  }
  return products.map((p) => mapShopifyProduct(origin, p));
}

// Autres plateformes (YouCan, WooCommerce, sites sur mesure) : données structurées
// schema.org/Product présentes dans les pages produits.
function extractJsonLdProducts(html, pageUrl) {
  const found = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    let data;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const stack = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node['@graph'])) stack.push(...node['@graph']);
      const type = [].concat(node['@type'] || []);
      if (!type.includes('Product')) continue;
      const offers = [].concat(node.offers || []).flatMap((o) => (o.offers ? [].concat(o.offers) : [o]));
      const prices = offers
        .map((o) => toNumber(o.price ?? o.lowPrice))
        .filter((n) => n !== null);
      const url = node.url || node.offers?.url || pageUrl;
      found.push({
        externalId: String(node.sku || node.productID || url),
        title: node.name,
        url,
        image: [].concat(node.image || [])[0]?.url || [].concat(node.image || [])[0] || null,
        price: prices.length ? Math.min(...prices) : null,
        available: offers.length ? offers.some((o) => !/OutOfStock|SoldOut/i.test(o.availability || '')) : true,
        inventory: null,
      });
    }
  }
  return found;
}

function extractProductLinks(html, origin) {
  const links = new Set();
  const re = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    let url;
    try {
      url = new URL(match[1], origin);
    } catch {
      continue;
    }
    if (url.origin === origin && /\/(products?|produits?|p)\/[^/]+/i.test(url.pathname)) {
      links.add(url.origin + url.pathname);
    }
  }
  return [...links];
}

async function fetchGenericCatalog(origin, fetchImpl) {
  const home = await getText(origin, fetchImpl);
  const byId = new Map();
  for (const p of extractJsonLdProducts(home, origin)) byId.set(p.externalId, p);
  for (const link of extractProductLinks(home, origin).slice(0, GENERIC_MAX_PAGES)) {
    try {
      const html = await getText(link, fetchImpl);
      for (const p of extractJsonLdProducts(html, link)) byId.set(p.externalId, p);
    } catch {
      // Une page produit inaccessible ne doit pas bloquer tout le scan
    }
  }
  return [...byId.values()];
}

async function fetchCatalog(origin, fetchImpl = fetch) {
  const shopify = await fetchShopifyCatalog(origin, fetchImpl).catch(() => null);
  if (shopify) return { platform: 'shopify', products: shopify };
  return { platform: 'generic', products: await fetchGenericCatalog(origin, fetchImpl) };
}

// Compare l'état connu d'un produit avec le nouvel état et liste les événements.
function diffProduct(previous, current) {
  if (!previous) return [{ type: 'new_product', newValue: current.price }];
  const events = [];
  if (previous.removed_at) events.push({ type: 'relisted' });
  if (previous.price !== null && current.price !== null && previous.price !== current.price) {
    events.push({ type: 'price_change', oldValue: previous.price, newValue: current.price });
  }
  if (previous.available && !current.available) events.push({ type: 'out_of_stock' });
  if (!previous.available && current.available) events.push({ type: 'back_in_stock' });
  if (previous.inventory !== null && current.inventory !== null && current.inventory < previous.inventory) {
    const units = previous.inventory - current.inventory;
    events.push({
      type: 'sale_estimate',
      oldValue: previous.inventory,
      newValue: current.inventory,
      amount: units * (current.price ?? previous.price ?? 0),
    });
  }
  return events;
}

async function scanStore(db, store, fetchImpl = fetch) {
  const now = Date.now();
  try {
    const { platform, products } = await fetchCatalog(store.url, fetchImpl);
    const existing = new Map(
      db.prepare('SELECT * FROM products WHERE store_id = ?').all(store.id).map((p) => [p.external_id, p]),
    );
    const insertEvent = db.prepare(
      'INSERT INTO events (store_id, product_id, type, old_value, new_value, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const isFirstScan = !store.last_scan_at;
    let changes = 0;

    db.exec('BEGIN');
    for (const item of products) {
      const previous = existing.get(item.externalId);
      existing.delete(item.externalId);
      let productId;
      if (previous) {
        productId = previous.id;
        db.prepare(
          `UPDATE products SET title = ?, url = ?, image = ?, price = ?, available = ?, inventory = ?,
           last_seen_at = ?, removed_at = NULL WHERE id = ?`,
        ).run(item.title, item.url, item.image, item.price, item.available ? 1 : 0, item.inventory, now, productId);
      } else {
        productId = Number(
          db
            .prepare(
              `INSERT INTO products (store_id, external_id, title, url, image, price, available, inventory, first_seen_at, last_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(store.id, item.externalId, item.title, item.url, item.image, item.price, item.available ? 1 : 0, item.inventory, now, now)
            .lastInsertRowid,
        );
      }
      // Au premier scan, tout le catalogue est « nouveau » : on ne crée pas d'événements
      if (isFirstScan) continue;
      for (const e of diffProduct(previous, item)) {
        insertEvent.run(store.id, productId, e.type, e.oldValue ?? null, e.newValue ?? null, e.amount ?? null, now);
        changes += 1;
      }
    }
    for (const gone of existing.values()) {
      if (gone.removed_at) continue;
      db.prepare('UPDATE products SET removed_at = ? WHERE id = ?').run(now, gone.id);
      insertEvent.run(store.id, gone.id, 'removed', null, null, null, now);
      changes += 1;
    }
    db.prepare('UPDATE stores SET platform = ?, last_scan_at = ?, last_error = NULL WHERE id = ?').run(platform, now, store.id);
    db.exec('COMMIT');
    return { ok: true, platform, products: products.length, changes };
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.prepare('UPDATE stores SET last_scan_at = ?, last_error = ? WHERE id = ?').run(now, String(err.message || err), store.id);
    return { ok: false, error: String(err.message || err) };
  }
}

function storeStats(db, storeId, days = 30) {
  const since = Date.now() - days * 24 * 3600 * 1000;
  const counts = Object.fromEntries(
    db
      .prepare('SELECT type, COUNT(*) AS n FROM events WHERE store_id = ? AND created_at >= ? GROUP BY type')
      .all(storeId, since)
      .map((r) => [r.type, r.n]),
  );
  const revenue = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM events WHERE store_id = ? AND type = 'sale_estimate' AND created_at >= ?`)
    .get(storeId, since).total;
  const catalog = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(available) AS available, AVG(price) AS avg_price,
              SUM(CASE WHEN inventory IS NOT NULL THEN 1 ELSE 0 END) AS with_inventory
       FROM products WHERE store_id = ? AND removed_at IS NULL`,
    )
    .get(storeId);
  return { days, counts, estimatedRevenue: revenue, catalog };
}

module.exports = {
  normalizeUrl,
  fetchCatalog,
  extractJsonLdProducts,
  extractProductLinks,
  diffProduct,
  scanStore,
  storeStats,
};
