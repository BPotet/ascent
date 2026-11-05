# ADR 0011 — Icône de l'application

- **Statut** : accepté
- **Date** : 30 octobre 2026
- **Décideur** : Architect (notes techniques de #166)
- **Contexte produit** : épique #160, story #166 « Icône de l'application : la tour sous la nuit
  sur l'écran d'accueil, au démarrage et en favicon »

## Contexte

Ascent affichait encore les images par défaut du modèle Expo. Le propriétaire a validé le
30/10/2026 la proposition A de la maquette `docs/mockups/160-app-icon/index.html`, la tour sous la
nuit, en pixel art : une icône adaptative Android (avant-plan, fond, monochrome) sur une toile de
54 × 54 pixels d'art (un pixel d'art = 2 dp), un petit format de 16 × 16 pour la favicon, et une
image de démarrage de 54 × 54 affichée à 216 dp sur `#0F1420`. Le pixel art ne supporte aucun
lissage : chaque pixel d'art doit rester un carré net à toutes les densités.

## Décision

1. **Lissage au prebuild : pas de densités fournies à la main.** `expo prebuild` tire chaque
   densité Android des PNG d'`assets/` avec `generateImageAsync` de `@expo/image-utils` : l'icône
   adaptative à 108 dp × 1 à 4 (108 à 432 px, `cover`), l'écran de démarrage à 216 dp × 1 à 4
   (216 à 864 px, `contain`). Avec les facteurs choisis, chaque densité vaut un nombre entier de
   pixels par pixel d'art (2, 3, 4, 6, 8 ; et 4, 6, 8, 12, 16), et le moteur Jimp d'image-utils
   rend exactement le plus proche voisin. Fournir les mipmaps voudrait dire versionner `android/`
   (contraire à la génération native continue) ou écrire un plugin de config.
   - `sharp`, s'il est trouvé, remplace Jimp et lisse (noyau Lanczos, aux rapports 3/8 et 3/4).
     L'étape « Generate the native Android project » du build passe donc
     `EXPO_IMAGE_UTILS_NO_SHARP=1` ; `e2e/README.md` conseille la même variable en local.
   - Garde-fou : `scripts/app-icon/expo-densities.test.mjs` fait passer les images dans
     l'image-utils du plugin `expo-splash-screen` aux 10 tailles et exige le plus proche voisin
     (couleur et opacité ; l'opacité seule pour un pixel entièrement transparent, dont Jimp laisse
     parfois le RGB d'un voisin, sans effet à l'écran).
2. **Écran de démarrage par `expo-splash-screen`** (`~57.0.10`, la version d'`expo` 57.0.28), avec
   son plugin dans `app.json` : `image` `./assets/splash-icon.png`, `imageWidth` 216,
   `backgroundColor` `#0F1420`, `resizeMode` `contain`. Aucun code JS : expo-router retient l'écran
   de démarrage et le cache à son premier rendu (ou en cas d'erreur). L'écran de chargement de
   l'app (`StartupLoadingScreen`) suit, inchangé.
3. **Génération par un script Node du dépôt, sans dépendance d'image.**
   `scripts/app-icon/generate.mjs` (`npm run app-icon`, options `--grid` et `--out`) lit la grille
   figée, valide tous les calques (nombre de rangées, largeur, caractères de la palette d'art ;
   erreur « `<calque>, rangée <n> : <cause>` »), prépare les six PNG en mémoire, puis seulement les
   écrit. Le PNG est déterministe : RGBA 8 bits, non entrelacé, filtre 0, deflate niveau 9,
   chunks `IHDR`, `IDAT` et `IEND` seulement. `icon.png` est le fond puis l'avant-plan, ×28
   (1512 px), recadré au centre en 1024 px. Les PNG sont committés ; le script ne tourne ni en CI
   ni au build, et un scénario vérifie qu'il les reproduit octet pour octet.
4. **Grilles figées à côté du script.** `scripts/app-icon/A-export.txt` (les 5 calques, dont
   `[demarrage]`, seule entrée du script) et `scripts/app-icon/A.json` (traçabilité : ses calques
   `fg`, `bg`, `mono` et `small` sont ceux de l'export), copiés tels quels et gardés par un test de
   leurs sha256. `A.json` est dans `.prettierignore`.

## Conséquences

- Une nouvelle image d'app ne demande qu'une nouvelle grille figée, validée par le propriétaire,
  puis `npm run app-icon`.
- Repli si une montée d'Expo lisse les densités (test de contrat rouge) : fournir les densités à la
  main (clés `mdpi` à `xxxhdpi` du plugin `expo-splash-screen` ; un petit plugin de config pour les
  mipmaps).
- Accepté : l'icône « legacy » d'Android 7 (API 24-25), tirée de `icon.png` à 48 dp, n'a pas un
  facteur entier et est lissée ; de même pour l'icône iOS, qui n'est pas une cible.
- Android 12 et plus découpe l'icône du démarrage dans un cercle de 192 dp : le pixel le plus
  éloigné de `[demarrage]` est à 85 dp du centre, rien n'est rogné.
- Une montée du zlib de Node peut changer les octets des PNG : le scénario « reproductible »
  échoue, on régénère et on committe ; les pixels restent garantis par le test pixel à pixel.
