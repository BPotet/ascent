# ADR 0026 — Menu des pouvoirs et mémoire écrite à « Valider »

- **Statut** : accepté
- **Date** : 10 novembre 2026
- **Décideur** : Architect (notes techniques de #270), écrit par le dev
- **Contexte produit** : épique #269, story #270 « Le menu des pouvoirs : préparer ses pouvoirs
  équipés au pied de la tour »
- **Amende** : [ADR 0022](0022-choix-des-pouvoirs-equipes-et-frappes-de-pouvoir.md) D1 (la mémoire
  est aussi écrite à « Valider ») et [ADR 0017](0017-camp-et-eclats-disponibles.md) (clés voisines)

## Contexte

Avec #236, le joueur choisit ses 3 pouvoirs équipés dans un panneau ouvert par un bouton secondaire
du Choix du héros, et ce choix n'est mémorisé qu'au lancement. Le propriétaire veut préparer ses
pouvoirs **au pied de la tour**, dans un menu à lui, avant chaque ascension (décisions du
09/11/2026) : accès par une carte « Pouvoirs équipés » sous la jauge, choix enregistré dès
« Valider », un lien discret « Changer les pouvoirs » au Choix du héros. Les règles des pouvoirs
équipés ne changent pas. Il faut décider la forme du menu, le moment et le verrou de l'écriture de
la mémoire, la place des marques « nouveau », la vibration d'un refus, et ce que devient le Choix du
héros, sans migration.

## Décision

1. **D1 — Le menu des pouvoirs (`PowersMenu`) est un écran poussé**, pas une feuille : la route
   `src/app/powers-menu.tsx`, réservée au build de preview comme `/camp` et `/power-tree`. Elle
   reçoit `hero` (l'onglet ouvert) et `from` (`tower` par défaut, ou `choice`), qui nomme le retour
   (« Retour au pied de la tour » ou « Retour au Choix du héros », M13). Le retour et un « Valider »
   réussi font `router.back()` (sinon `router.replace('/tower')`). Le Choix du héros est un état du
   pied de la tour, dont l'onglet reste monté sous la pile : après H2 puis M13, le retour ramène au
   Choix du héros intact. Depuis le bandeau de l'arbre (D1 de la maquette) :
   `router.dismissTo('/tower')` puis `router.push('/powers-menu')`, et le retour ramène au pied de la
   tour.
2. **D2 — La mémoire est écrite à « Valider », pour les deux héros, en une seule écriture
   attendue.** `CampSession.equipPowers(choice)` rend `equipped`, `failed` ou `refused`.
   - `refused` : le Camp n'est pas lu, une ascension est en cours (M10), un des deux choix n'est pas
     un `isEquippedChoice`, ou une écriture de la mémoire est déjà en cours.
   - Un choix égal à la mémoire des deux héros rend `equipped` sans rien écrire.
   - Sinon, l'écriture de `camp.equippedPowers` (les deux héros, dans l'ordre de l'arbre) est
     attendue ; son échec rend `failed`, sans changer ni la mémoire ni la vue (M7). Après un succès,
     la mémoire change, `equippedRevision` augmente (T5) et la vue est publiée.
   - Un héros à 3 pouvoirs ou moins est mémorisé lui aussi : son prochain déblocage remplit la
     place libre (M8) au lieu de retomber sur la règle d'office.
   - **Un seul verrou** pour la mémoire (`writingMemory`) : « Valider » et un lancement n'écrivent
     jamais `camp.equippedPowers` en même temps, testé dans les deux sens. L'écriture non attendue
     d'un lancement à 3 pouvoirs ou moins ne pose pas ce verrou : l'ascension commence aussitôt, et
     un « Valider » est alors refusé (ascension en cours).
   - `launchAscent` ne change pas (ADR 0022 D3) : après un « Valider », le choix lancé égale la
     mémoire, rien n'est écrit et le lancement ne peut plus échouer pour ça.
3. **D3 — Les marques « nouveau » ont leurs propres clés**, des commodités : illisibles ou en
   panne, leur valeur par défaut, sans copie à part ; leurs écritures ne sont pas attendues et leur
   échec est ignoré, comme `camp.powerTrees.seen`.
   - `camp.newPowers` = `{ "version": 1, "powers": [codes] }` : les **pouvoirs nouveaux**
     (`NewPower`), débloqués dans l'arbre et pas encore vus dans le menu. `unlockPower` y ajoute le
     code **après** l'écriture attendue de `camp.unlocks`. Absente, la liste est vide. Un code
     inconnu, un doublon ou un pouvoir de base est ignoré ; un pouvoir que le Camp n'a pas aussi.
   - `camp.powersMenu.seen` = `'1'` : le menu a été ouvert (M12). `camp.powersCard.seen` = `'1'` :
     la carte a été vue (T8).
   - `markPowersMenuSeen()` vide les pouvoirs nouveaux et pose le drapeau du menu, **sauf pendant
     une ascension** : le menu y est en lecture seule, et un pouvoir débloqué en cours d'ascension
     reste nouveau pour la suivante. `markPowersCardSeen()` pose le drapeau de la carte.
   - Les écrans **figent** à leur ouverture ce qu'ils montrent (pouvoirs nouveaux, première
     ouverture, première visite), puis marquent : « nouveau » reste affiché pendant cette visite.
   - La vue du camp porte `newPowers` (par héros : `autoEquipped`, équipés tout seuls, et `waiting`,
     en attente d'une place, selon `newPowerStanding`), `powersMenuSeen`, `powersCardSeen` et
     `equippedRevision`.
4. **D4 — Le brouillon du menu vit dans l'écran, ses règles dans le domaine** :
   `toggleEquippedPower(camp, hero, draft, power)` (un pouvoir coché se décoche, pouvoir de base
   compris ; un pouvoir non coché se coche s'il reste une place ; sinon un refus, le brouillon
   inchangé), exposée par `CampSession.toggleEquippedPower(hero, draft, power)`. Le retour jette le
   brouillon sans rien écrire. `kindledPreview` reçoit le brouillon : un pouvoir décoché n'est jamais
   attisé (M6).
5. **D5 — La vibration de refus passe par un nouveau port**, `RefusalHaptics { refusal(): void }`
   (`src/application/ports/RefusalHaptics.ts`), sans toucher `Haptics` (16 doublures et le type
   `Dependencies`) ni `BattleHaptics` (story sœur #271). `ExpoHaptics` l'implémente : une impulsion
   courte `Rigid`, distincte de la réussite, qui ne lève jamais d'erreur. La route crée l'adaptateur
   et le passe à l'écran sous le type du port.
6. **D6 — Le Choix du héros ne fait plus que résumer.** Le bouton « Changer les pouvoirs », le
   panneau des pouvoirs équipés et la sélection locale du pied de la tour disparaissent ; la
   sélection lancée est la présélection du camp, qui contient le choix validé. Le lien discret
   « Changer les pouvoirs » (48 dp, pour le héros choisi à partir de 4 pouvoirs) ouvre le menu sur
   son onglet. H3 (braise et Serment) et H4 (échec au lancement, « Réessayer ») ne changent pas.

## Conséquences

- **Aucune migration** : pas de table, pas de schéma. `camp.equippedPowers` garde sa version 1 ; le
  choix fait au Choix du héros et lancé avant la mise à jour reste la présélection (T8).
  `CAMP_VERSION`, `OATHS_VERSION` et `SAVE_VERSION` ne changent pas. Les trois clés nouvelles sont
  facultatives.
- Le pied de la tour montre ses actions dès la session d'ascension lue (T7) : la carte est un bloc
  gris et « Commencer l'ascension » reste inactif tant que la jauge ou le camp n'est pas lu ; une
  ascension en cours attend le camp comme avant.
- Aucun son nouveau à « Valider » (pas de donnée d'Atelier) : le « petit clic » de la maquette (T5)
  est à confirmer sur l'APK.
- Pendant une ascension, l'onglet de l'autre héros montre sa présélection marquée « Fixé », comme
  la maquette.
- Rien ne quitte le téléphone.
