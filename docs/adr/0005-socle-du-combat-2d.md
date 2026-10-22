# ADR 0005 — Socle du combat 2D

- **Statut** : proposé
- **Date** : 22 octobre 2026
- **Décideur** : Architect (notes techniques de #46 et escalade d'impact, avec le PM)
- **Contexte produit** : épique #30, story technique #46 (préalable au prototype de combat #31)

## Contexte

L'épique #30 ajoute un combat en 2D, dont le prototype jouable (#31) doit vérifier le fun et la
faisabilité sur l'application Expo existante. L'analyse d'impact de #31 a rendu un verdict FORT : il
fallait d'abord installer les bibliothèques natives du combat, les rendre testables sous Jest,
préparer la racine de l'app et savoir sur quel canal un build est construit. Le PM et l'Architect en
ont fait la story technique #46, sans rien de visible ni de jouable. Son propre verdict FORT, dû à
sa seule structure (11 fichiers existants, 3 sous-modules), a été accepté par dérogation
([commentaire sur #46](https://github.com/BPotet/ascent/issues/46#issuecomment-6334421000)), à
condition que les mesures avant et après soient consignées ici et dans la PR #47.

Le combat juge des appuis à quelques dizaines de millisecondes près. Il faut donc savoir **comment
dater un toucher** sur le téléphone avant d'écrire le moteur (#31, § 7) : c'est le rôle de la sonde
de toucher.

## Décision

### 1. Bibliothèques retenues

Installées par `npx expo install` (versions alignées sur le SDK 57, aucune fixée à la main), en
`dependencies`, et importées seulement depuis `adapters` et `app` (dependency-cruiser inchangé).

| Paquet | Version | Pourquoi | Alternative écartée |
|---|---|---|---|
| `react-native-reanimated` | 4.5.1 | Animations sur le fil UI, insensibles aux saccades du JS ; rappel par image pour les mesures ; `ReduceMotion` | `Animated` de React Native : pilote natif limité, pas de calcul par image sur le fil UI |
| `react-native-worklets` | 0.10.1 | Dépendance de Reanimated 4 : exécute les worklets sur le fil UI (`scheduleOnUI`, `scheduleOnRN`) | — |
| `react-native-gesture-handler` | ~2.32 (2.32.0) | Touchers reconnus sur le fil UI dès le contact, plusieurs touchers simultanés, datation dans le worklet du geste | `Pressable` : un seul répondeur à la fois, datation sur le fil JS |
| `@shopify/react-native-skia` | 2.6.2 | Scène 2D sur le GPU (tracés, lueurs, flou), pilotée par les valeurs partagées de Reanimated | `react-native-svg` animé, coûteux sur Android quand beaucoup de propriétés bougent. C'est le **repli** si la taille de l'APK ou la fluidité posent problème |
| `expo-audio` | ~57.0.5 (57.0.5) | Sons courts préchargés, respect du mode silencieux sur iOS | `expo-av` (déprécié) ; `react-native-audio-api` (latence plus faible, moins mûr), à envisager si la latence mesurée par #31 dépasse ~50 ms |

`fast-check` n'est pas ajouté : il violerait la règle de pureté (décision 3).

**Configuration.**

- Aucun plugin pour Reanimated, Worklets, Gesture Handler et Skia ; `babel-preset-expo` configure
  déjà le plugin worklets (pas de `babel.config.js`).
- Plugin `expo-audio` dans `app.json` : `microphonePermission: false`, `recordAudioAndroid: false`,
  `enableBackgroundPlayback: false`, `enableBackgroundRecording: false`. Ni micro, ni lecture ou
  enregistrement en arrière-plan, donc ni permission micro ni service de premier plan.
- Racine `src/app/_layout.tsx` : `GestureHandlerRootView` (`flex: 1`, fond du thème) autour de
  `SafeAreaProvider`. Rien d'autre ne change.

### 2. Tests sous Jest

- Projets `integration` et `bdd` : `react-native-gesture-handler/jestSetup.js`, puis
  `test/setup/reanimated.ts` (simulation de Worklets, `setUpTests()` de Reanimated). Le projet
  `unit` reste en environnement node pur.
- Skia est **limité à un test de fumée** (`test/setup/skia.smoke.test.tsx`, environnement Skia
  choisi par son en-tête), hors des setups communs ; ses modules ES rejoignent la liste des paquets
  que jest-expo transpile.
- **Datation au début du toucher, alternative validée par l'Architect.** `fireGestureHandler` de
  Gesture Handler 2.32 complète toujours la séquence d'un geste : un `BEGAN` seul devient
  `BEGAN, ACTIVE, END`, et `[BEGAN, FAILED]` passe aussi par `onStart`. Un écran ne peut donc pas
  recevoir un vrai « BEGAN sans END » sous Jest. Le critère « le toucher est daté à son début, sans
  attendre le relâcher » est vérifié par :
  1. le **test unitaire de `touchProbeBegin`** (`useTouchProbe.test.ts`) : seul le traitement de
     `onBegin` est appelé ; l'horloge UI est lue une fois, à l'appel, et c'est cet instant qui part
     vers le JS ;
  2. une **horloge factice qui avance de 100 ms à chaque étape** qui suit le début (`onStart`,
     `onEnd`, `onFinalize`…) dans `TouchProbeScreen.test.tsx` : daté à `onBegin`, un toucher montre
     un écart de 300 ms ; daté à `onEnd` ou `onFinalize`, il montrerait 100 ou 0 ms ;
  3. le cas **`[BEGAN, FAILED]`** : un toucher qui n'est jamais un appui valide est quand même
     compté et daté à son début.

### 3. Règle de pureté du domaine et des cas d'usage

Le moteur de combat de #31 doit être déterministe et testable à la milliseconde. Le bloc ESLint
existant `src/domain/**` + `src/application/**` est **étendu** (un second bloc remplacerait la liste
actuelle) :

- `no-restricted-globals` : `fetch`, `window`, `document`, `navigator`, `localStorage` (déjà là), plus
  `setTimeout`, `setInterval`, `requestAnimationFrame`, `performance` (« le temps passe par un
  port : Clock, ou BattleClock dans #31 ») ;
- `no-restricted-properties` : `Math.random` (« le hasard passe par une graine : SeedSource, #31 »).

Elle fait partie de la barrière Style. Son test, `test/lint/purity.test.mjs`, tourne sous
`node:test` (`npm run test:scripts`), car ESLint 9 charge sa configuration par un `import()`
dynamique que Jest refuse.

### 4. Canal du build

- L'action `.github/actions/build-android-apk` prend une entrée `channel` (`preview` par défaut,
  `production` pour `release.yml`), la valide et l'exporte en `EXPO_PUBLIC_ASCENT_CHANNEL` avant
  `expo prebuild` et Gradle, qui produit le bundle JS. `ci.yml` garde le défaut : les PR et
  `develop` construisent le build de preview.
- `src/adapters/device/build/buildChannel.ts` lit la variable par un accès direct (sinon Metro ne
  l'inscrit pas dans le bundle). Seule la valeur exacte `preview` donne le canal `preview` ; absent,
  vide ou inconnu, il vaut `production` : un oubli cache les outils de preview, jamais l'inverse.
- Câblage testé par `scripts/ci/build-channel.test.mjs` (`node:test`).

### 5. Sonde de toucher, réservée au build de preview

- Route `src/app/preview/touch-probe.tsx`, ouverte seulement par le lien profond
  `ascent://preview/touch-probe`. Sur le canal `preview`, elle affiche la sonde ; sur tout autre
  canal, elle redirige vers l'accueil. « Fermer » revient à l'écran d'avant, ou à l'accueil quand le
  lien a ouvert l'app. **Aucun bouton ni menu** n'y mène : un test parcourt `src/` et le vérifie.
- 20 touchers sur la zone d'essai. Chaque toucher est daté dans le worklet `onBegin` du geste
  (`performance.now()` du fil UI), puis sa réception est datée par l'horloge JS
  (`performance.now()`). Au montage, un aller-retour `scheduleOnUI` → `scheduleOnRN` calibre le
  décalage « horloge UI − horloge JS » (milieu de l'aller-retour).
- **Méthode de datation** (`TimingMethod`), choisie automatiquement, par ordre de préférence :
  - **(a)** tous les écarts bruts « réception JS − toucher » sont dans
    `[SAME_BASE_MIN_GAP_MS, SAME_BASE_MAX_GAP_MS]` = **[−2 ms, 500 ms]**, bornes incluses : les deux
    horloges ont la même base, le toucher est daté sur le fil UI ;
  - **(b)** sinon, si tous les écarts recalés par le décalage calibré
    (`réception − (toucher − décalage)`) sont dans cette plage : même datation, recalée ;
  - **(c)** sinon : le toucher est daté à sa réception par le JS, avec sa latence mesurée.

  La borne basse tolère l'arrondi des deux horloges ; la borne haute est déjà une latence
  inacceptable pour un appui jugé. Les écarts affichés (médiane, p95 au rang le plus proche) sont
  ceux de la méthode retenue.

## Mesures

### Taille de l'APK (build de preview, job `android-apk`)

| | Taille | |
|---|---|---|
| Avant (`develop` à `16096ee`) | 67 111 475 octets (67,1 Mo) | |
| Après (bibliothèques de #46) | 93 182 802 octets (93,2 Mo) | +26 071 327 octets, +38,8 % |

La hausse vient surtout des bibliothèques natives de Skia, embarquées une fois par architecture
(ABI). **Acceptée** par l'Architect pour #46. La réduction (APK de preview limité à `arm64-v8a` et
`x86_64`, barrière de taille éventuelle) est suivie dans l'issue #49. Les APK suivants de la PR
restent du même ordre (93 203 214 octets avec l'écran de la sonde).

### Permissions Android (`aapt dump permissions`)

Ajoutées, **acceptées** : trois permissions de niveau « normal », accordées à l'installation sans
demande au joueur. **Aucune permission dangereuse** (ni micro, ni localisation, ni stockage en
plus).

| Permission | Origine |
|---|---|
| `MODIFY_AUDIO_SETTINGS` | Manifeste d'`expo-audio` (et son plugin, qui l'ajoute même sans micro) |
| `WAKE_LOCK` | Manifestes fusionnés des bibliothèques `androidx.media3` 1.9.0 (lecteur ExoPlayer, session média) qu'embarque `expo-audio` |
| `ACCESS_NETWORK_STATE` | Idem : `androidx.media3` (ExoPlayer observe le type de réseau pour la lecture en flux) |

Reanimated, Worklets, Gesture Handler et Skia ne déclarent aucune permission. Les permissions déjà
présentes avant #46 (`INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`,
`SYSTEM_ALERT_WINDOW`, `VIBRATE`, `com.bpotet.ascent.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`) sont
inchangées. Le job `android-apk` relève désormais la taille et les permissions de chaque APK dans
son résumé. **Réexamen prévu à #31**, quand les sons seront joués : retirer `WAKE_LOCK` et
`ACCESS_NETWORK_STATE` (`tools:node="remove"` par un plugin de configuration) si le combat n'en a
pas besoin.

### Durée des tests Jest

Mesure locale : médiane de 3 exécutions de `npx jest --selectProjects <projet> --ci` (4 cœurs, mêmes
`node_modules`), avant (`develop` à `16096ee`) et après (tête de la PR). En CI : étape « Unit,
integration and BDD tests with coverage thresholds » du job `tests`.

| Projet | Avant | Après, mêmes tests | Après, avec les tests de #46 |
|---|---|---|---|
| `integration` | 13,0 s (67 fichiers) | 16,1 s (+3,1 s, +24 %) | 17,5 s (+4,5 s, +35 %) |
| `bdd` | 4,7 s (13 fichiers) | 5,1 s (+0,4 s, +9 %) | 6,2 s (+1,5 s, +32 %) |
| CI, job `tests` (3 projets, couverture) | 37 s (`develop` à `16096ee`) | — | 62 s (PR à `d3ae837`, avant la route et la BDD) |

« Mêmes tests » : la configuration de Jest de #46 sur les seuls fichiers de test qui existaient
avant (`--runTestsByPath`). C'est le coût des setups de Gesture Handler et de Reanimated, chargés
par chaque fichier des projets `integration` et `bdd`. Le reste vient
des nouveaux tests (sonde, canal, Skia, route, BDD). La première exécution, à cache vide, est
écartée par la médiane (29,5 s et 21,6 s avant, 17,5 s et 6,4 s après). Accepté : les setups sont
limités à ces deux projets et Skia à un seul test de fumée.

### Datation des touchers sur l'émulateur

Capture `touch-probe-result` du parcours end-to-end `e2e/flows/preview-touch-probe.yaml`, job
`e2e-android` de la PR #47 à `ad86d00` (APK de preview, émulateur Android API 34, x86_64, sans
animations), 20 touchers par Maestro :

| Écart médian | Écart p95 | Méthode retenue | Base commune | Décalage calibré |
|---|---|---|---|---|
| 0,1 ms | 0,2 ms | **a** | oui | 3,5 ms |

[Capture](https://raw.githubusercontent.com/BPotet/ascent/ebcf22367413934d38109b68a2b4a7d98030db0a/pr-47/ad86d00/2026-10-22_093733/Sonde%20de%20toucher%20du%20build%20de%20preview/takeScreenshot/touch-probe-result.png)
(branche `e2e-screenshots`).

**Méthode retenue : (a).** Sur l'émulateur, `performance.now()` du fil UI et celui du fil JS ont la
même base : tous les écarts « réception JS − toucher » sont dans [−2 ms, 500 ms]. Le décalage
calibré (3,5 ms) reste de l'ordre d'un demi aller-retour entre les fils, ce qui est cohérent avec
une base commune ; la méthode (b) n'est pas nécessaire.

Limites de cette mesure :

- l'émulateur est au repos : le fil JS n'a rien d'autre à faire, d'où un écart de réception
  inférieur à la milliseconde. Sous la charge du combat, cet écart grandira ; c'est justement ce que
  la méthode (a) neutralise, puisque l'appui est jugé à l'instant daté sur le fil UI ;
- la base commune doit être **confirmée sur le téléphone du propriétaire** par #31 (§ 7), avant que
  son moteur de combat n'en dépende.

## Conséquences

- #31 applique la méthode retenue ici et la **confirme sur le téléphone du propriétaire**, dans son
  propre ADR (moteur de combat), avec les mesures en conditions de combat. Le propriétaire n'a rien à
  faire pour #46.
- Le domaine et les cas d'usage de #31 reçoivent le temps et le hasard par des ports
  (`BattleClock`, `SeedSource`) : la règle de pureté l'impose dès maintenant.
- Les tests d'écran qui simulent des gestes savent que `fireGestureHandler` complète toujours la
  séquence : on prouve une datation par une horloge qui avance à chaque étape, pas par l'ordre des
  appels.
- Un build sans canal se comporte en production : les outils de preview restent cachés.
- La taille de l'APK (#49) et les permissions de `expo-audio` (#31) restent à suivre ; le repli
  `react-native-svg` reste possible si Skia pèse trop.
