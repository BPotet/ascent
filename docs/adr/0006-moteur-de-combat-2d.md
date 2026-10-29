# ADR 0006 — Moteur de combat 2D

- **Statut** : accepté (23 octobre 2026), après le report des mesures du téléphone du
  propriétaire. Proposé le 22 octobre 2026, à l'ouverture de la PR #53. Le budget de latence du son
  est révisé (voir « Décision : poursuivre ou ajuster »).
- **Date** : 22 octobre 2026
- **Décideur** : Architect (notes techniques de #31), avec le dev
- **Contexte produit** : épique #30, story #31 (prototype jouable du combat)
- **Numéro** : fixé au merge ; 0006 si aucun autre ADR n'est mergé avant.
- **Avenant** : 25 octobre 2026, durées internes du combat complet (story #32, voir § 7)
- **Avenant** : 29 octobre 2026, retrait du combat d'essai (story #121, voir « Avenant de #121 »)

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
- **Confirmée sur le téléphone du propriétaire**, sous charge : aux deux essais, le panneau
  Mesures (qui recalcule la méthode par `touchProbeReport`) retient la méthode (a) sur les appuis
  du combat. La sonde au repos n'a pas été lancée sur le téléphone (voir « Mesures »).

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

Décision du propriétaire (22 octobre) : la **double frappe** garde la préparation de base de
1 000 ms du prototype essayé (maquette). C'est la plus courte préparation possible (800 ms après la
variation de ×0,8) : la borne C12 du premier impact d'une phase ennemie est donc de **2 000 ms**
après l'action du héros (800 + 400 + 800).

#### Avenant du 25 octobre 2026 — durées du combat complet (story #32)

La frappe en rythme (C6) et les intentions Garde et Relever (C2) changent les durées de l'action :

- **Attaque** : elle ne dure plus `HERO_ACTION_MS`. Elle va de « Attaquer » à l'impact de la
  frappe (`STRIKE_WIND_UP_MS`, 700 ms), plus la fin de sa fenêtre (160 ms), plus sa récupération
  (`STRIKE_RECOVERY_MS`, 320 ms), soit 1 180 ms sans arrêt sur image ; la transition de phase
  commence ensuite.
- **Pouvoir** : `HERO_ACTION_MS` (500 ms) ne vaut plus que pour un pouvoir (le Rempart).
- **Garde et Relever** : nouvelle durée interne `SUPPORT_ACTION_MS`, 400 ms après l'avancée de
  l'ennemi, avant l'action suivante.
- **Borne C12** : les 2 000 ms du premier impact d'une phase ennemie se mesurent désormais depuis le
  début de la transition de phase (800 + 400 + 800), et non plus depuis « Attaquer ». Le balayage
  de graines le vérifie dans ce sens.

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
- Mode silencieux : sur iOS, il coupe les sons du combat (voulu). Sur Android, le jeu sonne au
  volume Multimédia, même en mode vibreur ou silencieux : `playsInSilentMode` vaut `true` sur
  Android seulement, car avec `false`, `expo-audio` ne joue rien hors du mode sonnerie normal
  (premier essai sur téléphone, en mode vibreur : aucun son).

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
  lister, et le parcours e2e `trial-battle.yaml` (parcours retiré par #121), qui joue les sons du
  combat, doit passer sans plantage. Une `SecurityException` de `media3` annulerait le retrait.
- **Vérifié** sur la PR #53 (exécution 39797532219, commit `839a270`) : `aapt` ne liste plus ni
  `WAKE_LOCK` ni `ACCESS_NETWORK_STATE`, et le parcours e2e (deux combats complets, sons joués)
  passe sans plantage.

### 11. Renvois

Bibliothèques, versions et alternatives écartées, canal du build, règle de pureté et sonde de
toucher : ADR 0005.

## Mesures

Essais du propriétaire sur un téléphone Android réel, relevés dans le panneau Mesures (issue #31) :

- **essai 1** (23 octobre, APK de `e6e5ca7`, mode vibreur, Bluetooth actif) : aucun son, à cause
  de `playsInSilentMode: false` sur Android (§ 8) ;
- **essai 2** (23 octobre, APK de `050dd8d`, mode vibreur) : son fonctionnel. C'est l'essai de
  référence ci-dessous.

### Téléphone

| Modèle | Version d'Android | Fréquence d'écran |
|---|---|---|
| non relevé | non relevé | non relevée |

Le modèle, la version d'Android et la fréquence d'écran n'ont pas été relevés pendant les essais.

### Datation des touchers

| Mesure | Sonde au repos, émulateur (ADR 0005) | Combat, essai 1 (7 appuis) | Combat, essai 2 (5 appuis) |
|---|---|---|---|
| Écart toucher → réception JS, médiane | 0,1 ms | 0,1 ms | 0,1 ms |
| Écart toucher → réception JS, p95 | 0,2 ms | 0,2 ms | 0,1 ms |
| Méthode retenue | **a** | **a** | **a** |
| Décalage calibré | 3,5 ms | — | — |
| Appuis redatés par la garde | — | 0 | 0 |

La sonde au repos n'a pas été lancée sur le téléphone ; la colonne de l'émulateur sert de référence.
Sous la charge du combat, le téléphone retient la méthode (a) aux deux essais, avec des écarts du
même ordre que l'émulateur au repos : la base d'horloge commune est **confirmée**, et
`toBattleInstant` reste sans conversion (§ 3). L'erreur de datation (≤ 0,2 ms) est négligeable devant
les fenêtres de ±60 ms et ±160 ms. Aucun appui n'a été redaté : la garde de 32 ms (§ 4) n'a pas eu à
servir.

### Précision mesurée des fenêtres de timing

Écarts des appuis jugés (panneau Mesures, « Répartition »), 3 appuis à chaque essai :

| Essai | Médiane | p95 | −160 à −61 ms | ±60 ms | 61 à 160 ms |
|---|---|---|---|---|---|
| 1 | 109,5 ms | 117,7 ms | 1 | 0 | 2 |
| 2 | 82,2 ms | 159,9 ms | 1 | 0 | 2 |

Les écarts mesurent le jeu du joueur, pas la technique : ils ne sont pas un critère d'acceptation.
Tous tombent dans la fenêtre de ±160 ms, ce qui montre que les appuis sont jugés et classés.

Indice pour le réglage de la parade (#34) : les 3 écarts jugés à chaque essai sont tous hors de ±60 ms.

### Fluidité des animations

Images perdues (écart entre deux images de plus de 25 ms, `DROPPED_FRAME_MS`) pendant le combat :

| Essai | Images perdues | Taux | Pire écart |
|---|---|---|---|
| 1 | 0 sur 736 | 0 % | 23,5 ms |
| 2 | 1 sur 757 | 0,13 % | 25,8 ms |

**Tient** : une seule image perdue sur 1 493, de 0,8 ms au-dessus du seuil. Les poses calculées sur
le fil UI (§ 8) restent fluides sous la charge du combat.

### Réactivité des boutons

Réactivité ressentie par le propriétaire (Parade, Esquive, « Attaquer ») : non relevée.

### Latence du son

Essai 2 : **médiane 67,5 ms, p95 114,5 ms** (essai 1 : aucune mesure, aucun son). Pour mémoire,
l'émulateur de la CI (lancé sans sortie audio, donc non représentatif) donne 85,7 ms et 254,3 ms.
Au-delà d'environ 50 ms, le repli `react-native-audio-api` de l'ADR 0005 est réévalué.

**Ne tient pas le budget initial** : la médiane dépasse le budget d'environ 50 ms de 17,5 ms, et
le p95 le dépasse de plus du double. La mesure vient d'un seul essai, en mode vibreur, sur un
téléphone dont le modèle n'est pas relevé. Elle va de la demande de lecture jusqu'au moment où le
fil JS apprend que la lecture a commencé : ce n'est pas la latence acoustique, qui ajoute le temps de
sortie du téléphone (davantage avec un casque Bluetooth). Le budget est révisé dans « Décision :
poursuivre ou ajuster ».

### Taille de l'APK

Build de preview de la PR #53 (job `android-apk`, commit `5d2f19c`) : **93 928 882 octets
(93,9 Mo)**, contre 93 182 802 octets (93,2 Mo) dans l'ADR 0005 : +746 080 octets (+0,8 %),
surtout les sons provisoires et le code du combat. Après le retrait des permissions (commit
`839a270`) : **93 928 850 octets**, soit 32 octets de moins.

### Conclusion des mesures

| Budget | Mesure (essai 2) | Verdict |
|---|---|---|
| Datation des touchers, devant les fenêtres de ±60 ms et ±160 ms (méthode a) | p95 0,1 ms, méthode a, 0 appui redaté | tient |
| Images perdues | 1 sur 757 (0,13 %), pire écart 25,8 ms | tient |
| Latence du son ≤ ~50 ms (ADR 0005, budget initial) | médiane 67,5 ms, p95 114,5 ms | ne tient pas |
| Son joué après le jugement : p95 ≤ 125 ms (budget révisé) | p95 114,5 ms, tous sons confondus | tient (condition nécessaire) |
| Sceau : p95 ≤ 125 ms (budget révisé), au moins 1 040 ms avant l'impact | p95 114,5 ms, tous sons confondus | tient (condition nécessaire) |
| Annonce de phase : p95 ≤ 125 ms (budget révisé) | p95 114,5 ms, tous sons confondus | tient (condition nécessaire) |

Le panneau Mesures donne une seule latence pour tous les sons : chaque ligne du son la reprend.
Le budget révisé et ce qui le rend « nécessaire, pas suffisant » sont dans « Décision : poursuivre
ou ajuster ».

Le moteur, la datation au toucher et le rendu tiennent leurs budgets. La latence du son dépasse le
budget initial, ce qui imposait de réévaluer le repli `react-native-audio-api`. Cette réévaluation
est faite dans « Décision : poursuivre ou ajuster ». Restent à relever, au prochain essai sur le
téléphone : son modèle, sa version d'Android et sa fréquence d'écran.

## Durées retenues

Pour la transition de phase et l'avancée, après l'essai des réglages d'essai par le propriétaire :
**800 ms et 400 ms** (règle C12 validée) tant que l'essai ne dit pas autre chose. Toute autre
valeur change le périmètre validé (#32, #34 et #39 citent ces durées) et repasse par le
propriétaire.

### Avenant de #121 : retrait du combat d'essai

Décision du propriétaire du 28 octobre 2026 (#118, #121) : le combat d'essai est retiré, et tous
les combats passent par l'ascension.

- **Les durées sont des constantes du domaine** : `PHASE_TRANSITION_MS = 800` (transition de
  phase) et `STEP_IN_MS = 400` (avancée), dans `src/domain/battle/Battle.ts`. Le combat ne porte
  plus de réglages (`Battle.tuning` disparaît). Un combat sauvegardé qui garde un champ `tuning`
  reprend à 800 et 400 ms par construction ; la clé `battle.trialTuning` déjà enregistrée sur un
  téléphone n'est plus lue ni écrite. Pas de migration.
- **Les réglages d'essai et le panneau Mesures sont retirés**, avec l'écran de fin du combat
  d'essai.
- **Les mesures de datation sur téléphone passent désormais par la sonde de toucher** (ADR 0005),
  qui reste dans le build de preview.
- **Les chiffres déjà consignés ici restent la référence** : ils ne sont pas refaits.

## Décision : poursuivre ou ajuster

Décision de l'Architect (23 octobre 2026) : **poursuivre l'épique sur ce moteur**, sans changer les
fenêtres, les durées ni le rendu Skia (repli `react-native-svg` écarté : 1 image perdue sur 757).
**Garder `expo-audio`** et réviser le budget de latence du son, en connaissance de cause. Le repli
`react-native-audio-api` n'est pas essayé pour l'instant.

### Pourquoi la latence mesurée est acceptable

- **Le son n'entre pas dans le jugement.** La parade est jugée sur l'instant du toucher, daté sur le
  fil UI (§ 2 et 3). La latence du son ne change ni l'écart ni le résultat d'un appui.
- **Aucun son de #31 ne sert de repère de timing.** Les repères de l'impact sont visuels : l'avancée,
  la préparation (fausse amorce comprise) et la frappe de l'ennemi (§ 8). L'éclat qui suit le
  jugement n'est pas un repère. Un repère de timing supplémentaire est à l'étude côté UX, non
  validé. Les sons de #31 sont de trois sortes :
  - **joués après le jugement** : parade, parade parfaite, esquive, coup reçu, coup dans le vide,
    fin du combat ;
  - **le sceau**, joué au début de la préparation d'un coup imparable, au moins 1 040 ms avant
    l'impact (1 300 ms × 0,8) : il double le losange du sceau et laisse le temps de choisir
    l'esquive, il ne date pas l'impact ;
  - **l'annonce de phase**, jouée au début de la transition de phase de 800 ms, avec sa bannière.

  Aucun ne précède l'impact pour en donner l'instant : rien n'est à anticiper dans #31.
- **Un son en retard sur l'image reste lié à elle.** La recommandation ITU-R BT.1359-1 fixe, pour
  un son en retard sur l'image, le seuil de détectabilité à −125 ms et le seuil d'acceptabilité à
  −185 ms. Chaque son de #31 accompagne une image (résultat de l'appui, sceau, bannière) : c'est le
  bon repère pour tous.
- **Le repli a un coût réel, pour un gain incertain.** `react-native-audio-api` est un module natif
  de plus, moins mûr (ADR 0005) : il ajoute du build, une surface de risque et des setups de test.
  Avec une seule mesure, prise sur un seul téléphone, rien ne garantit qu'il fasse mieux sur ce
  téléphone.

### Budget révisé du son

Un seul budget pour tous les sons de #31 (joués après le jugement, sceau, annonce de phase) :
**p95 ≤ 125 ms** au panneau Mesures, tous sons confondus. La cible de ~50 ms de l'ADR 0005 reste
souhaitable, mais n'est plus un critère.

- **Condition nécessaire, pas suffisante.** La mesure s'arrête au moment où le fil JS apprend que
  la lecture a commencé : elle ne compte pas la sortie audio du téléphone. Au p95 de l'essai 2
  (114,5 ms), il reste environ 10 ms avant le seuil de détectabilité, que la sortie audio peut
  consommer. Il en reste environ 70 ms avant le seuil d'acceptabilité (−185 ms) : un retard
  remarqué au p95 resterait acceptable.
- **Bluetooth : hors budget.** Une sortie Bluetooth ajoute un retard que l'app ne mesure pas et
  que `expo-audio` ne donne pas ; il varie selon le casque et le codec. Le jeu ne le compense pas.
  Il reste entièrement jouable, puisque tous les repères de timing sont visuels et que le jugement
  se fait au toucher ; seul le son arrive plus tard. L'essai 1, Bluetooth actif, n'a donné aucune
  mesure de son (§ 8) : le budget est jugé sur l'essai 2, sortie sur le téléphone.

### Sons qui annoncent l'instant d'un appui (à partir de #32)

Un son sur lequel le joueur cale son appui, par exemple un son qui annonce l'impact de la frappe en
rythme de #32, est **lancé en avance de la latence attendue**. Il n'est jamais joué « à
l'événement ».

- **Quand l'instant est connu.** Celui d'un impact ennemi l'est au plus tard au début de sa
  préparation, dont la durée est tirée au début de la manche (§ 6) ; un arrêt sur image le décale
  ensuite de 90 ms (§ 5), et le son programmé est alors reprogrammé. Celui de l'impact de la frappe en rythme ne l'est qu'au déclenchement de la frappe : il tombe
  700 ms plus tard (préparation fixe, C6). La session de combat programme alors le son à l'impact
  moins la latence attendue, par le port `BattleClock`, comme les autres échéances (§ 1). 700 ms
  laissent largement la place à une avance d'une centaine de millisecondes.
- **D'où vient la latence attendue : une mesure à l'exécution, fournie par un port.** Le port
  `BattleSound` donne la latence attendue, médiane des latences qu'il a mesurées sur ce téléphone
  (`ExpoAudioBattleSound` les relève déjà). Tant qu'il n'a pas assez de mesures, il donne la
  médiane de l'essai 2 (67,5 ms). Une constante unique serait fausse sur les autres téléphones :
  la latence audio varie beaucoup d'un appareil Android à l'autre, et la nôtre ne vient que d'un
  seul. Le domaine et l'application restent purs : la valeur entre par un port. Le nombre de
  mesures requis et le nom de la méthode sont fixés dans les notes techniques de #32.
- **Le décalage ne suffit pas.** Le décalage (`InputOffset`, C7, réglé dans #34) corrige l'instant
  des appuis pour les juger : il décalerait aussi le jugement face aux repères visuels, qui n'ont
  pas ce retard. Il reste le réglage du joueur, pas la compensation du son.

### Ce qui rouvrirait la décision

Le repli `react-native-audio-api` serait alors essayé dans un spike dédié :

- une nouvelle mesure au-delà de 125 ms au p95, sur le téléphone du propriétaire ou un autre ;
- une latence trop variable pour qu'une avance fixe cale les sons qui annoncent un appui, à juger
  sur l'écart entre la médiane et le p95 dès que #32 en introduit ;
- un retour du propriétaire à l'essai : un son qui lui semble en retard sur l'image.

## Conséquences

- **#32** (combat complet : garde, frappe en rythme, Élan, pouvoirs) s'appuie sur le même moteur :
  la frappe en rythme est un nouvel appui daté au toucher, jugé par les mêmes fenêtres. « Pouvoir »
  prend la case de gauche de la zone d'action, laissée vide par #31 ; l'Élan revient dans la barre
  du héros. Un son qui annonce l'impact de la frappe en rythme est lancé en avance de la latence
  attendue, donnée par le port `BattleSound` (voir la décision). L'essai de #32 sur le téléphone relève à nouveau la latence du son,
  avec le modèle du téléphone, sa version d'Android, sa fréquence d'écran et l'état du Bluetooth.
- **#34** (pause et réglages de la parade) suspend l'horloge de combat ; le décalage
  (`InputOffset`) est déjà un paramètre du moteur, fixé à 0 ms dans #31.
- Les tests d'écran simulent la scène Skia ; la datation au toucher se prouve par une horloge qui
  avance à chaque étape du geste (ADR 0005, § 2).
