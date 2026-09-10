# AfeconCatalogue

Catalogue produits professionnel — import CEDEO Excel + images, consultation, devis et commande en ligne.

## Vision produit

AfeconCatalogue est conçu comme une **boutique en ligne B2B** : le visiteur parcourt le catalogue, consulte les prix de vente (catalogue + marge), compose son panier et **passe commande si le prix lui convient**.

### Parcours visiteur (cible)

1. **Rechercher** une pièce (code, référence, désignation)
2. **Consulter** la fiche produit (image, références, **prix vente HT** avec marge appliquée)
3. **Ajouter au panier** les quantités souhaitées
4. **Voir le total** articles + frais de livraison HT
5. **Valider un devis / commander** — récapitulatif envoyé ou paiement en ligne
6. **Pièce introuvable ?** → formulaire contact (`/contact`)

### État actuel vs à venir

| Fonctionnalité | Statut |
|----------------|--------|
| Catalogue + recherche + familles | ✅ En place |
| Fiches produit + images | ✅ En place |
| Panier (sélection + totaux HT) | ✅ En place |
| Marges par famille + exceptions/offres | ✅ En place |
| Frais de livraison (règles admin) | ✅ En place |
| Contact « pièce introuvable » | ✅ En place |
| **Bouton « Demander un devis » depuis le panier** | 🔜 À développer |
| **Passage de commande** (enregistrement + e-mail) | 🔜 À développer |
| **Paiement en ligne** (ex. Stripe) | 🔜 À développer |
| Export PDF devis | 🔜 À développer |
| Compte client / historique commandes | 🔜 Optionnel |

> Le panier actuel sert à **préparer une commande** ; le bouton de validation devis/commande et le paiement seront ajoutés dans une prochaine étape.

## Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Node.js (Express) + PostgreSQL
- **Images:** fichiers sur disque (`backend/uploads/`), chemins en base

## Prérequis

- Node.js 20+
- PostgreSQL local (port 5432)

## Setup rapide

```bash
cd /Users/gael/Documents/htdocs/AfeconCatalogue

# Créer la base
createdb afecon_catalogue
# ou: psql -c "CREATE DATABASE afecon_catalogue;"

# Installer les dépendances
npm run install:all

# Migrer + seed démo (6 produits)
cp .env.example backend/.env   # si besoin
npm run db:migrate
npm run db:seed

# Lancer API (:4000) + Web (:5173)
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173).

## Import Excel + images

1. Admin → **Import**
2. Sélectionner `catalogue_pro_2026.xlsx`
3. Images — une des options :
   - chemin serveur (recommandé) : `/Users/gael/Desktop/catalogue_pro_2026_images`
   - ZIP d’images
   - multi-sélection navigateur (petits lots)
4. Lancer l’import

L’API fait un **upsert par `Code`** :

| Statut | Comportement |
|--------|----------------|
| nouveau code | insert |
| code existant, champs différents | update |
| code existant, identique | **unchanged** (pas d’écriture) |

Colonnes attendues : `Réf.Pro`, `Réf.Four`, `Diamètre`, `Vendu par`, `Marque`, `Désignation`, `Variante`, `Ordre`, `Code`, `Famille`, `Catégorie`, `Prix HT`, `Note`, `Image`.

- `Désignation` = nom de la fiche produit (regroupe les variantes)
- `Variante` = libellé spécifique de chaque référence (ligne catalogue)

## Structure

```
AfeconCatalogue/
  backend/          Express API + migrate/seed
  frontend/         React catalog UI
  package.json      npm run dev (concurrently)
```

## API principale

- `GET /api/products?q=&family_id=&page=&limit=` — pagination serveur
- `GET /api/products/:id` — détail + références
- `GET /api/families` — index familles + sous-familles
- `POST /api/import` — multipart `xlsx` + `images[]`
- CRUD `/api/products`, `/api/references`, `/api/families`

## Variables d’environnement

Voir `.env.example` / `backend/.env` :

```
DATABASE_URL=postgresql://gael@localhost:5432/afecon_catalogue
PORT=4000
UPLOAD_DIR=./uploads

# Sécurité admin (obligatoire)
ADMIN_API_KEY=changez-moi-en-production
FRONTEND_URL=http://localhost:5173
IMAGES_IMPORT_DIR=/chemin/vers/catalogue_pro_2026_images

CONTACT_TO_EMAIL=votre-adresse@exemple.fr
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="AfeconCatalogue" <...>

EUR_TO_CDF=2850
EUR_TO_USD=1.08
```

## Sécurité

| Mesure | Statut |
|--------|--------|
| Routes admin protégées (`X-Admin-Key`) | ✅ Import, CRUD, marges, références |
| Prix fournisseur masqués (API publique) | ✅ Seul `display_price_ht` exposé |
| Import images : dossiers autorisés uniquement | ✅ `IMAGES_IMPORT_DIR` |
| CORS restreint | ✅ `FRONTEND_URL` |
| Rate limit formulaire contact | ✅ 20 req / 15 min |
| Helmet (headers HTTP) | ✅ |
| Checkout / paiement sécurisé | 🔜 Roadmap |

L’admin web demande la clé au premier accès (`/admin`) — elle est stockée en `sessionStorage` pour la session.

## Contact « pièce introuvable »

- Page publique : `/contact` (lien **Pièce introuvable ?** dans le header)
- Si une recherche ne donne aucun résultat, un bouton **Demander cette pièce** redirige vers le formulaire
- Les demandes sont enregistrées en base (`contact_inquiries`) et envoyées à `CONTACT_TO_EMAIL` si SMTP est configuré

## Marges, exceptions et livraison

- **Admin → Marges** : règles de marge par famille / sous-famille / marque + exceptions & offres par code
- **Recalculer les prix** : applique les marges sur `price_sale_ht` sans toucher aux prix manuels ni aux exceptions — **à lancer après chaque nouvelle règle de marge**, puis vider/ré-ajouter les articles au panier
- **Import catalogue** : met à jour uniquement `price_catalog_ht` (prix CEDEO) — vos prix de vente ne sont pas écrasés
- **Admin → Livraison** : forfaits, paliers par montant panier, franco de port
- Panier : calcul automatique des frais de livraison HT

### Prix affiché au visiteur

Le visiteur voit le prix en **francs congolais (CDF)** en principal, avec l’équivalent **USD** en secondaire. La conversion est faite côté serveur à partir du prix de vente EUR HT (marge appliquée), via les taux configurables `EUR_TO_CDF` et `EUR_TO_USD` dans `backend/.env`.

- **Conversion automatique** : `prix vente EUR × EUR_TO_CDF` → CDF affiché
- **Prix fixe CDF** (admin) : colonne « Prix fixe CDF » sur une référence — prioritaire sur la conversion ; l’USD est dérivé du CDF
- **Prix sur devis** : articles cuivre « Prix à cours » — pas de montant affiché

Après modification des marges, cliquer sur **Recalculer les prix** en admin. Les prix CDF manuels ne sont pas écrasés par l’import catalogue (mode sync).

## Roadmap boutique (prochaines étapes)

1. **Page checkout / devis** — formulaire client (nom, société, e-mail, adresse livraison) + récap panier
2. **Enregistrement commande** en base (`orders` + lignes) + notification e-mail admin
3. **Export PDF devis** téléchargeable par le client
4. **Paiement en ligne** (Stripe ou autre) — option activable selon besoin
5. **Espace admin commandes** — suivi des demandes (en attente, validée, expédiée)
