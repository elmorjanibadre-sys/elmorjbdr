// Analyse des hooks publicitaires adaptée au Maroc : darija (arabe et latin),
// français et arabe, paiement à la livraison, prix en dirhams.

const DARIJA_ARABIC = ['ديال', 'بزاف', 'دابا', 'واش', 'كاين', 'كاينة', 'غير', 'هاد', 'هادي', 'شنو', 'علاش', 'مزيان', 'بغيتي', 'دغيا', 'ديالك'];
const DARIJA_LATIN = ['dyal', 'diyal', 'bzaf', 'bzzaf', 'daba', 'wach', 'kayn', 'kayna', 'ghir', 'had', 'hadi', 'chno', '3lach', 'mzyan', 'mzyana', 'bghiti', 'dghya', '3andna', 'flous', 'lflous', 'twsil', 'ltawsil'];
const FRENCH = ['le', 'la', 'les', 'des', 'pour', 'avec', 'vous', 'votre', 'livraison', 'gratuite', 'commandez', 'prix', 'offre', 'seulement', 'qualité'];
const ENGLISH = ['the', 'you', 'your', 'with', 'free', 'shipping', 'order', 'now', 'best'];

const HOOK_TYPES = {
  question: [/[?؟]/, /\b(wach|chno|3lach|kifach)\b/i, /(واش|شنو|علاش|كيفاش)/],
  offre_prix: [/\d+\s*(dh|dhs|mad|درهم)/i, /-\s?\d{1,2}\s?%/, /\b(promo|solde|remise|réduction|offre|tkhfid)\b/i, /(تخفيض|عرض|برومو|تخفيضات)/],
  livraison_cod: [
    /livraison\s+(gratuite|offerte|partout)/i,
    /paiement\s+(à|a)\s+la\s+livraison/i,
    /\b(cod|cash on delivery)\b/i,
    /(الدفع عند الاستلام|التوصيل مجاني|التوصيل بالمجان|الخلاص عند الاستلام)/,
    /\b(ltawsil|twsil|tawsil)\s+(fabor|majjani|mjani)\b/i,
  ],
  urgence: [
    /(stock limité|quantité limitée|dernières pièces|aujourd['’]hui seulement|derniers jours|\bvite\b)/i,
    /(كمية محدودة|غير اليوم|آخر فرصة|ماتضيعش|بسرعة)/,
    /\b(ghir lyoum|ma tdy3ch|bsor3a)\b/i,
  ],
  preuve_sociale: [/\b(clients?|avis|satisfaits?|témoignages?|best-?seller|\d+\+?\s*(commandes|ventes))\b/i, /(زبون|زبناء|تقييم|الأكثر مبيعا)/, /⭐/u],
  probleme_solution: [/\b(marre|fini|problème|solution|enfin|sans effort)\b/i, /(مشكل|مشكلة|الحل|حل|صافي)/, /\b(mochkil|lhal)\b/i],
  curiosite: [/\b(secret|découvrez|incroyable|personne ne|astuce|vous ne croirez)\b/i, /(السر|شوف|اكتشف|ماغاديش تصدق)/, /\b(chouf|sir)\b/i],
  demonstration: [/\b(avant|après|regardez|test|démonstration|résultat)\b/i, /(قبل|بعد|النتيجة|جربت)/],
};

const TYPE_LABELS = {
  question: 'Question',
  offre_prix: 'Offre / prix',
  livraison_cod: 'Livraison / paiement à la livraison',
  urgence: 'Urgence',
  preuve_sociale: 'Preuve sociale',
  probleme_solution: 'Problème → solution',
  curiosite: 'Curiosité',
  demonstration: 'Démonstration / avant-après',
};

function words(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}

function countMatches(tokens, list) {
  const set = new Set(list);
  return tokens.filter((t) => set.has(t)).length;
}

function detectLanguage(text) {
  const value = String(text || '');
  const letters = value.match(/\p{L}/gu) || [];
  if (!letters.length) return 'inconnu';
  const arabicRatio = (value.match(/\p{Script=Arabic}/gu) || []).length / letters.length;
  const tokens = words(value);
  if (arabicRatio > 0.5) {
    return countMatches(tokens, DARIJA_ARABIC) > 0 ? 'darija' : 'arabe';
  }
  // Darija en lettres latines : mots courants ou chiffres utilisés comme lettres (3, 7, 9)
  const arabizi = countMatches(tokens, DARIJA_LATIN) + tokens.filter((t) => /[a-z][379][a-z]|^[379][a-z]/.test(t)).length;
  const french = countMatches(tokens, FRENCH);
  const english = countMatches(tokens, ENGLISH);
  if (arabizi > 0 && arabizi >= french) return 'darija_latin';
  if (french >= english && french > 0) return 'francais';
  if (english > 0) return 'anglais';
  return arabicRatio > 0.2 ? 'mixte' : 'inconnu';
}

// Le hook est la première phrase, celle qui doit arrêter le scroll
function extractHook(text) {
  const value = String(text || '').trim();
  const firstLine = value.split(/\n+/)[0] || '';
  const sentence = firstLine.match(/^.+?[.!?؟](\s|$)/u)?.[0] || firstLine;
  return sentence.trim().slice(0, 160);
}

function extractPriceMad(text) {
  const match = String(text || '').match(/(\d[\d\s.,]*)\s*(dh|dhs|mad|درهم)/i);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Score indicatif sur 100 : un bon hook est court, concret et déclenche une émotion
function scoreHook(hook, types) {
  let score = 40;
  const length = [...hook].length;
  if (length > 0 && length <= 60) score += 15;
  else if (length > 120) score -= 10;
  if (/\d/.test(hook)) score += 10;
  if (/\p{Extended_Pictographic}/u.test(hook)) score += 5;
  score += Math.min(types.length, 3) * 10;
  return Math.max(0, Math.min(100, score));
}

function analyzeHook(text) {
  const hook = extractHook(text);
  const full = String(text || '');
  const types = Object.entries(HOOK_TYPES)
    .filter(([, patterns]) => patterns.some((re) => re.test(full)))
    .map(([type]) => type);
  return {
    hook,
    types,
    labels: types.map((t) => TYPE_LABELS[t]),
    language: detectLanguage(full),
    priceMad: extractPriceMad(full),
    score: scoreHook(hook, types),
  };
}

module.exports = { analyzeHook, detectLanguage, extractHook, extractPriceMad, words, TYPE_LABELS };
