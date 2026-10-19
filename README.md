# Projets

- [`radar/`](radar/) : **Souk Radar**, veille e-commerce pour le Maroc (publicités, hooks, boutiques concurrentes, fournisseurs).
- `mobile/` et `server/` : **Chatly**, messagerie mobile (décrite ci-dessous).

# Chatly

Application de messagerie mobile (Android / iOS) en temps réel, inspirée des
messageries modernes. Code 100 % original.

## Fonctionnalités

- Connexion par nom d'utilisateur (mémorisé sur le téléphone)
- Liste des discussions triée par dernier message, recherche de contacts
- Messages privés en temps réel
- Statut en ligne / « vu à HH:MM »
- Indicateur « écrit… »
- Accusés de réception : ✓ envoyé, ✓✓ reçu, ✓✓ bleu lu
- Compteur de messages non lus
- Livraison des messages reçus hors ligne à la reconnexion

## Structure

```
server/   Serveur Node.js (Express + Socket.IO), stockage en mémoire
mobile/   Application Expo / React Native
```

## Lancer le projet

### 1. Serveur

```bash
cd server
npm install
npm start        # écoute sur le port 3000
npm test         # test d'intégration
```

### 2. Application mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_SERVER_URL=http://<IP-de-ton-PC>:3000 npm start
```

Scanne ensuite le QR code avec l'application **Expo Go** (Android / iOS).
Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi.
Sur l'émulateur Android, utilise `http://10.0.2.2:3000`.

Pour tester une conversation, connecte-toi avec deux noms différents sur deux
appareils (ou un téléphone + un émulateur).

## Version iOS

L'application est la même pour Android et iOS (Expo / React Native).

### Option 1 : tester tout de suite sur iPhone (gratuit)

1. Installe **Expo Go** depuis l'App Store.
2. Lance le serveur, puis `cd mobile && EXPO_PUBLIC_SERVER_URL=http://<IP-de-ton-PC>:3000 npm start`.
3. Scanne le QR code avec l'appareil photo de l'iPhone.
4. Accepte l'accès au « réseau local » quand iOS le demande.

### Option 2 : construire une vraie app iOS (.ipa) avec EAS

Pas besoin de Mac : la compilation se fait dans le cloud d'Expo.

```bash
npm install -g eas-cli
cd mobile
eas login                      # compte Expo gratuit
npm run build:ios:simulator    # build pour le simulateur iOS (pas de compte Apple requis)
npm run build:ios              # build installable sur iPhone (compte Apple Developer requis, 99 $/an)
npm run submit:ios             # envoi vers TestFlight / App Store
```

Pour une build installable, définis l'adresse du serveur avec une variable
d'environnement EAS (`EXPO_PUBLIC_SERVER_URL`), de préférence en **HTTPS** :
iOS bloque le HTTP non chiffré, sauf sur le réseau local.

Identifiant de l'app : `com.elmorjbdr.chatly` (modifiable dans `mobile/app.json`).

## Limites actuelles / pistes

- Les données sont en mémoire : elles disparaissent au redémarrage du serveur
  (prochaine étape : base de données, ex. PostgreSQL ou MongoDB).
- Pas de mot de passe ni de chiffrement de bout en bout.
- À ajouter : groupes, images et fichiers, notes vocales, notifications push.
