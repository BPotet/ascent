# ADR 0003 — Réglages de la semaine

- **Statut** : accepté
- **Date** : 21 octobre 2026
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
`weekSettingsOf(changements de l'habitude, semaine)`, sans repère global ni « aujourd'hui » :

- difficulté de la semaine = celle du dernier changement daté au plus tard du dimanche de la
  semaine, dans l'ordre (jour, ordre de saisie) (R12, R15) ;
- sans changement daté au plus tard de ce dimanche (jour de création postérieur, après un recul de
  l'horloge), le premier changement s'applique ;
- sans aucun changement, Moyenne (R2).

### 2. Barème, invariant et solde transactionnel

Barème `XP_PER_CHECK_IN` : `easy` 5, `medium` 10, `hard` 20 Xp par case « fait ». Le nouvel
invariant de l'expérience **remplace la décision 5 de l'ADR 0002** :

`xp = Σ (habitudes existantes h) Σ (suivis « fait » c de h, toutes dates) XP_PER_CHECK_IN[weekSettingsOf(changements de h, semaine de c).difficulty] + retained_xp`

Il ne dépend pas d'aujourd'hui : un changement est daté du jour de sa saisie, une semaine close
n'est donc changée ni par un changement de réglages ultérieur, ni par un changement de fuseau ou un
recul de l'horloge. Le plancher de 0 Xp ne joue que sur un état incohérent.

Le solde reste transactionnel (ADR 0002) : chaque cas d'usage applique, dans la même unité de
travail que ce qu'il enregistre, le **delta** calculé par un seul module du domaine, `HabitXp` :

| Cas d'usage | Delta |
|---|---|
| `toggleCheckIn` | `weekXpOf` de la semaine du jour touché, après moins avant, avec les réglages de cette semaine (R1, R14) |
| `updateHabit` | `xpChangeOfSettings` = `habitXpOf(après) − habitXpOf(avant)` : seules bougent les semaines dont les réglages changent, jamais une semaine close (R12) |
| `deleteHabit` | `deletionXpOf` : `removed` (le suivi d'aujourd'hui, au barème de la semaine en cours) est retiré, `retained` (le reste) passe dans l'Xp conservée (R18, R19) |

`weekXpOf(cases « fait », réglages de la semaine)` est le point d'extension de #26 : la prime
d'objectif s'y ajoutera sans changer le reste. Un test d'invariant partagé
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

Son introduction pour les habitudes existantes est un **changement d'introduction** : au démarrage,
après les migrations, un cas d'usage de l'application (nommé au glossaire par #24) ajoute à chaque
habitude dont le dernier changement n'a pas ce réglage un changement daté de `clock.today()`, qui
recopie les réglages en vigueur et porte la valeur introduite (l'objectif 7, R16). Une seule unité
de travail ; idempotent par construction (après coup, plus aucun dernier changement n'est vide),
donc rejoué sans effet, et rejoué au démarrage suivant si l'application s'arrête avant.

Règle de l'objectif de la semaine W, pour #24 : celui du dernier changement daté avant le lundi de
W ; si ce changement n'existe pas ou est vide, le premier changement **qui porte un objectif**
s'applique dès sa propre semaine (avec les changements du même jour, dans l'ordre de saisie) : le
jour de création pour une habitude créée après la mise à jour, le jour de la mise à jour pour une
habitude existante. Sinon, la semaine n'a pas d'objectif : ni progression, ni objectif atteint, ni
prime, même après correction. La règle de la difficulté (décision 1) ne change pas.

Le domaine refusera un changement qui viderait un réglage déjà renseigné (test de domaine ajouté
par #24).

### 5. Interdits

- Toute date calculée en SQL (`date('now')`, `CURRENT_DATE`, `CURRENT_TIMESTAMP`) : les jours
  viennent toujours de l'horloge de l'application.
- Tout `DEFAULT` qui inventerait une valeur pour le passé (ex. `DEFAULT 7` pour l'objectif, qui
  donnerait un objectif, puis une prime, à toutes les semaines depuis la création).

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
