// Interface Souk Radar (JavaScript sans framework)
const $ = (sel) => document.querySelector(sel);

const HOOK_LABELS = {
  question: 'Question',
  offre_prix: 'Offre / prix',
  livraison_cod: 'Livraison / COD',
  urgence: 'Urgence',
  preuve_sociale: 'Preuve sociale',
  probleme_solution: 'Problème → solution',
  curiosite: 'Curiosité',
  demonstration: 'Démonstration',
};
const LANG_LABELS = {
  darija: 'Darija',
  darija_latin: 'Darija (latin)',
  francais: 'Français',
  arabe: 'Arabe',
  anglais: 'Anglais',
  mixte: 'Mixte',
  inconnu: '?',
};
const EVENT_LABELS = {
  new_product: '🆕 Nouveau produit',
  price_change: '💸 Changement de prix',
  out_of_stock: '⛔ Rupture de stock',
  back_in_stock: '✅ De retour en stock',
  removed: '🗑️ Produit retiré',
  relisted: '↩️ Produit remis en ligne',
  sale_estimate: '🛒 Ventes estimées',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const mad = (n) => (n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('fr-MA')} DH`);
const date = (t) => (t ? new Date(t).toLocaleString('fr-MA', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.display = 'none'), 3500);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

function scoreClass(score) {
  return score >= 70 ? 'high' : score >= 50 ? 'mid' : 'low';
}

function hookTags(types) {
  return types.map((t) => `<span class="tag">${esc(HOOK_LABELS[t] || t)}</span>`).join('');
}

// --- Onglets ---
const loaders = {};
document.querySelectorAll('#tabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${btn.dataset.tab}`));
    loaders[btn.dataset.tab]?.();
  }),
);

// --- Tableau de bord ---
function renderEvents(events) {
  if (!events.length) return '<p class="muted">Aucun changement détecté pour l\'instant. Ajoute des boutiques à suivre.</p>';
  return events
    .map(
      (e) => `<div class="event">
        <div><strong>${esc(EVENT_LABELS[e.type] || e.type)}</strong>
          ${e.store_name ? `<span class="muted">· ${esc(e.store_name)}</span>` : ''}<br />
          ${e.title ? `<span>${esc(e.title)}</span>` : ''}
          ${e.type === 'price_change' ? `<span class="muted"> ${mad(e.old_value)} → ${mad(e.new_value)}</span>` : ''}
          ${e.type === 'sale_estimate' ? `<span class="muted"> ${e.old_value - e.new_value} unités ≈ ${mad(e.amount)}</span>` : ''}
        </div>
        <span class="when">${date(e.created_at)}</span>
      </div>`,
    )
    .join('');
}

loaders.dashboard = async () => {
  const [d, events] = await Promise.all([api('GET', '/api/dashboard'), api('GET', '/api/events')]);
  const kpis = [
    ['Boutiques suivies', d.stores],
    ['Produits surveillés', d.products],
    ['Nouveaux produits (7 j)', d.newProducts7d],
    ['CA estimé concurrents (7 j)', mad(d.estimatedRevenue7d)],
    ['Publicités', d.ads],
    ['Pubs gagnantes', d.winners],
    ['Fournisseurs', d.suppliers],
  ];
  $('#kpis').innerHTML = kpis
    .map(([label, value]) => `<div class="kpi"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`)
    .join('');
  $('#dash-winners').innerHTML = d.topWinners.length
    ? d.topWinners
        .map(
          (a) => `<div class="event"><div><strong>${esc(a.page_name || 'Annonceur')}</strong><br />${esc(a.hook)}</div>
            <span class="when">${a.days_running} jours</span></div>`,
        )
        .join('')
    : '<p class="muted">Aucune pub gagnante pour l\'instant.</p>';
  $('#dash-events').innerHTML = renderEvents(events.slice(0, 10));
};

// --- Publicités ---
Object.entries(HOOK_LABELS).forEach(([value, label]) => $('#ads-hook').insertAdjacentHTML('beforeend', `<option value="${value}">${esc(label)}</option>`));

loaders.ads = async () => {
  const params = new URLSearchParams();
  if ($('#ads-q').value) params.set('q', $('#ads-q').value);
  if ($('#ads-hook').value) params.set('hookType', $('#ads-hook').value);
  if ($('#ads-lang').value) params.set('language', $('#ads-lang').value);
  if ($('#ads-winners').checked) params.set('winners', '1');
  const ads = await api('GET', `/api/ads?${params}`);
  $('#ads-list').innerHTML = ads.length
    ? ads
        .map((a) => {
          const link = safeUrl(a.landing_url);
          const video = safeUrl(a.video_url);
          return `<article class="ad">
            <div class="head"><span>${esc(a.page_name || 'Annonceur')}</span>
              <span class="score ${scoreClass(a.hook_score)}" title="Score du hook">${a.hook_score}/100</span></div>
            <div class="tags">
              ${a.winner ? '<span class="tag win">🏆 Gagnante</span>' : ''}
              <span class="tag lang">${esc(LANG_LABELS[a.language] || a.language)}</span>
              ${a.platform ? `<span class="tag">${esc(a.platform)}</span>` : ''}
              ${a.price_mad ? `<span class="tag">${mad(a.price_mad)}</span>` : ''}
            </div>
            <div class="hook">${esc(a.hook || '—')}</div>
            <div class="tags">${hookTags(a.hook_types)}</div>
            <div class="text">${esc(a.text)}</div>
            <div class="foot">
              <span>${a.active ? '🟢 Active' : '⚪ Arrêtée'} · ${a.days_running} j</span>
              <span>${video ? `<a href="${esc(video)}" target="_blank" rel="noopener">Vidéo</a> · ` : ''}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Boutique</a> · ` : ''}<button class="ghost" data-del-ad="${a.id}">Supprimer</button></span>
            </div>
          </article>`;
        })
        .join('')
    : '<p class="muted">Aucune publicité. Ajoute-en une ou importe une liste ci-dessous.</p>';
};

let adSearchTimer;
['#ads-q', '#ads-hook', '#ads-lang', '#ads-winners'].forEach((sel) =>
  $(sel).addEventListener('input', () => {
    clearTimeout(adSearchTimer);
    adSearchTimer = setTimeout(loaders.ads, 250);
  }),
);

$('#ads-list').addEventListener('click', async (e) => {
  const id = e.target.dataset.delAd;
  if (!id || !confirm('Supprimer cette publicité ?')) return;
  await api('DELETE', `/api/ads/${id}`);
  loaders.ads();
});

$('#ad-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await api('POST', '/api/ads', data);
    e.target.reset();
    toast('Publicité ajoutée et analysée');
    loaders.ads();
  } catch (err) {
    toast(err.message);
  }
});

$('#import-btn').addEventListener('click', async () => {
  try {
    const ads = JSON.parse($('#import-json').value);
    const { imported } = await api('POST', '/api/ads/import', { ads });
    toast(`${imported} publicités importées`);
    $('#import-json').value = '';
    loaders.ads();
  } catch (err) {
    toast(err instanceof SyntaxError ? 'JSON invalide' : err.message);
  }
});

$('#meta-btn').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try {
    const { imported } = await api('POST', '/api/ads/meta-sync', { searchTerms: $('#meta-terms').value });
    toast(`${imported} publicités récupérées depuis Meta`);
    loaders.ads();
  } catch (err) {
    toast(err.message);
  } finally {
    e.target.disabled = false;
  }
});

// --- Hooks & tendances ---
$('#hook-btn').addEventListener('click', async () => {
  const r = await api('POST', '/api/hooks/analyze', { text: $('#hook-text').value });
  $('#hook-result').innerHTML = `
    <h3>Hook : « ${esc(r.hook || '—')} »</h3>
    <p>Score : <span class="score ${scoreClass(r.score)}">${r.score}/100</span> ·
       Langue : <strong>${esc(LANG_LABELS[r.language] || r.language)}</strong>
       ${r.priceMad ? ` · Prix détecté : <strong>${mad(r.priceMad)}</strong>` : ''}</p>
    <div class="tags">${r.types.length ? hookTags(r.types) : '<span class="muted">Aucun levier détecté : ajoute une question, un chiffre ou une offre.</span>'}</div>`;
});

function bars(items, labelKey, countKey) {
  const max = Math.max(1, ...items.map((i) => i[countKey]));
  return items
    .map(
      (i) => `<div class="bar"><span class="name">${esc(i[labelKey])}</span>
        <span class="track"><span class="fill" style="width:${(i[countKey] / max) * 100}%; display:block"></span></span>
        <span class="n">${i[countKey]}</span></div>`,
    )
    .join('');
}

loaders.trends = async () => {
  const t = await api('GET', '/api/trends');
  $('#trend-hooks').innerHTML = t.hookTypes.length ? bars(t.hookTypes, 'label', 'count') : '<p class="muted">Pas assez de publicités récentes.</p>';
  $('#trend-keywords').innerHTML = t.keywords.length
    ? `<table><thead><tr><th>Mot-clé</th><th class="num">Pubs (7 j)</th><th class="num">Avant</th><th class="num">Évolution</th></tr></thead><tbody>
        ${t.keywords
          .map(
            (k) => `<tr><td>${esc(k.word)}</td><td class="num">${k.count}</td><td class="num">${k.previous}</td>
              <td class="num">${k.growth === null ? '<span class="tag win">Nouveau</span>' : `${k.growth > 0 ? '+' : ''}${k.growth} %`}</td></tr>`,
          )
          .join('')}</tbody></table>`
    : '<p class="muted">Pas encore de tendance : il faut au moins 2 publicités récentes qui partagent un mot-clé.</p>';
};

// --- Boutiques ---
loaders.stores = async () => {
  const stores = await api('GET', '/api/stores');
  $('#stores-list').innerHTML = `<div class="card">${
    stores.length
      ? `<table><thead><tr><th>Boutique</th><th class="hide-mobile">Plateforme</th><th class="num">Produits</th>
          <th class="num">Nouveaux (30 j)</th><th class="num">CA estimé (30 j)</th><th class="hide-mobile">Dernier scan</th><th></th></tr></thead><tbody>
          ${stores
            .map(
              (s) => `<tr>
                <td><a href="#" data-open="${s.id}">${esc(s.name)}</a><br /><span class="muted">${esc(s.url)}</span>
                  ${s.last_error ? `<br /><span class="error">${esc(s.last_error)}</span>` : ''}</td>
                <td class="hide-mobile">${esc(s.platform || '—')}</td>
                <td class="num">${s.stats.catalog.total}</td>
                <td class="num">${s.stats.counts.new_product || 0}</td>
                <td class="num">${s.stats.catalog.with_inventory ? mad(s.stats.estimatedRevenue) : '<span class="muted" title="Stock non public">n/d</span>'}</td>
                <td class="hide-mobile">${date(s.last_scan_at)}</td>
                <td class="num"><button class="ghost" data-scan="${s.id}">Scanner</button><button class="ghost" data-del-store="${s.id}">✕</button></td>
              </tr>`,
            )
            .join('')}</tbody></table>`
      : '<p class="muted">Aucune boutique suivie. Ajoute l\'URL d\'un concurrent (Shopify, YouCan, WooCommerce…).</p>'
  }</div>`;
};

async function openStore(id) {
  const d = await api('GET', `/api/stores/${id}`);
  $('#store-detail').innerHTML = `
    <div class="grid2">
      <div class="card">
        <h2>${esc(d.store.name)} · catalogue (${d.products.length})</h2>
        <table><thead><tr><th></th><th>Produit</th><th class="num">Prix</th><th class="num">Stock</th><th class="hide-mobile">Vu depuis</th></tr></thead><tbody>
          ${d.products
            .slice(0, 300)
            .map((p) => {
              const link = safeUrl(p.url);
              const img = safeUrl(p.image);
              return `<tr${p.removed_at ? ' class="muted"' : ''}>
                <td>${img ? `<img class="thumb" src="${esc(img)}" loading="lazy" alt="" />` : ''}</td>
                <td>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)}${p.removed_at ? ' (retiré)' : ''}</td>
                <td class="num">${mad(p.price)}</td>
                <td class="num">${p.inventory ?? (p.available ? 'En stock' : 'Rupture')}</td>
                <td class="hide-mobile">${date(p.first_seen_at)}</td></tr>`;
            })
            .join('')}
        </tbody></table>
      </div>
      <div class="card"><h2>Historique des changements</h2>${renderEvents(d.events)}</div>
    </div>`;
  $('#store-detail').scrollIntoView({ behavior: 'smooth' });
}

$('#stores-list').addEventListener('click', async (e) => {
  const { open, scan, delStore } = e.target.dataset;
  if (open) {
    e.preventDefault();
    openStore(open);
  }
  if (scan) {
    e.target.disabled = true;
    const r = await api('POST', `/api/stores/${scan}/scan`).catch((err) => ({ ok: false, error: err.message }));
    toast(r.ok ? `${r.products} produits, ${r.changes} changements` : `Erreur : ${r.error}`);
    loaders.stores();
  }
  if (delStore && confirm('Arrêter de suivre cette boutique ?')) {
    await api('DELETE', `/api/stores/${delStore}`);
    $('#store-detail').innerHTML = '';
    loaders.stores();
  }
});

$('#store-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Analyse…';
  try {
    const { scan } = await api('POST', '/api/stores', Object.fromEntries(new FormData(e.target)));
    toast(scan.ok ? `${scan.products} produits trouvés (${scan.platform})` : `Ajoutée, mais erreur : ${scan.error}`);
    e.target.reset();
    loaders.stores();
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Suivre';
  }
});

// --- Fournisseurs ---
const SUPPLIER_TYPES = {
  grossiste_local: 'Grossiste local',
  fabricant_local: 'Fabricant marocain',
  import_chine: 'Import Chine',
  import_turquie: 'Import Turquie',
  dropshipping: 'Dropshipping local',
};

loaders.suppliers = async () => {
  const list = await api('GET', `/api/suppliers?q=${encodeURIComponent($('#suppliers-q').value)}`);
  $('#suppliers-list').innerHTML = list.length
    ? `<table><thead><tr><th>Nom</th><th>Type</th><th>Ville</th><th>Catégorie</th><th>Contact</th><th class="hide-mobile">MOQ / notes</th><th></th></tr></thead><tbody>
        ${list
          .map((s) => {
            const link = safeUrl(s.url);
            return `<tr><td>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</td>
              <td>${esc(SUPPLIER_TYPES[s.type] || s.type || '')}</td><td>${esc(s.city)}</td><td>${esc(s.category)}</td>
              <td>${esc(s.contact)}</td><td class="hide-mobile">${esc([s.moq, s.notes].filter(Boolean).join(' · '))}</td>
              <td class="num"><button class="ghost" data-del-supplier="${s.id}">✕</button></td></tr>`;
          })
          .join('')}</tbody></table>`
    : '<p class="muted">Aucun fournisseur enregistré.</p>';
};
$('#suppliers-q').addEventListener('input', () => loaders.suppliers());

$('#suppliers-list').addEventListener('click', async (e) => {
  const id = e.target.dataset.delSupplier;
  if (!id || !confirm('Supprimer ce fournisseur ?')) return;
  await api('DELETE', `/api/suppliers/${id}`);
  loaders.suppliers();
});

$('#supplier-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('POST', '/api/suppliers', Object.fromEntries(new FormData(e.target)));
    e.target.reset();
    toast('Fournisseur enregistré');
    loaders.suppliers();
  } catch (err) {
    toast(err.message);
  }
});

$('#sourcing-btn').addEventListener('click', () => {
  const q = $('#sourcing-q').value.trim();
  if (!q) return;
  const enc = encodeURIComponent(q);
  const sources = [
    ['Alibaba', `https://www.alibaba.com/trade/search?SearchText=${enc}`],
    ['AliExpress', `https://www.aliexpress.com/wholesale?SearchText=${enc}`],
    ['1688 (Chine, prix usine)', `https://s.1688.com/selloffer/offer_search.htm?keywords=${enc}`],
    ['Grossistes au Maroc', `https://www.google.com/search?q=${encodeURIComponent(`grossiste ${q} Maroc`)}`],
    ['Derb Omar (Casablanca)', `https://www.google.com/search?q=${encodeURIComponent(`${q} Derb Omar grossiste`)}`],
    ['Annonces Avito', `https://www.google.com/search?q=${encodeURIComponent(`site:avito.ma ${q} gros`)}`],
  ];
  $('#sourcing-links').innerHTML = sources
    .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)} ↗</a>`)
    .join('');
});

loaders.dashboard().catch((err) => toast(err.message));
