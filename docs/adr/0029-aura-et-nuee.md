# ADR 0029 — Aura et Nuée

- **Statut** : accepté
- **Date** : 12 novembre 2026
- **Décideur** : Architect (notes techniques de #268), écrit par le dev
- **Contexte produit** : épique #246, story #268 « Les Catacombes : l'Aura du Porte-cierge et la
  Nuée des Rats de crypte »
- **Complète** : [ADR 0010](0010-contenu-recopie-de-l-atelier.md) (copie de l'Atelier),
  [ADR 0016](0016-journal-des-combats.md) (avenant du 12 novembre 2026, #268),
  [ADR 0018](0018-ennemis-maudits.md) (la formule de la malédiction) et
  [ADR 0027](0027-balayage-et-charge.md) (signature d'un ennemi ordinaire, une bulle par combat)

## Contexte

Les Catacombes reçoivent deux ennemis ordinaires. Le **Porte-cierge** donne son **Aura** à ses
alliés : +20 % de dégâts, au moins +1, par impact, tant qu'il vit, étourdi compris (AU1 à AU6 du
Game Designer, AU5 selon la décision du propriétaire du 9 novembre 2026). Les **Rats de crypte**,
jusqu'à 3 par groupe, frappent plus fort en **Nuée** : +2 par impact et par autre Rat de crypte
debout, non étourdi, en première ligne (NU1 à NU3, décision du propriétaire). Ce sont les premières
mécaniques d'un ennemi qui changent les coups d'un **autre**.

## Décisions

1. **Lues au début de la préparation, jamais au tirage (D1).** `drawIntent` ne change pas : les
   intentions tirées, et les marches figées du palier 1, gardent les dégâts « Codex → palier →
   malédiction ». Le bonus se calcule dans `startAttack`, sur `intent.damage`, et vaut pour tous les
   impacts du coup : `AttackStep.damage` porte les dégâts finaux, que `sufferImpact` et
   `judgeDefense` relisent déjà. Une chute du Porte-cierge entre les deux impacts d'une double
   frappe ne change donc pas le 2ᵉ (AU2).
2. **Ordre de calcul (D2, AU3)** : `intent.damage` → **+ Nuée** (`damagePerAlly` × les autres Rats,
   sans multiplicateur, NU2) → **Aura** (`v + max(1, ⌊v × damagePercent / 100⌋)`). La formule
   commune est `boostByPercent` (`tierMultiplier.ts`) ; `cursedValue` en est le cas à 20 % : une
   seule formule. Un test fixe l'ordre sur une valeur où il compte (8 + 2 = 10, puis 12 ; dans
   l'autre ordre, 11).
3. **Qui compte (D3).** « Première ligne » est `battle.enemies` : la réserve n'y est pas (AU6, NU3
   sans code) ; invoqués, exhumés, relevés et renforts y sont, donc comptent. **Aura** : un **autre**
   ennemi debout (`hp > 0`) dont le profil a `aura`, étourdi ou non (AU5) ; une seule application
   même si deux existaient (AU4). **Nuée** : les autres ennemis de même nom de code, debout et
   `stun === null`.
4. **Règles pures (D4)**, dans `aura.ts` et `swarm.ts`, sur des types structurels comme
   `sanctuary.ts`, sans importer `Battle.ts` : `auraBearer(line, index)`, `auraAlone(line,
   reserve, index)` (seul debout, la réserve vide : « Aura · seul »), `swarmBonus(line, index)` et
   `boostedDamage(line, index, damage)`. Ce sont aussi les lectures de l'interface (le « +20 % »
   des alliés, la lueur, la marque grisée, le grouillement) : l'interface ne refait aucune règle.
5. **Trace dans les événements (D5).** `windUpStarted` et `AttackStep` reçoivent `swarm?` et
   `aura?`, les points ajoutés par impact à chaque étape, absents à 0 : le JSON des autres combats
   ne change pas. `blowResolved` reçoit aussi `aura?`, recopié du coup : la flamme du chiffre de
   dégâts et l'annonce « …, aura du Porte-cierge » se lisent sur l'impact jugé, même quand le coup
   est déjà fini dans l'état du combat (écart aux notes techniques, qui ne le prévoyaient que sur
   `windUpStarted`).
6. **Le Porte-cierge n'est pas un soutien (D6).** `supports: false`, et `neverAlone: true` sur son
   entrée de `TIERS[1].enemies` : `neverAlone` ne sert qu'au filtre des groupes d'un ennemi de
   `drawGroup`. Il peut donc être **ennemi maudit** et entre dans le vivier d'escorte du palier 1
   (sans effet : escorte 0). Un groupe Nécromancien + Porte-cierge devient possible.
7. **Pas de signature pour le Rat (D7)**, décision du propriétaire : `enemySignature` reçoit
   `'aura'` seulement ; la Nuée n'en donne pas. Le Porte-cierge a la bulle de première rencontre
   d'un ennemi ordinaire (règle de l'ADR 0027).
8. **Sons propres à un ennemi.** La bougie soufflée (`candleSnuff`, 200 ms après la chute d'un
   Porte-cierge quand un autre ennemi est debout) et le couinement (`ratSqueak`, à l'avancée d'un
   Rat de crypte) dépendent du nom de code : `feedbacksFor(events, before, after)` lit le nom de code
   dans le combat d'avant la mise à jour, suivi au fil des entrées (renfort, invoqué, exhumé), et
   les ennemis debout dans celui d'après. La règle reste dans l'application.
9. **Place dans la ligne**, pour les **Rats de crypte seulement** (décision de l'orchestrateur du
   12 novembre 2026) : quand au moins deux sont debout, le lecteur d'écran dit « à gauche », « au
   centre », « à droite ». Les autres ennemis ne changent pas.

## Conséquences

- **Aucune migration** : `SAVE_VERSION` reste 1. Aucun état nouveau : l'Aura et la Nuée se lisent
  de la ligne au début de chaque préparation ; `AttackStep.aura` et `swarm` sont facultatifs. Une
  nouvelle clé de bulle (`battle.hint.encounter.candleBearer.seen`), sans migration.
- Toute nouvelle façon de commencer un coup ennemi doit passer par `startAttack`, sinon ni l'Aura
  ni la Nuée ne s'y appliqueraient.
- **Marches figées du palier 1** : le poids total de la liste passe de 11 à 14. Les compositions
  des combats ordinaires sont régénérées avec `tierOneWalk.ts`, jamais la graine ; le contrôle par
  jeton (chaque segment de combat ordinaire remplacé par un jeton) garde les 200 marches identiques
  à celles d'avant. Le scénario « Une même graine garde la même ascension » le rejoue à chaque
  exécution avec la liste d'avant.
- La liste fermée des effets de l'Équilibrage de l'Atelier (`aura`, `swarm`) est hors du dépôt, à
  la charge de l'orchestrateur.
- **`BATTLE_LOG_FORMAT_VERSION` reste 2** (avenant à l'ADR 0016).
