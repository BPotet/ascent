# ADR 0006 — Moteur de combat 2D

- **Statut** : proposé (22 octobre 2026, à l'ouverture de la PR #53). Il passe à « accepté » quand
  les chiffres du téléphone du propriétaire sont reportés ci-dessous (section « Mesures »).
- **Date** : 22 octobre 2026
- **Décideur** : Architect (notes techniques de #31), avec le dev
- **Contexte produit** : épique #30, story #31 (prototype jouable du combat)
- **Numéro** : fixé au merge ; 0006 si aucun autre ADR n'est mergé avant.

## Contexte

L'épique #30 ajoute un combat au tour par tour avec parade, en 2D, sur l'app Expo existante
(SDK 57, React Native 0.86, nouvelle architecture). Le prototype #31 vérifie qu'il est amusant et
que la technique tient : la Sentinelle contre une Goule et un Spectre, la parade, l'esquive et la
transition de phase entre la phase du héros et la phase ennemie.

Le combat se lit par l'animation seule (pas d'anneau qui se referme). Un appui est jugé sur son
écart avec l'impact : parfait à 60 ms près, bon à 160 ms près (fenêtres de 120 ms et 320 ms). Le
joueur joue dans le bus, d'une main. Le socle (bibliothèques, canal du build, règle de pureté,
sonde de toucher) est l'ADR 0005, auquel cet ADR renvoie.

## Décision

### 1. Un moteur déterministe du domaine, piloté par les échéances

- Le combat est un état immuable (`Battle`, `src/domain/battle/`), sans bibliothèque. Le moteur
  reçoit des instants (en ms, base monotone) et une graine du combat ; il renvoie un nouvel état
  et des événements de combat (`BattleEvent`) datés de leur **instant nominal**.
- Il n'avance pas image par image : la session de combat (`BattleSession`, couche `application`)
  lui demande sa prochaine échéance (`nextDeadline` : fin de transition, fin d'avancée, impact,
  impact + 160 ms…) et programme un minuteur par le port `BattleClock`. Un minuteur en retard ne
  décale rien : les événements gardent leur instant nominal.
- Chaque commande du joueur (`pressDefense`, `heroAction`, `dismissDefenseHint`) commence par faire
  avancer le moteur jusqu'à l'instant de l'appui, puis l'applique.
- La règle de pureté de l'ADR 0005 (§ 3) garantit qu'aucune horloge ni aucun hasard caché n'entre
  dans `domain` ou `application`.

### 2. Jugement à l'instant du toucher

- Un appui sur « Parade » ou « Esquive » est daté dans le worklet `onBegin` de son geste (Gesture
  Handler), sur le fil UI, dès que le doigt se pose : `touchProbeBegin` et `uiThreadNow` de la sonde
  sont réutilisés tels quels. L'instant part vers le fil JS (`scheduleOnRN`) et c'est lui qui est
  jugé, jamais l'instant où le JS le traite : une saccade du fil JS retarde l'affichage du
  résultat, jamais son exactitude.
- Un doigt maintenu ne produit aucun autre appui. Deux doigts sur Parade et Esquive sont jugés
  chacun (deux gestes indépendants).
- « Attaquer » et le choix de la cible se valident **au relâcher**, si le doigt est encore sur le
  bouton, avec l'instant du début du toucher : un toucher commencé avant la phase du héros (pendant
  la transition) n'est jamais pris en compte.

### 3. Méthode de datation (a) de l'ADR 0005

- L'instant du toucher (fil UI) et l'horloge de combat (`MonotonicBattleClock`, `performance.now()`
  du fil JS) sont sur la même base : l'instant passe sans conversion.
- Un seul point de conversion existe : `toBattleInstant` (`src/adapters/ui/state/battleTouch.ts`).
  Si le téléphone du propriétaire donne la méthode (b), seule cette fonction change (instant −
  décalage calibré par `calibrateClocks`). La méthode (c) déclencherait une escalade (#31, § 7).
- **À confirmer sur le téléphone du propriétaire** : la sonde au repos, puis les appuis du combat
  sous charge (panneau Mesures, qui recalcule la méthode par `touchProbeReport`).

### 4. Garde de réordonnancement de 32 ms

Une échéance « appui absent » (impact + 160 ms + max(0, −décalage)) n'est traitée que 32 ms
après : un toucher daté juste avant l'échéance, mais reçu par le JS juste après, est encore jugé.
Un appui reçu avec un instant antérieur à l'état du moteur est daté à cet état et compté
(« Appuis redatés », panneau Mesures). Dans le moteur, un appui à l'instant même de l'échéance est
encore jugé : l'impact n'est subi qu'après.

### 5. Arrêt sur image

Une parade parfaite arrête le temps du combat pendant 90 ms (`HitStop`) : toutes les échéances
suivantes de l'attaque sont décalées d'autant, y compris le 2e impact d'une double frappe. Un
appui pendant l'arrêt est daté de son début. La contre-attaque part à la fin de l'arrêt.

### 6. Graine et ordre des tirages

- Le hasard vient d'une graine du combat (`BattleSeed`), donnée par le port `SeedSource`
  (`RandomSeedSource` sur le téléphone, `FixedSeedSource` dans les tests), et d'un générateur pur
  de 32 bits (mulberry32, `SeededRandom`), dont l'état fait partie du combat.
- Tous les tirages se font au début de la manche, dans un ordre fixe : ennemis debout de gauche à
  droite, puis pour chacun le coup, la durée de préparation (× 0,8 à × 1,2) et la position de la
  fausse amorce (35 à 60 %). Une même graine et les mêmes actions donnent exactement le même
  combat, quel que soit le moment des appuis.
- Les propriétés des tirages sont vérifiées par un balayage d'environ 500 graines fixes
  (`fast-check` reste écarté, ADR 0005).

### 7. Durées internes

Deux durées que la maquette impose sans les chiffrer sont des constantes du domaine, validées par
le GD et l'UX pendant le développement (elles ne changent aucune règle validée) :

- **Durée de l'action du héros** (`HERO_ACTION_MS`) : 500 ms, de « Attaquer » au début de la
  transition de phase ;
- **Durée de la contre-attaque** (`COUNTER_MS`) : 400 ms, après l'arrêt sur image.

La préparation de base de la **double frappe** est celle du coup simple (1 100 ms) : avec
1 000 ms (prototype de la maquette), le premier impact pourrait tomber 2 000 ms après l'action du
héros, alors que la règle validée C12 en garantit au moins 2 080 (800 + 400 + 880). **À confirmer
par le GD.**

### 8. Rendu et animations

- La scène est un seul canevas Skia (`BattleCanvas.tsx`) sous des vues React Native : colonnes
  des ennemis (touchables), boutons, bannière, bulles. Les poses des ennemis (avancée,
  préparation, fausse amorce, frappe) se calculent à chaque image sur le fil UI, depuis l'instant
  présent et les instants nominaux de l'attaque : elles ne dépendent pas du fil JS.
- Avec « réduire les animations » : ni secousse ni éclat plein écran, la bannière apparaît sans
  glissement ; le son et la vibration ne changent pas.
- Sons provisoires générés par `scripts/sounds/battle-sounds.mjs` (WAV de moins de 30 ko, aucune
  licence tierce), préchargés par `expo-audio` ; vibrations par `expo-haptics`, par un port propre
  au combat (`BattleHaptics`). Le Retour haptique (`Haptics`) reste réservé à l'expérience.

### 9. Exclusion de mutation pour le dessin de la scène

Le dessin de la scène (tracés, couleurs, géométrie, poses) porte
`// Stryker disable all: dessin de la scène`, comme les styles (ADR 0001). Sous Jest, Skia reste
limité à son test de fumée : les tests d'écran simulent `BattleScene`. Le reste de l'interface
(états, libellés, datation, gestes) est muté normalement.

### 10. Permissions `WAKE_LOCK` et `ACCESS_NETWORK_STATE`

- L'action de build relève désormais, dans le résumé du job `android-apk`, l'origine de chaque
  permission tirée du rapport de fusion du manifeste de Gradle
  (`manifest-merger-release-report.txt`, `scripts/ci/permission-origins.awk`).
- **Origine prouvée** par le rapport de fusion du job `android-apk` de la PR #53 (exécution
  39781525647, commit `5d2f19c`) :

  | Permission | Origine (rapport de fusion) |
  |---|---|
  | `WAKE_LOCK` | ADDED from `[androidx.media3:media3-exoplayer:1.9.0]`, seulement |
  | `ACCESS_NETWORK_STATE` | ADDED from `[androidx.media3:media3-exoplayer:1.9.0]`, MERGED from `[androidx.media3:media3-common:1.9.0]`, seulement |

  Les autres permissions viennent du manifeste de l'app, d'`expo-file-system`, d'`expo-audio`
  (`MODIFY_AUDIO_SETTINGS`), d'`expo-haptics` (`VIBRATE`) et d'`androidx.core`.
- **Décision : retirées**, par `android.blockedPermissions` dans `app.json` (Expo ajoute
  `tools:node="remove"`). Le combat joue des sons locaux préchargés, sans flux réseau ni lecture
  en arrière-plan : il n'a besoin ni de garder l'appareil éveillé, ni d'observer le réseau.
- **Vérification** : `aapt dump permissions` (résumé du job `android-apk`) ne doit plus les
  lister, et le parcours e2e `trial-battle.yaml`, qui joue les sons du combat, doit passer sans
  plantage. Une `SecurityException` de `media3` annulerait le retrait.

### 11. Renvois

Bibliothèques, versions et alternatives écartées, canal du build, règle de pureté et sonde de
toucher : ADR 0005.

## Mesures

À reporter depuis l'essai du propriétaire (APK de preview de la PR #53), avant le passage au statut
« accepté ».

### Téléphone

| Modèle | Version d'Android | Fréquence d'écran |
|---|---|---|
| _à reporter_ | | |

### Datation des touchers

| Mesure | Sonde au repos (`ascent://preview/touch-probe`) | Combat, sous charge (panneau Mesures) |
|---|---|---|
| Écart toucher → réception JS, médiane | _à reporter_ | _à reporter_ |
| Écart toucher → réception JS, p95 | _à reporter_ | _à reporter_ |
| Méthode retenue | _à reporter_ | _à reporter_ |
| Décalage calibré | _à reporter_ | — |
| Appuis redatés par la garde | — | _à reporter_ |

### Précision mesurée des fenêtres de timing

Distribution des écarts des appuis jugés (panneau Mesures, « Répartition ») : _à reporter_.

### Fluidité des animations

Images perdues pendant les préparations et l'éclat (taux et pire écart) : _à reporter_.

### Réactivité des boutons

Réactivité ressentie par le propriétaire (Parade, Esquive, « Attaquer ») : _à reporter_.

### Latence du son

Médiane et p95 (panneau Mesures) : _à reporter_. Au-delà d'environ 50 ms, le repli
`react-native-audio-api` de l'ADR 0005 est réévalué.

### Taille de l'APK

Build de preview de la PR #53 (job `android-apk`, commit `5d2f19c`) : **93 928 882 octets
(93,9 Mo)**, contre 93 182 802 octets (93,2 Mo) dans l'ADR 0005 : +746 080 octets (+0,8 %),
surtout les sons provisoires et le code du combat. Taille après le retrait des permissions : _à
reporter_.

## Durées retenues

Pour la transition de phase et l'avancée, après l'essai des réglages d'essai par le propriétaire :
**800 ms et 400 ms** (règle C12 validée) tant que l'essai ne dit pas autre chose. Toute autre
valeur change le périmètre validé (#32, #34 et #39 citent ces durées) et repasse par le
propriétaire.

## Décision : poursuivre ou ajuster

_À compléter après l'essai du propriétaire_ : poursuivre l'épique sur ce moteur, ou ajuster les
fenêtres, les durées, la bibliothèque de rendu (repli `react-native-svg`) ou de son (repli
`react-native-audio-api`).

## Conséquences

- **#32** (combat complet : garde, frappe en rythme, Élan, pouvoirs) s'appuie sur le même moteur :
  la frappe en rythme est un nouvel appui daté au toucher, jugé par les mêmes fenêtres. « Pouvoir »
  prend la case de gauche de la zone d'action, laissée vide par #31 ; l'Élan revient dans la barre
  du héros.
- **#34** (pause et réglages de la parade) suspend l'horloge de combat ; le décalage
  (`InputOffset`) est déjà un paramètre du moteur, fixé à 0 ms dans #31.
- Les tests d'écran simulent la scène Skia ; la datation au toucher se prouve par une horloge qui
  avance à chaque étape du geste (ADR 0005, § 2).
