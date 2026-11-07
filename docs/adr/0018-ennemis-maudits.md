# ADR 0018 — Ennemis maudits

- **Statut** : accepté
- **Avenant** : 7 novembre 2026, l'Élite maudite (#244), voir en fin de document
- **Date** : 5 novembre 2026
- **Décideur** : Architect (notes techniques de #209), écrit par le dev
- **Contexte produit** : épique #205, story #209 « La malédiction rend des ennemis maudits »

## Contexte

Le propriétaire a décidé le 04/11/2026 que la **malédiction** de l'ascension rend des **ennemis
maudits** : un par combat ordinaire à −1 et à −2, l'Élite en plus à −2, jamais le boss. Un ennemi
maudit n'a que des caractéristiques plus fortes (+20 % de PV max, de garde max et de dégâts), sans
coup, trait, intention ni récompense de plus. Il faut décider où ce tirage se fait, où l'état est
gardé, et comment le bonus se combine avec le **multiplicateur de palier**, sans changer les
tirages d'une ascension sans malédiction.

## Décision

1. **Le tirage fait partie du combat d'étage.** `combat` (`src/domain/ascent/Ascent.ts`) tire, sur
   `ascent.random` et dans cet ordre : le groupe, **puis l'ennemi maudit si la jauge vaut −1 ou
   moins**, puis la graine du combat. Cela vaut pour `startAscent`, la porte Combat (`chooseExit`)
   et `enterNextTier`. À 0, +1 et +2, aucun tirage de plus : les tirages restent ceux d'avant
   (`tierOne.unchanged.test.ts`). Le flux du butin et des bienfaits (`lootRandom`) n'est pas touché.
2. **Lequel** : `drawCursedEnemy` (`src/domain/ascent/cursedEnemy.ts`) tire un indice à égalité
   parmi la première ligne (`index < FRONT_LINE_SIZE`), jamais un soutien. Chaque palier n'a qu'un
   soutien, au plafond de 1 et jamais seul : toute première ligne a un candidat (un test le garde).
3. **L'Élite maudite**, à −2 seulement, est l'indice 0, **sans tirage**. Le boss ne l'est jamais.
4. **L'état** : `Encounter.cursed?: number`, l'indice de l'ennemi maudit dans le combat d'étage, et
   `EnemyState.cursed?: true` dans le combat. Les deux sont facultatifs : une sauvegarde d'avant se
   relit sans ennemi maudit. **Aucune migration**, `SAVE_VERSION` reste 1. Le journal d'ascension
   (`AscentLog.ts`) ne change pas : le journal des combats garde déjà les PV max de chaque ennemi.
5. **Le bonus** (`src/domain/battle/curse.ts`) : `cursedValue(v) = v + max(1, ⌊v × 20 / 100⌋)`, en
   entiers (`scaleByPercent`), appliqué **après** le multiplicateur de palier aux PV max et à la
   garde max (`freshEnemy`), et aux dégâts de chaque coup tirés par l'intention (`drawIntent`).
   L'Élite, jamais multipliée, part des valeurs du Codex. Le **Saignement** et la **Brûlure** ne
   changent pas : ce ne sont pas des coups. L'**Initiative** ne change pas. La garde de l'intention
   Garde, le changement de phase et les relèves lisent déjà la garde max et les PV max de l'ennemi :
   ils suivent les valeurs maudites sans code de plus.
6. **Seuls les ennemis de départ** de `startBattle` peuvent être maudits (`BattleOptions.cursed`).
   Un renfort (`reinforce`) ou un invoqué (`summonEnter`) ne l'est jamais. Un ennemi relevé garde
   `cursed` : la relève étale son état.

## Conséquences

- Une ascension à −1 ou −2 fait un tirage de plus par combat ordinaire, ce qui décale les tirages
  qui suivent sur `ascent.random`. C'est voulu ; une ascension en cours au déploiement garde son
  combat déjà tiré, sans ennemi maudit, et tire les suivants.
- L'interface nomme l'ennemi maudit par une seule fonction (`enemyName`, « Goule maudite »), et son
  étiquette « Maudit » s'ajoute à « Relevé » ou « Invoqué » sans la remplacer.
- Rien ne quitte le téléphone ; aucune donnée d'habitude n'entre dans l'ascension.

## Avenant du 7 novembre 2026 — l'Élite maudite (#244)

L'Élite maudite part de la valeur multipliée par le multiplicateur d'Élite et de boss de son palier
(ADR 0020), comme un ennemi ordinaire part de la valeur du palier : Premier Pèlerin maudit 364 →
436 PV, garde 82 → 98.
