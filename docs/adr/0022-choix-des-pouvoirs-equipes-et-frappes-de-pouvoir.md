# ADR 0022 — Choix des pouvoirs équipés et frappes de pouvoir

- **Statut** : accepté
- **Date** : 7 novembre 2026
- **Décideur** : Architect (notes techniques de #236), écrit par le dev
- **Contexte produit** : épique #232, story #236 « Les frappes de pouvoir et le choix des 3
  pouvoirs équipés »
- **Complète** : [ADR 0019](0019-arbre-de-pouvoirs-et-pouvoirs-equipes.md) et
  [ADR 0021](0021-serment-et-pouvoir-attise.md)

## Contexte

La story #235 a posé l'arbre de pouvoirs, ses 6 pouvoirs lançables et 3 pouvoirs équipés d'office,
dans l'ordre de l'arbre ; les 4 frappes de pouvoir y étaient « Bientôt ». La story #236 les rend
lançables : chacune lance une **frappe en rythme** avec les règles d'« Attaquer », ses propres % de
PV et de Brise-garde et son nombre de coups (PW5). Avec 5 pouvoirs possédés, un héros en a plus que
ses 3 places : le joueur choisit ses pouvoirs équipés au Choix du héros, le pouvoir de base pouvant
rester de côté, et ce choix est mémorisé par héros. Il faut décider où vit cette mémoire, comment le
moteur du combat lit le profil d'une frappe, et ce que veut dire un échec d'enregistrement au
lancement, sans migration et sans changer la règle des autres écritures de l'ascension.

## Décision

1. **D1 — La mémoire des pouvoirs équipés a sa propre clé**, `camp.equippedPowers` :
   `{ "version": 1, "heroes": { "<héros>": [codes] } }`, seulement des codes, par héros ; un héros
   absent n'a pas de mémoire. Elle est lue avec le Camp et les Serments (`CampSession.read`). Une
   valeur illisible, ou une panne de lecture, se lit « aucune mémoire », **sans copie à part** :
   c'est une commodité de présélection, on n'y perd ni Éclat, ni achat, ni Serment. Elle n'est
   écrite qu'au lancement, jamais à « Valider » ; les autres héros gardent la leur ; un choix égal à
   la mémoire ne réécrit rien. Les règles pures sont dans `src/domain/ascent/equippedPowers.ts` :
   - `isEquippedChoice(camp, hero, powers)` : des codes distincts, tous du héros et possédés (son
     pouvoir de base et ses pouvoirs débloqués), au nombre de **min(3, possédés)** ;
   - `preselectedPowers(camp, memory, hero)` : la mémoire si elle est valide (1 à 3 codes
     distincts, du héros, possédés), ses places libres remplies par les autres pouvoirs possédés
     dans l'ordre où il les a eus ; sinon la règle d'office `equippedPowers` (le pouvoir de base,
     puis l'ordre de l'arbre). Les touches et la rangée suivent toujours l'ordre de l'arbre.
2. **D2 — Le profil de frappe dans la phase `heroStrike`** : deux champs facultatifs, `power?`
   (une frappe de pouvoir) et `ambush?` (le ×250 % de Frappe furtive), absents pour « Attaquer ».
   Une seule lecture, `strikeProfile(battle, phase)`, donne les coups, leur écart et les parts de
   PV et de Brise-garde : sans `power`, ceux du héros et 100 / 100 ; avec `power`, ceux de
   `POWERS[power]`, à `POWER_STRIKE_INTERVAL_MS` (300 ms), les coups de la frappe **à la place** des
   Dagues jumelles. Les parts entrent dans `strikeBlow` (un seul arrondi ; G1 s'applique de
   lui-même). Le lancer d'une frappe de pouvoir emprunte une branche à part, **avant**
   `powerEffect` : son Élan (attisé compris), `powerUsed` puis `momentumChanged`, la frappe en
   rythme (`startTimedStrike`, qui consomme Entaille) et l'action du héros (C5.3), **sans** le +1
   Élan d'« Attaquer ». Frappe furtive est jugée au lancer (la cible a encore sa case dans l'ordre
   après le héros) et figée dans la phase : une reprise ne rejuge rien. `isActive` et
   `powerEffect` sont des `switch` exhaustifs, sans `default` : une frappe de pouvoir n'a aucun
   champ dans `HeroState` et n'est jamais `active`. `strikeStarted` et `strikeResolved` portent
   `power?`.
3. **D3 — L'échec d'enregistrement au lancement porte sur l'écriture du choix.** Nouveau cas
   d'usage `CampSession.launchAscent`, qui rend `begun`, `failed` ou `refused` : il valide le choix
   (`isEquippedChoice`) ; pour un vrai choix (4 pouvoirs possédés ou plus) qui change la mémoire, il
   **attend** l'écriture de `camp.equippedPowers`, dont l'échec rend `failed` sans rien commencer ni
   changer la mémoire ; avec 3 pouvoirs possédés ou moins, l'écriture part sans être attendue et son
   échec est ignoré ; puis `beginAscent`, inchangé et synchrone. Un lancement à la fois.
   `AscentSession.begin` et `save` ne changent pas : la première sauvegarde de l'ascension garde sa
   règle (un échec n'arrête pas l'ascension, la suivante réessaie).

## Conséquences

- **Aucune migration** : `SAVE_VERSION`, `CAMP_VERSION` et `OATHS_VERSION` restent à 1. Les 4 codes
  deviennent lisibles d'eux-mêmes dans le Camp, les Serments, l'ascension et le combat. Un combat
  sauvegardé avant #236, ou pendant un « Attaquer », garde son JSON et son comportement.
- `beginAscent` reçoit des pouvoirs facultatifs (la présélection par défaut) et calcule les pouvoirs
  attisés sur ces pouvoirs-là ; `kindledPreview` suit la sélection en cours du Choix du héros.
- Le journal des combats garde sa version : une frappe de pouvoir reste une seule action `power`
  du héros, avec ses appuis sur « Frapper » ; `power` n'y est pas noté.
- Un joueur qui a déjà 3 pouvoirs et achète une frappe avant tout lancement n'a pas de mémoire : la
  règle d'office s'applique, et un de ses pouvoirs peut sortir de la présélection. Il le voit sur la
  carte et peut le changer.
- Rien ne quitte le téléphone.
