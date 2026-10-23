# ADR 0003 — Réglages de la semaine

- **Statut** : accepté
- **Date** : 21 octobre 2026
- **Révisé** : 22 octobre 2026, §4 corrigé par #24 (décisions PM Q-A et cas limite 2) ; §2 complété et
  §6 ajouté par #26 (prime d'objectif, rattrapage)
- **Décideur** : Architect (décisions de l'escalade d'impact de #23 avec le PM)
- **Contexte produit** : épique #22 (story #23, préparation de #24 et #26)
- **Remplace** : la décision 5 de l'ADR 0002 pour l'invariant de l'expérience

## Contexte

L'épique #22 donne à chaque habitude des **réglages** qui changent l'expérience gagnée : la
**difficulté** (#23 : Facile 5 Xp, Moyenne 10 Xp, Difficile 20 Xp par case « fait »), puis
l'**objectif hebdomadaire** (#24) et la **prime d'objectif** (#26). Les règles du Game Designer
imposent :

- R12 : un changement de difficulté s'applique à toute la semaine en cours (ses cases « fait » sont
  réévaluées) et aux suivantes, jamais aux semaines closes ;
- R14 : une correction d'un jour d'une semaine close utilise la difficulté de cette semaine-là ;
- R15 : la difficulté d'une semaine est celle du dernier changement fait au plus tard le dimanche de
  cette semaine ; le même jour, l'ordre de saisie les départage ;
- R2 : les habitudes existantes passent en Moyenne, sans changer l'expérience.

L'ADR 0002 a fait de l'expérience un solde transactionnel vérifié par un invariant à 10 Xp par
suivi « fait » (décision 5). Cet invariant ne tient plus avec la difficulté. Des données réelles
existent (builds de preview) : la migration doit être additive et ne rien inventer pour le passé.
L'analyse d'impact de #23 a demandé que ce modèle soit prêt pour #24 et #26 dès maintenant, en
particulier pour les semaines « sans objectif » d'avant la mise à jour de #24.

## Décision

### 1. Un historique de changements de réglages, et des réglages de la semaine calculés

Les réglages d'une habitude sont un **historique de changements de réglages** (`SettingsChange`) :
chaque changement est daté du jour de sa saisie par l'horloge de l'application (port `Clock`),
porte un ordre de saisie croissant (`sequence`) et un **instantané complet** de tous les réglages de
l'habitude après le changement. Un changement est enregistré à la création de l'habitude puis à
chaque modification de ses réglages ; l'historique est effacé avec l'habitude. L'entité `Habit` ne
porte aucun réglage.

Les **réglages de la semaine** (`WeekSettings`) en sont une fonction pure,
`weekSettingsOf(changements de l'habitude, semaine, jour de création)`, sans repère global ni
« aujourd'hui » (le jour de création, un fait de l'habitude, sert à l'objectif de #24, voir §4) :

- difficulté de la semaine = celle du dernier changement daté au plus tard du dimanche de la
  semaine, dans l'ordre (jour, ordre de saisie) (R12, R15) ;
- sans changement daté au plus tard de ce dimanche (jour de création postérieur, après un recul de
  l'horloge), le premier changement s'applique ;
- sans aucun changement, Moyenne (R2).

### 2. Barème, invariant et solde transactionnel

Barème `XP_PER_CHECK_IN` : `easy` 5, `medium` 10, `hard` 20 Xp par case « fait ». Le nouvel
invariant de l'expérience **remplace la décision 5 de l'ADR 0002** :

`xp = Σ (habitudes existantes h) Σ (semaines W de h) weekXpOf(cases « fait » de h dans W, weekSettingsOf(changements de h, W, jour de création de h)) + retained_xp`

avec, depuis #26 (§6), `weekXpOf(n, réglages) = n × XP_PER_CHECK_IN[difficulté] + targetBonusOf(n, réglages)` :
chaque suivi « fait », de toutes dates, au barème de la difficulté de sa semaine, plus la **prime
d'objectif** de chaque semaine dont l'objectif est atteint.

Il ne dépend pas d'aujourd'hui : un changement est daté du jour de sa saisie, une semaine close
n'est donc changée ni par un changement de réglages ultérieur, ni par un changement de fuseau ou un
recul de l'horloge. Le plancher de 0 Xp ne joue que sur un état incohérent.

Le solde reste transactionnel (ADR 0002) : chaque cas d'usage applique, dans la même unité de
travail que ce qu'il enregistre, le **delta** calculé par un seul module du domaine, `HabitXp` :

| Cas d'usage | Delta |
|---|---|
| `toggleCheckIn` | `weekXpOf` de la semaine du jour touché, après moins avant, avec les réglages de cette semaine (R1, R14), décomposé par `weekXpChangeOf` en part du suivi et part de la prime |
| `updateHabit` | `xpChangeOfSettings` = `habitXpOf(après) − habitXpOf(avant)` : seules bougent les semaines dont les réglages changent, jamais une semaine close (R12) |
| `deleteHabit` | `deletionXpOf` : `removed` (le suivi d'aujourd'hui, au barème de la semaine en cours, et la prime de la semaine en cours si elle tombe sans lui) est retiré, `retained` (le reste, primes encore acquises comprises) passe dans l'Xp conservée (R18, R19) |
| `introduceTargetBonus` | une seule fois, `Σ habitTargetBonusOf` des habitudes existantes (§6) |

`weekXpOf(cases « fait », réglages de la semaine)` est le point d'extension de #26 : la prime
d'objectif s'y est ajoutée sans changer le reste (§6). Un test d'invariant partagé
(`application/testing/experienceInvariant`) recalcule l'expérience suivi par suivi après chaque
étape des tests de cas d'usage et des scénarios BDD.

### 3. Migration 0005, additive

```sql
CREATE TABLE settings_changes (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  changed_on TEXT NOT NULL CHECK (changed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard'))
) STRICT;
CREATE INDEX settings_changes_by_habit ON settings_changes (habit_id, changed_on, sequence);
INSERT INTO settings_changes (habit_id, changed_on, difficulty)
  SELECT id, created_on, 'medium' FROM habits ORDER BY id;
```

Chaque habitude existante reçoit un changement « Moyenne » daté de son jour de création : toutes
ses semaines valent 10 Xp par case, le barème de la migration 0004. `character` n'est pas touché et
l'expérience est exactement la même juste après la mise à jour. La migration 0004 ne change pas.

Le port `SettingsChangeRepository` (`listByHabit`, `listAll`, `add(habitId, changedOn, settings)`)
rejoint les dépôts de l'unité de travail ; il est implémenté sur SQLite et en mémoire et vérifié par
un test de contrat commun.

### 4. Un réglage introduit plus tard est vide dans le passé

Un réglage ajouté après coup (l'objectif hebdomadaire de #24) est une colonne **nullable, sans
défaut** :

```sql
ALTER TABLE settings_changes ADD COLUMN weekly_target INTEGER
  CHECK (weekly_target IS NULL OR weekly_target BETWEEN 1 AND 7);
```

Dans les changements antérieurs à son introduction (dont celui rétro-rempli par 0005 au jour de
création), il reste vide : vide veut dire « ce réglage n'existait pas encore », donc pas d'objectif
ni de prime pour ces semaines (R16, R17 de #24 ; R17 de #26).

Son introduction pour les habitudes existantes est un **changement d'introduction**
(`introductionChange`, voir le glossaire) : au démarrage, après les migrations, le cas d'usage
`introduceWeeklyTarget` ajoute à chaque habitude dont le dernier changement dans l'ordre de saisie
n'a pas ce réglage un changement daté de `clock.today()` (`introductionChangeOf`), qui recopie la
difficulté **de la semaine en cours** (pas celle du dernier changement, qu'un recul d'horloge peut
avoir daté dans le futur) et porte la valeur introduite (l'objectif 7, R16). Une seule unité de
travail ; idempotent par construction (après coup, le dernier changement dans l'ordre de saisie
n'est plus vide), donc rejoué sans effet, et rejoué au démarrage suivant si l'application s'arrête
avant. L'expérience n'est ni lue ni changée : la difficulté de chaque semaine reste la même (test
de propriété).

Règle de l'objectif de la semaine W, pour #24 (`weekSettingsOf(changes, W, createdOn)`, historique
trié par jour puis ordre de saisie) :

1. l'objectif du dernier changement **qui porte un objectif** daté avant le lundi de W : un
   changement d'objectif fait pendant W s'applique à partir du lundi suivant (R13) ;
2. sinon, si le premier changement qui porte un objectif est daté dans W, il s'applique dès sa
   propre semaine :
   - s'il est daté du **jour de création** de l'habitude, l'objectif est celui du dernier
     changement de ce jour, dans l'ordre de saisie (exception du jour de création, R13). C'est le
     cas d'une habitude créée après la mise à jour, et aussi d'une habitude créée le jour même de la
     mise à jour, dont le changement d'introduction est daté de son jour de création : elle garde
     l'exception ;
   - sinon, c'est le changement d'introduction d'une habitude créée avant le jour de la mise à
     jour, et l'objectif est le sien seul (7, R16). **Le jour de la mise à jour ne devient pas un
     jour de création** : un changement d'objectif fait ce jour-là s'applique à partir de la
     semaine suivante ;
3. sinon, la semaine n'a pas d'objectif : ni progression, ni objectif atteint, ni prime, même après
   correction.

Le jour de création est un paramètre de `weekSettingsOf`, pas le premier changement : un recul
d'horloge peut dater un changement avant la création. La règle de la difficulté (décision 1) ne
change pas.

L'**objectif de la semaine** (`weekTarget`, R6) est cet objectif, réduit en semaine de création au
nombre de jours de W à partir du jour de création (créée un jeudi avec 7 : 4) ; il est vide sans
objectif, ou pour une semaine sans aucun jour actif. Un changement d'objectif enregistré aujourd'hui
s'applique à la semaine en cours si et seulement si aujourd'hui est le jour de création
(`weeklyTargetChangeAppliesThisWeek`, vérifié contre la règle par un test de propriété) : c'est ce
qui choisit le message de « Modifier l'habitude », même ouvert depuis la Carte de nouveauté.

Le domaine refuse un changement qui viderait un réglage déjà renseigné : le port n'écrit que des
`HabitSettings`, où l'objectif est obligatoire, et les cas d'usage le vérifient avec
`parseWeeklyTarget`. Seuls les changements d'avant la mise à jour, déjà stockés, sont relus vides.

La **Carte de nouveauté** de la Vue Journée se déduit des données : elle s'affiche si au moins une
habitude existante a un changement sans objectif (`predatesWeeklyTarget`, donc créée avant la mise
à jour) et que la clé `day-view.whats-new.difficulty-and-weekly-target.dismissed` est absente du
stockage clé-valeur. Rien n'est donc écrit à l'introduction pour elle, et il n'y a pas d'écriture à
coordonner entre l'unité de travail et le stockage clé-valeur ; « Fermer » et « Régler » écrivent
la clé.

### 5. Interdits

- Toute date calculée en SQL (`date('now')`, `CURRENT_DATE`, `CURRENT_TIMESTAMP`) : les jours
  viennent toujours de l'horloge de l'application.
- Tout `DEFAULT` qui inventerait une valeur pour le passé (ex. `DEFAULT 7` pour l'objectif, qui
  donnerait un objectif, puis une prime, à toutes les semaines depuis la création).

### 6. Prime d'objectif et rattrapage (#26)

**Calcul.** `targetBonusOf(cases « fait », réglages de la semaine)` vaut `weekTarget ×
TARGET_BONUS_PER_UNIT[difficulté]` (prime unitaire : Facile 3, Moyenne 5, Difficile 10, valeurs du
barème) si le nombre de cases « fait » **de toute la semaine** atteint l'objectif de la semaine
(`isTargetReached`), sinon 0 ; sans objectif (`weekTarget` vide, semaine close avant la mise à jour,
R17), toujours 0. Elle est tout-ou-rien. Comme elle entre dans `weekXpOf`, `habitXpOf`,
`xpChangeOfSettings` et `deletionXpOf` l'intègrent sans autre changement, et les règles suivent par
construction : une seule prime par habitude et par semaine (c'est une fonction de l'état de la
semaine, pas un événement), un aller-retour au seuil vaut 0 Xp net, un changement de difficulté
réévalue la prime de la semaine en cours (R12), un changement d'objectif ne la touche pas (R13), une
semaine close garde ses propres réglages (R14).

**Progression comptée.** La prime compte tous les « fait » de la semaine, comme l'invariant, qui ne
dépend pas d'aujourd'hui ; les vues lisent la progression jusqu'à aujourd'hui (`weeklyProgressOf`).
Les deux ne diffèrent qu'après un recul d'horloge, avec un « fait » sur un jour devenu futur : la
prime peut alors être acquise pendant que la ligne affiche « 2/3 ». C'est la même limite que l'Xp de
ce jour, déjà comptée par l'invariant : cas rare, accepté.

**Décomposition des variations.** `weekXpChangeOf(avant, après, réglages avant, réglages après)`
donne la part du suivi (`checkInXp`), la part de la prime (`targetBonus`) et le franchissement du
seuil (`targetReachedChange` : `reached`, `lost`, ou rien, y compris quand seule la prime change avec
la difficulté). Les cas d'usage renvoient ces parts pour le feedback (seconde pastille
« +15 XP prime », message « Objectif de la semaine atteint ») sans relire la vue. Quand le plancher
de 0 Xp joue (état incohérent, sur une perte seulement), la part de la prime est réduite d'abord,
puis celle du suivi (`targetBonusShareOf`), pour que les pastilles affichées fassent toujours la
variation appliquée.

**Rattrapage.** L'expérience doit respecter l'invariant dès que la prime existe, y compris pour les
semaines déjà atteintes avant sa première ouverture (build de preview qui a déjà #24, ou semaine en
cours entièrement « fait » le jour de la mise à jour). Au démarrage, juste après
`introduceWeeklyTarget`, le cas d'usage `introduceTargetBonus` ajoute une seule fois à l'expérience
`Σ habitTargetBonusOf` des habitudes existantes, sans feedback, et écrit la trace de cette
**Introduction** dans la même unité de travail, par le port `IntroductionRepository`
(`has`, `add`). Un démarrage interrompu puis rejoué n'accorde donc jamais deux fois ; une panne
n'écrit rien et le démarrage propose « Réessayer ». L'Xp conservée n'est pas touchée : les habitudes
supprimées avant n'avaient pas de prime. Sur une première installation, il ajoute 0 et pose la
trace. C'est une exception étroite, décidée par le propriétaire (option 1 de Q-B), à
« l'expérience est exactement la même juste après la mise à jour » (§3, #24) : elle ne retire jamais
d'expérience et vaut au plus la prime d'une semaine par habitude pour une release qui apporte
objectif et prime ensemble.

**Migration 0007, additive** (§5 respecté) :

```sql
CREATE TABLE introductions (
  name TEXT PRIMARY KEY NOT NULL CHECK (name IN ('targetBonus')),
  introduced_on TEXT NOT NULL CHECK (introduced_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
) STRICT;
```

Elle ne réécrit aucune ligne, ne calcule aucune date et ne touche pas `character` : la règle de la
prime vit dans `HabitXp`, pas en SQL, pour qu'une migration publiée ne dépende jamais d'une règle qui
évolue. Une future introduction élargira le `CHECK` par une nouvelle migration. Écartés : un
rattrapage sans trace dans la transaction de `introduceWeeklyTarget` (ne rejoue pas sur un build de
preview qui a déjà #24), une trace dans le stockage clé-valeur (hors de l'unité de travail, ou règle
de jeu sous une clé non typée) et une colonne sur `character` (drapeau technique dans le domaine).

## Alternatives écartées

- **Les réglages dans l'entité `Habit`** (une colonne `difficulty` sur `habits`) : une seule valeur
  ne dit pas quelle difficulté valait pour une semaine close ; R12 et R14 seraient impossibles sans
  recalcul faux du passé.
- **Un repère global « jour de la mise à jour »** (décision de l'escalade d'impact, option b) :
  l'invariant de l'expérience dépendrait d'une donnée hors de l'historique des habitudes, que chaque
  calcul devrait relire ; un repère absent ou perdu donnerait silencieusement un objectif, puis une
  prime, à toutes les semaines passées. Avec l'historique, l'absence d'information veut dire « pas
  d'objectif », le cas sûr.
- **Des changements partiels** (seulement le réglage modifié) : il faudrait reconstituer les
  réglages en rejouant tout l'historique, et distinguer « non modifié » de « pas encore introduit ».
  L'instantané complet garde `weekSettingsOf` simple.
- **Expérience entièrement recalculée** à chaque lecture : déjà écartée par l'ADR 0002 (plancher,
  sources d'expérience futures).

## Conséquences

### Positives

- Migration additive, rétro-remplie en Moyenne : l'expérience est inchangée à la mise à jour.
- Une semaine close ne change jamais, quels que soient les changements de réglages ultérieurs, le
  fuseau ou l'horloge.
- Un seul calcul (`HabitXp`) pour toutes les variations, vérifié par un invariant et par la
  mutation du domaine.
- #24 et #26 ajoutent leurs règles sans migration de données ni changement de la règle de la
  difficulté : #24 ajoute une colonne vide et un changement d'introduction, #26 complète `weekXpOf`.

### Négatives et risques

- Limites d'horloge identiques à la création (ADR 0002) : un changement saisi pendant que l'horloge
  du téléphone est fausse reste daté de ce faux jour. Avec un changement daté dans le futur, une
  saisie plus récente mais datée plus tôt ne l'emporte pas sur la semaine future (R15 trie par
  jour) : cas rare, accepté.
- `updateHabit` relit tous les suivis de l'habitude pour calculer la variation (quelques milliers
  de lignes au plus après des années, au plus 10 habitudes) : acceptable, à restreindre aux semaines
  à partir de la semaine en cours si besoin.
- Selon `docs/workflow.md`, la migration 0005 et le changement de la règle de l'expérience rendent
  l'impact de #23 « fort » : la décision du PM et de l'Architect est tracée en commentaires sur
  #23 (impact accepté, pas de redécoupage).
