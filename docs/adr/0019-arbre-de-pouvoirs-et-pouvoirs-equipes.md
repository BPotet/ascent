# ADR 0019 — Arbre de pouvoirs et pouvoirs équipés

- **Statut** : accepté
- **Date** : 6 novembre 2026
- **Décideur** : Architect (notes techniques de #235), écrit par le dev
- **Contexte produit** : épique #232, story #235 « L'arbre de pouvoirs au Camp et les pouvoirs
  équipés en combat »
- **Complète** : [ADR 0017](0017-camp-et-eclats-disponibles.md) (avenant du 6 novembre 2026)

## Contexte

Jusqu'ici, chaque héros n'avait qu'un pouvoir, porté par son profil (`HeroProfile.power`, avec
`powerInstant`) : le Rempart pour la Sentinelle, Pas de l'ombre pour l'Errante. La story #235 donne
à chaque héros un **arbre de pouvoirs** au Camp, où des pouvoirs se débloquent avec les **Éclats
disponibles**, et 1 à 3 **pouvoirs équipés** en combat, une touche chacun. Deux stories suivent :
les frappes de pouvoir (#236) et le Serment (#237). Il faut décider où vivent les pouvoirs, leurs
règles de disponibilité, où se gardent les pouvoirs débloqués et ceux d'une ascension, et comment
relire les sauvegardes d'avant sans migration.

## Décision

1. **Un registre des pouvoirs par code** (`src/domain/battle/powers.ts`) : `PowerKind` (6 codes :
   `bulwark`, `retaliation`, `holdFast`, `shadowStep`, `rend`, `mist`) et `POWERS`, un profil par
   code recopié des fiches du Codex (héros, ordre de l'arbre, coût, instantané, à charge, une fois
   par combat, paramètres d'effet). L'instantané est une propriété du pouvoir, plus du héros :
   `HeroProfile.power` devient `basePower` et `powerInstant` disparaît. `HeroProfile` n'est jamais
   sauvegardé : aucune donnée stockée ne change.
2. **Le combat porte ses pouvoirs équipés** : `BattleOptions.powers?`, `Battle.powers?`, posé
   seulement s'il est donné. Absent, `equippedOf(battle)` donne `[pouvoir de base]` : un combat
   sauvegardé avant #235, le combat d'essai et les fixtures gardent leur forme et leur JSON.
3. **`powerAvailability(battle, power)` est la seule règle de disponibilité**, lue par `heroAction`
   et par l'interface, dans cet ordre : `notEquipped`, `usedThisBattle`, `active`, `instantUsed`
   (un seul pouvoir instantané par phase du héros, le drapeau `phase.instantPowerUsed` de #173
   généralisé), `missing`, `available`. Tout coût passe par `powerCost(battle, power)` (#237 y
   ajoutera le pouvoir attisé). Un pouvoir à charge actif est `active` : **le Rempart actif ne se
   relance plus** (PW3, K7, décision de l'orchestrateur du 06/11/2026).
4. **Les charges vivent dans `HeroState`**, en champs facultatifs absents tant qu'ils ne servent
   pas (`retaliation?`, `mist?`, `rend?`, `spent?`), comme `shadowStep?`. Chaque combat part d'un
   `startBattle` neuf : elles sont perdues en fin de combat sans code. La frappe en rythme part de
   `startTimedStrike`, qui consomme Entaille ; #236 y lancera ses frappes de pouvoir.
5. **Les pouvoirs débloqués vivent dans le Camp**, dans la même clé `camp.unlocks` que les
   Déblocages (champ `powers`, `{ power, price }`) : un achat reste une seule écriture, donc tout ou
   rien, et les deux partagent les mêmes Éclats par construction. Prix : 30 au rang 1, 60 au rang 2,
   jamais touchés par la jauge. L'arbre (`src/domain/ascent/powerTree.ts`) donne l'état de chaque
   nœud (`powerNodeState`), dont « Bientôt » pour les frappes de pouvoir, avant le verrou.
6. **Les pouvoirs équipés sont figés dans l'ascension** (`Ascent.powers`), au lancement, par le
   seul chemin `CampSession.beginAscent` (`equippedPowers(camp, hero)` : le pouvoir de base puis
   les pouvoirs débloqués, dans l'ordre de l'arbre, 3 au plus). Un pouvoir débloqué pendant une
   ascension compte dès la suivante ; une reprise ne recalcule rien. `startAscent` ne tire rien de
   plus : la marche du palier 1 est inchangée.
7. **Défauts des sauvegardes, sans migration** (`SAVE_VERSION` 1, `CAMP_VERSION` 1) : un Camp sans
   `powers` n'a aucun pouvoir débloqué ; une ascension sans `powers` a son pouvoir de base seul,
   calculé dans `AscentSession.parse` après la fusion, comme `rerolls` ; un combat sans `powers` a
   son pouvoir de base seul.

## Conséquences

- Les deux journaux gardent leur version : `powers?` n'y est écrit que s'il diffère du pouvoir de
  base seul (avenants des ADR 0014 et 0016).
- Une valeur illisible de `camp.unlocks` perd aussi les pouvoirs débloqués, mais elle est recopiée à
  part et leurs Éclats redeviennent disponibles (risque déjà accepté par l'ADR 0017).
- #236 ajoute ses 4 codes au registre et vide `SOON_POWERS` ; #237 ne touche qu'à `powerCost` et à
  une clé à part (`camp.oaths`). La mémoire des pouvoirs équipés de #236 aura sa propre clé
  (`camp.equippedPowers`), pour qu'un achat et un lancement n'écrivent jamais la même clé.
- Rien ne quitte le téléphone.

## Avenant du 7 novembre 2026 — le pouvoir attisé (#237, ADR 0021)

- `powerCost(battle, power)` vaut `kindledCost(power)` (1 Élan de moins, au moins 1) quand
  `battle.kindled` contient le pouvoir, sinon `POWERS[power].cost`. C'est le seul changement de la
  règle du coût : `powerAvailability` (« Il manque n Élan ») et `activatePower` la lisent déjà.
- `BattleOptions.kindled?` et `Battle.kindled?` (des codes de pouvoir), posés seulement s'ils ne
  sont pas vides ; `battleSession` passe `kindledOf(ascent)`.
- Les textes de l'interface ne lisent plus `POWERS[power].cost` pour un coût en combat : ils
  reçoivent le coût du `PowerSlot` (`cost`, et `baseCost` pour un attisé).

## Avenant du 7 novembre 2026 — les frappes de pouvoir et le choix (#236, ADR 0022)

- Le registre reçoit les 4 frappes de pouvoir (`shieldBash`, `crushingBlow`, `flurry`, `ambush`) ;
  `SOON_POWERS`, `SoonPower`, l'état `soon` et `PowerTreeCode` disparaissent : un nœud de l'arbre
  est un `PowerKind`.
- `equippedPowers(camp, hero)` reste la règle d'office, sans changement ; elle ne sert plus que de
  présélection sans mémoire valide. Le choix parmi 4 pouvoirs ou plus, sa mémoire
  (`camp.equippedPowers`) et le lancement sont décrits dans l'[ADR 0022](0022-choix-des-pouvoirs-equipes-et-frappes-de-pouvoir.md).
