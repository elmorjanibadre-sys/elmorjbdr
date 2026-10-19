const test = require('node:test');
const assert = require('node:assert');
const { analyzeHook, detectLanguage, extractPriceMad } = require('../src/hooks');

test('détecte la darija en lettres arabes', () => {
  assert.strictEqual(detectLanguage('واش عندك مشكل ديال الشعر؟ هاد المنتوج غادي يحلها'), 'darija');
});

test('détecte la darija en lettres latines', () => {
  assert.strictEqual(detectLanguage('Wach 3ndk mochkil dyal cha3r? Had produit mzyan bzaf'), 'darija_latin');
});

test('détecte le français', () => {
  assert.strictEqual(detectLanguage('Livraison gratuite partout au Maroc, commandez maintenant'), 'francais');
});

test('extrait le prix en dirhams', () => {
  assert.strictEqual(extractPriceMad('Seulement 199 DH aujourd’hui'), 199);
  assert.strictEqual(extractPriceMad('الثمن 249 درهم فقط'), 249);
  assert.strictEqual(extractPriceMad('sans prix'), null);
});

test('classe les types de hook', () => {
  const r = analyzeHook('Marre des cheveux secs ? 🔥 -50% aujourd’hui seulement, 149 DH, paiement à la livraison');
  assert.strictEqual(r.hook, 'Marre des cheveux secs ?');
  for (const t of ['question', 'offre_prix', 'livraison_cod', 'urgence', 'probleme_solution']) {
    assert.ok(r.types.includes(t), `type manquant : ${t}`);
  }
  assert.strictEqual(r.priceMad, 149);
  assert.ok(r.score >= 70);
});

test('reconnaît le paiement à la livraison en arabe', () => {
  assert.ok(analyzeHook('التوصيل مجاني و الدفع عند الاستلام').types.includes('livraison_cod'));
});
