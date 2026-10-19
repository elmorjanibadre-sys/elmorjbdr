# Souk Radar

Outil de veille e-commerce pensé pour le marché marocain, dans l'esprit des
outils d'« ad spy » : il regroupe l'analyse des publicités, le suivi des
boutiques concurrentes et la recherche de fournisseurs.

## Fonctionnalités

| Module | Ce qu'il fait |
| --- | --- |
| **Publicités** | Bibliothèque de pubs (Facebook, Instagram, TikTok, Snapchat), filtres par hook, langue et pubs gagnantes (actives depuis 7 jours ou plus). Ajout manuel, import JSON en masse, synchronisation Meta. |
| **Hooks** | Extraction de la phrase d'accroche, détection de la langue (darija en lettres arabes ou latines comme « 3ndk », « bzaf », français, arabe), classement (question, offre, livraison / paiement à la livraison, urgence, preuve sociale, problème → solution, curiosité, démonstration), prix en DH et score sur 100. Pour les vidéos, l'analyse porte sur la transcription des premières secondes. |
| **Tendances** | Mots-clés en hausse sur 7 jours par rapport aux 7 jours précédents, et types de hooks dominants. |
| **Boutiques** | Suivi des concurrents (Shopify, YouCan, WooCommerce, sites sur mesure) : catalogue, nouveaux produits, changements de prix, ruptures, produits retirés. Scan automatique toutes les 60 minutes. |
| **Chiffre d'affaires** | Estimation des ventes par la baisse du stock × le prix, **uniquement quand la boutique expose ses quantités en stock** (sinon affiché « n/d »). |
| **Fournisseurs** | Carnet de fournisseurs (grossistes locaux, Derb Omar, fabricants marocains, import Chine / Turquie) et recherche d'un produit sur Alibaba, AliExpress, 1688, Avito et chez les grossistes marocains. |

## Lancer

Node.js 22.13 ou plus récent, sans aucune dépendance à installer.

```bash
cd radar
npm start          # http://localhost:4000
npm test
```

Variables d'environnement :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port HTTP | `4000` |
| `DB_FILE` | Fichier SQLite | `radar.db` |
| `SCAN_INTERVAL_MIN` | Fréquence de scan des boutiques (minutes) | `60` |
| `META_ACCESS_TOKEN` | Jeton de la bibliothèque publicitaire Meta | — |

## Limites à connaître (important)

- **Publicités Meta au Maroc** : l'API officielle de la bibliothèque publicitaire
  ne renvoie les pubs commerciales que pour l'Union européenne. Pour le Maroc,
  elle ne donne que les pubs politiques ou à caractère social. Les outils comme
  Minea ou PiPiAds collectent les pubs avec des robots qui naviguent sur les
  réseaux sociaux, ce qui est contraire aux conditions d'utilisation de Meta et
  TikTok. Ici, les pubs entrent par ajout manuel, import JSON (par exemple
  depuis une extension navigateur ou un prestataire de données) ou par l'API
  Meta là où elle répond.
- **Chiffre d'affaires** : aucune boutique ne publie ses ventes. L'estimation
  n'est possible que si les quantités en stock sont visibles, ce qui est rare.
  Pour les boutiques en paiement à la livraison, les signaux les plus fiables
  restent les nouveaux produits, les ruptures et la durée de vie des pubs.
- **Hooks vidéo** : l'outil n'écoute pas encore les vidéos. Il faut fournir la
  transcription des premières secondes.
- **Usage** : pas encore de comptes utilisateurs. À n'utiliser qu'en local ou
  derrière une authentification avant toute mise en ligne.

## Prochaines étapes possibles

1. Comptes utilisateurs et abonnements (paiement CMI ou carte).
2. Transcription automatique des vidéos (Whisper) et analyse des hooks par IA.
3. Collecte via TikTok Creative Center et partenaires de données publicitaires.
4. Alertes WhatsApp / e-mail quand un concurrent lance un produit ou baisse un prix.
5. Base PostgreSQL et file de tâches pour suivre des milliers de boutiques.
