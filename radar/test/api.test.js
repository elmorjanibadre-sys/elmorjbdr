const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { openDb } = require('../src/db');
const { createApp } = require('../src/server');

const DAY = 24 * 3600 * 1000;

test('API : import de pubs, gagnants, tendances et fournisseurs', async (t) => {
  const db = openDb(':memory:');
  const server = http.createServer(createApp({ db }));
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, body: body && JSON.stringify(body) });
    return res.json();
  };

  const now = Date.now();
  await call('POST', '/api/ads/import', {
    ads: [
      { id: 'a1', page_name: 'Beauté Casa', text: 'Wach 3ndk mochkil dyal cha3r? Serum 199 DH', started_at: now - 20 * DAY },
      { id: 'a2', page_name: 'Déco Rabat', text: 'Lampe LED -40% livraison gratuite', started_at: now - 2 * DAY },
      { id: 'a3', page_name: 'Déco Fès', text: 'Lampe LED moderne, stock limité', started_at: now - 1 * DAY },
    ],
  });

  const winners = await call('GET', '/api/ads?winners=1');
  assert.deepStrictEqual(winners.map((a) => a.external_id), ['a1']);
  assert.strictEqual(winners[0].language, 'darija_latin');

  const trends = await call('GET', '/api/trends');
  assert.ok(trends.keywords.some((k) => k.word === 'lampe' && k.count === 2));

  await call('POST', '/api/suppliers', { name: 'Grossiste Derb Omar', city: 'Casablanca', category: 'Maison' });
  const suppliers = await call('GET', '/api/suppliers?q=casa');
  assert.strictEqual(suppliers.length, 1);

  const dash = await call('GET', '/api/dashboard');
  assert.deepStrictEqual([dash.ads, dash.winners, dash.suppliers], [3, 1, 1]);
});
