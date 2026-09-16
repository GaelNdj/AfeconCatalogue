# Rapport d’écarts catalogue ↔ site Afecon

Généré en 70s.

## Totaux
- Produits site: **2972**
- Références site: **13535**
- Lignes catalogue (Excel): **81719**
- Fichiers uploads site: **7403** stems

## Stats
- `variante_ok`: **50720**
- `photo_marque_ou_inutile`: **41033**
- `nom_ok`: **35209**
- `ref_absente_site`: **30055**
- `photo_site_sans_image_excel`: **16668**
- `nom_different`: **16455**
- `photo_identique_hash`: **14808**
- `ref_site_trouvee_catalogue`: **13525**
- `photo_marque_differente`: **12123**
- `photo_marque_ok`: **11125**
- `photo_meme_stem_hash_diff`: **6941**
- `photo_marque_meme_nom_contenu_diff`: **6247**
- `photo_produit_ok`: **3683**
- `photo_differente`: **968**
- `variante_differente`: **943**
- `photo_meme_nom_contenu_different`: **694**
- `photo_manquante_site`: **142**
- `photo_catalogue_introuvable_disque`: **13**
- `ref_absente_catalogue`: **10**
- `photo_manquante_site_marque`: **1**
- `variante_manquante_site`: **1**

## Écarts (compteurs)
- **photo_marque_ou_inutile**: 41033
- **ref_absente_site**: 30055
- **nom_different**: 16455
- **photo_marque_differente**: 12123
- **photo_marque_meme_nom_contenu_diff**: 6247
- **photo_differente**: 968
- **variante_differente**: 943
- **photo_meme_nom_contenu_different**: 694
- **photo_manquante_site**: 142
- **photo_catalogue_introuvable_disque**: 13
- **ref_absente_catalogue**: 10
- **variante_manquante_site**: 1
- **photo_manquante_site_marque**: 1

## Photos — distinction produit vs marque/inutile
- `photo_produit_ok` / `photo_identique_hash`: match exact utile
- `photo_differente` / `photo_meme_nom_contenu_different` / `photo_manquante_site`: **critiques** (vraies photos produit)
- `photo_marque_ou_inutile` et types `*_marque*`: signalés à part (logo, bandeau, image très réutilisée, etc.)

## Exemples critiques — photos produit
- **photo_meme_nom_contenu_different** code=`1540400` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`1540401` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`1829761` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`1977956` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`6660809` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`6660795` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`7834693` — cat `PASSAGE DE MUR` / site `PASSAGE DE MUR` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_01.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_01.png` — md5_cat=931a3d902b8dc69ad0bdfb2c6832042b md5_site=8c780290533242b75e5f2317a9c68aef
- **photo_meme_nom_contenu_different** code=`1540402` — cat `RACCORD POUR GOULOTTE DE CONDENSAT` / site `RACCORD POUR GOULOTTE DE CONDENSAT` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0407_02.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0407_02.png` — md5_cat=0c6b82fbc7f7fe9eae1bd108d71311c7 md5_site=931a3d902b8dc69ad0bdfb2c6832042b
- **photo_meme_nom_contenu_different** code=`4924569` — cat `SIGNALÉTIQUE ET CARNET D'INTERVENTION` / site `SIGNALÉTIQUE ET CARNET D'INTERVENTION` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0414_00.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0414_00.png` — md5_cat=2baff52b848dc2ef7cdde05c91c66f3f md5_site=b1863d266bec0c98b4cf69bde75d2376
- **photo_meme_nom_contenu_different** code=`4924570` — cat `SIGNALÉTIQUE ET CARNET D'INTERVENTION` / site `SIGNALÉTIQUE ET CARNET D'INTERVENTION` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0414_00.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0414_00.png` — md5_cat=2baff52b848dc2ef7cdde05c91c66f3f md5_site=b1863d266bec0c98b4cf69bde75d2376
- **photo_meme_nom_contenu_different** code=`4924571` — cat `SIGNALÉTIQUE ET CARNET D'INTERVENTION` / site `SIGNALÉTIQUE ET CARNET D'INTERVENTION` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0414_00.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0414_00.png` — md5_cat=2baff52b848dc2ef7cdde05c91c66f3f md5_site=b1863d266bec0c98b4cf69bde75d2376
- **photo_meme_nom_contenu_different** code=`4868974` — cat `SIGNALÉTIQUE ET CARNET D'INTERVENTION` / site `SIGNALÉTIQUE ET CARNET D'INTERVENTION` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0414_00.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0414_00.png` — md5_cat=2baff52b848dc2ef7cdde05c91c66f3f md5_site=b1863d266bec0c98b4cf69bde75d2376
- **photo_meme_nom_contenu_different** code=`1667858` — cat `SUPPORTS SPÉCIAUX` / site `SUPPORTS SPÉCIAUX` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0412_00.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0412_00.png` — md5_cat=46e93dac387134d80c599c782576e33c md5_site=95421cfbb2f6276d8ade405f2cbb22b3
- **photo_meme_nom_contenu_different** code=`4436116` — cat `COLLIER 2 VIS EN ACIER M8/10` / site `COLLIER 2 VIS EN ACIER M8/10` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p1060_04.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p1060_04.png` — md5_cat=813043164238a1fa6caf6e2f4ee8b4e2 md5_site=f951a651e643a7a4fd3f37d27dd5538a
- **photo_meme_nom_contenu_different** code=`3544812` — cat `COLLIERS CLIPEO` / site `COLLIERS CLIPEO` — `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p1056_05.png` vs `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p1056_05.png` — md5_cat=397577a411a79b95c7c2d8859295348f md5_site=125a46a544cb405f1132dbc95134ab03

## Exemples — photos marque / inutiles
- **photo_marque_ou_inutile** `images_hq/p0533_05.png` / `/uploads/p0533_05.png` — cat=marque_ou_inutile:petite(150x70); site=marque_ou_inutile:petite(109x150)
- **photo_marque_meme_nom_contenu_diff** `/Users/gael/Desktop/catalogue_pro_2026_images_hq/p0533_05.png` / `/Users/gael/Documents/htdocs/AfeconCatalogue/backend/uploads/p0533_05.png` — md5_cat=a3cec99261dbc2fa6ceec617dbc712bf md5_site=37ce27e1c694802a6610503e4e7fa9cc
- **photo_marque_ou_inutile** `images_hq/p0533_09.png` / `/uploads/p0533_09.png` — cat=marque_ou_inutile:petite(150x106); site=marque_ou_inutile:petite(150x106)
- **photo_marque_ou_inutile** `images_hq/p0533_09.png` / `/uploads/p0533_09.png` — cat=marque_ou_inutile:petite(150x106); site=marque_ou_inutile:petite(150x106)
- **photo_marque_ou_inutile** `images_hq/p0533_09.png` / `/uploads/p0533_09.png` — cat=marque_ou_inutile:petite(150x106); site=marque_ou_inutile:petite(150x106)
- **photo_marque_ou_inutile** `images_hq/p0533_00.png` / `/uploads/p0533_00.png` — cat=marque_ou_inutile:petite(150x89); site=marque_ou_inutile:petite(150x89)
- **photo_marque_ou_inutile** `images_hq/p0533_00.png` / `/uploads/p0533_00.png` — cat=marque_ou_inutile:petite(150x89); site=marque_ou_inutile:petite(150x89)
- **photo_marque_ou_inutile** `images_hq/p0533_00.png` / `/uploads/p0533_00.png` — cat=marque_ou_inutile:petite(150x89); site=marque_ou_inutile:petite(150x89)
- **photo_marque_ou_inutile** `images_hq/p0399_03.png` / `/uploads/p0399_03.png` — cat=marque_ou_inutile:réutilisée_x48; site=marque_ou_inutile:réutilisée_x48
- **photo_marque_ou_inutile** `images_hq/p0399_03.png` / `/uploads/p0399_03.png` — cat=marque_ou_inutile:réutilisée_x48; site=marque_ou_inutile:réutilisée_x48

## Exemples — refs / noms / variantes
### ref_absente_site
- code=`7846214` ref_pro=`2340` | `+ CÂBLE` ↔ `` | var `` ↔ ``
- code=`1388619` ref_pro=`13410` | `- Pour MCR 24 97581247` ↔ `` | var `` ↔ ``
- code=`1269002` ref_pro=`17730` | `- Pour MCR 24 97581257` ↔ `` | var `` ↔ ``
- code=`3055888` ref_pro=`4241` | `10 BAR 190745` ↔ `` | var `` ↔ ``
- code=`1816553` ref_pro=`5040` | `115 ECONOX PLUS` ↔ `` | var `` ↔ ``
### nom_different
- code=`4531064` ref_pro=`12538` | `BALLON ÉCHANGEUR` ↔ `TRÉPIED ET ACCESSOIRES` | var `ACCESSOIRE` ↔ ``
- code=`7474332` ref_pro=`68670` | `COLLECTEUR COMPACT SYNTHÈSE` ↔ `JAUGE` | var `12 circuits` ↔ `12 circuits`
- code=`7474333` ref_pro=`74833` | `COLLECTEUR COMPACT SYNTHÈSE` ↔ `JAUGE` | var `13 circuits` ↔ `13 circuits`
- code=`7474334` ref_pro=`79707` | `COLLECTEUR COMPACT SYNTHÈSE` ↔ `JAUGE` | var `14 circuits` ↔ `14 circuits`
- code=`7474335` ref_pro=`84116` | `COLLECTEUR COMPACT SYNTHÈSE` ↔ `JAUGE` | var `15 circuits` ↔ `15 circuits`
### variante_differente
- code=`3457` ref_pro=`3457` | `LIV SONDE EXT THERMOSTAT PROG` ↔ `PINCE DE SERRAGE/COUPANTE` | var `MY HOME BT` ↔ `bec coudé 40° 26 22 200`
- code=`3477` ref_pro=`3477` | `MH INTERFACE 2 CONTACTS BASIC` ↔ `SOUPAPE SANITAIRE AVEC PRISE MANO` | var `MY HOME BT` ↔ `10 bar`
- code=`3499` ref_pro=`3499` | `MH MODULE FIN DE LIGNE` ↔ `CORPS THERMOSTATIQUE` | var `MY HOME BT` ↔ `DROIT`
- code=`3511` ref_pro=`3511` | `CONTACT MAGN SAILLIE PLASTIQUE` ↔ `TUYAUX PVC SOUPLE` | var `MY HOME BT` ↔ `TUYAU D'ÉVACUATION DE CONDENSATS`
- code=`3512` ref_pro=`3512` | `CONTACT MAGN SAILLIE P/GARAGE` ↔ `RÉDUCTEUR DE PRESSION` | var `MY HOME BT` ↔ `en 3/4" ou FF 1/2"`
### ref_absente_catalogue
- code=`1000001` ref_pro=`MAM-L-1515` | `` ↔ `Mamelon fileté laiton` | var `` ↔ ``
- code=`1000002` ref_pro=`MAM-L-2020` | `` ↔ `Mamelon fileté laiton` | var `` ↔ ``
- code=`1000003` ref_pro=`MAM-L-2525` | `` ↔ `Mamelon fileté laiton` | var `` ↔ ``
- code=`1000004` ref_pro=`MAM-L-3232` | `` ↔ `Mamelon fileté laiton` | var `` ↔ ``
- code=`1000005` ref_pro=`MAM-L-4040` | `` ↔ `Mamelon fileté laiton` | var `` ↔ ``

CSV détaillé: `/Users/gael/Documents/htdocs/AfeconCatalogue/rapport_ecarts_catalogue_site.csv`

## Méthode
- Catalogue = Excel pro 2026 (PDF trop volumineux pour transfert direct; Excel = extraction structurée).
- Site = API locale `/api/products` + détails références.
- Photos = comparaison stem fichier + hash MD5; classification marque/inutile par taille, ratio bandeau, réutilisation massive, image quasi vide.