// Tendances : mots qui montent dans les publicités récentes et types de hooks dominants.
const { words, TYPE_LABELS } = require('./hooks');

const DAY = 24 * 3600 * 1000;
const STOPWORDS = new Set([
  // français
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'à', 'a', 'au', 'aux', 'pour', 'avec', 'sur', 'par',
  'vous', 'votre', 'vos', 'nous', 'notre', 'est', 'sont', 'ce', 'cette', 'ces', 'qui', 'que', 'plus', 'pas', 'ne',
  'dans', 'il', 'elle', 'on', 'se', 'sa', 'son', 'ses', 'tout', 'tous', 'très', 'dh', 'dhs', 'mad',
  // darija / arabe
  'و', 'في', 'من', 'على', 'ديال', 'هاد', 'هادي', 'غير', 'مع', 'لي', 'اللي', 'ف', 'ب', 'ل', 'او', 'أو', 'درهم', 'كاين',
  'dyal', 'had', 'hadi', 'ghir', 'f', 'b', 'l', 'w', 'li', 'm3a', 'kayn',
  // anglais
  'the', 'and', 'for', 'you', 'your', 'with', 'to', 'of', 'in', 'is', 'on',
]);

function keywordCounts(texts) {
  const counts = new Map();
  for (const text of texts) {
    // Un mot compte une fois par pub, pour ne pas surpondérer les textes répétitifs
    for (const w of new Set(words(text))) {
      if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return counts;
}

function computeTrends(db, { days = 7, now = Date.now(), top = 20 } = {}) {
  const recentStart = now - days * DAY;
  const previousStart = now - 2 * days * DAY;
  const rows = db.prepare('SELECT text, transcript, hook_types, started_at FROM ads WHERE started_at >= ?').all(previousStart);
  const recent = rows.filter((r) => r.started_at >= recentStart);
  const previous = rows.filter((r) => r.started_at < recentStart);

  const recentCounts = keywordCounts(recent.map((r) => `${r.text} ${r.transcript || ''}`));
  const previousCounts = keywordCounts(previous.map((r) => `${r.text} ${r.transcript || ''}`));

  const keywords = [...recentCounts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([word, n]) => {
      const before = previousCounts.get(word) || 0;
      return { word, count: n, previous: before, growth: before ? Math.round(((n - before) / before) * 100) : null };
    })
    // Les nouveautés (absentes avant) d'abord, puis les plus fortes hausses
    .sort((a, b) => (b.growth ?? Infinity) - (a.growth ?? Infinity) || b.count - a.count)
    .slice(0, top);

  const hookTypes = {};
  for (const r of recent) {
    for (const t of (r.hook_types || '').split(',').filter(Boolean)) hookTypes[t] = (hookTypes[t] || 0) + 1;
  }

  return {
    days,
    adsRecent: recent.length,
    adsPrevious: previous.length,
    keywords,
    hookTypes: Object.entries(hookTypes)
      .map(([type, count]) => ({ type, label: TYPE_LABELS[type] || type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

module.exports = { computeTrends, keywordCounts };
