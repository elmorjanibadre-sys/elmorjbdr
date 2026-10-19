const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { normalizeUrl, extractJsonLdProducts, diffProduct, scanStore, storeStats } = require('../src/stores');

function fakeShopify(catalogs) {
  let call = 0;
  return async (url) => {
    if (!url.includes('/products.json')) return new Response('', { status: 404 });
    const page = Number(new URL(url).searchParams.get('page'));
    const products = page === 1 ? catalogs[Math.min(call++, catalogs.length - 1)] : [];
    return new Response(JSON.stringify({ products }), { headers: { 'content-type': 'application/json' } });
  };
}

const product = (id, price, qty, available = true) => ({
  id,
  title: `Produit ${id}`,
  handle: `p-${id}`,
  images: [],
  variants: [{ price: String(price), available, inventory_quantity: qty }],
});

test('normalise les URL de boutique', () => {
  assert.strictEqual(normalizeUrl('maboutique.ma/collections/all'), 'https://maboutique.ma');
});

test('lit les produits schema.org (YouCan, WooCommerce…)', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Sac","sku":"S1",
    "offers":{"@type":"Offer","price":"299.00","availability":"https://schema.org/OutOfStock"}}</script>`;
  const [p] = extractJsonLdProducts(html, 'https://x.ma/products/sac');
  assert.deepStrictEqual([p.externalId, p.title, p.price, p.available], ['S1', 'Sac', 299, false]);
});

test('détecte prix, rupture et ventes', () => {
  const prev = { price: 200, available: 1, inventory: 50, removed_at: null };
  const types = diffProduct(prev, { price: 180, available: false, inventory: 45 }).map((e) => e.type);
  assert.deepStrictEqual(types, ['price_change', 'out_of_stock', 'sale_estimate']);
});

test('scan complet : premier scan silencieux puis événements', async () => {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO stores (id, url, name, created_at) VALUES (1, 'https://shop.ma', 'shop', 0)").run();
  const fetchImpl = fakeShopify([
    [product(1, 100, 20), product(2, 50, 5)],
    [product(1, 90, 17), product(3, 70, 10)],
  ]);
  const store = () => db.prepare('SELECT * FROM stores WHERE id = 1').get();

  const first = await scanStore(db, store(), fetchImpl);
  assert.deepStrictEqual([first.ok, first.platform, first.products, first.changes], [true, 'shopify', 2, 0]);

  const second = await scanStore(db, store(), fetchImpl);
  assert.ok(second.ok);
  const stats = storeStats(db, 1);
  assert.deepStrictEqual(stats.counts, { new_product: 1, price_change: 1, removed: 1, sale_estimate: 1 });
  assert.strictEqual(stats.estimatedRevenue, 3 * 90);
});
