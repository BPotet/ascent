# ADR 0002 — Modèle du suivi des habitudes

- **Statut** : accepté
- **Date** : 14 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : épique #2 (stories #3, #4, #7, #9, #5, #6, #10)

## Contexte

L'épique #2 introduit les habitudes, leur suivi jour par jour, la clôture automatique du jour à
minuit, la correction sans limite de temps avec une marque « corrigé », l'expérience du personnage
et la consultation de tout l'historique (règles de jeu R1 à R24 du Game Designer). Les données
restent sur le téléphone, dans la base SQLite du socle (ADR 0001).

Les sept stories sont livrées l'une après l'autre, et chaque push sur `develop` produit un build de
preview installé par le propriétaire : des données réelles existent entre deux stories. Le modèle
doit donc être fixé dès la première story pour qu'aucune migration ultérieure ne soit destructrice.

Contraintes relevées par l'épique (notes pour l'étape Ready) :

- l'expérience ne doit pas changer quand un suivi devient « futur » après un recul d'horloge ou un
  changement de fuseau vers l'ouest ;
- un tap juste après minuit sur le jour qui vient d'être clos est une correction dès #4, alors que
  la marque « corrigé » n'est affichée qu'à partir de #9 : elle doit être retrouvable.

Contraintes techniques : expo-sqlite exécute les requêtes d'une transaction sur la connexion
partagée (`withTransactionAsync`) et refuse un `BEGIN` dans une transaction ouverte ; la date du
téléphone peut avancer, reculer ou changer de fuseau à tout moment.

## Décision

### 1. Les états sont calculés, pas stockés

On stocke les habitudes (avec leur jour de création), les suivis et le personnage. L'état d'une
case (`CheckInStatus` : fait, à faire, pas fait, à venir, hors habitude) est calculé par le domaine
à partir du suivi, du jour de création et d'aujourd'hui (`habitDayOf`). La clôture du jour n'écrit
rien : un jour est clos dès qu'il est antérieur à aujourd'hui.

### 2. Les jours sont des textes ISO

Un jour est stocké en `TEXT` `AAAA-MM-JJ` (`Day.toIsoString`). L'ordre du texte est l'ordre
chronologique : intervalles (`BETWEEN`) et minimum (`MIN(created_on)`) se font en SQL.

### 3. Schéma de l'épique

| Migration | Story | Contenu |
|---|---|---|
| `0002-create-habits` | #3 | `habits (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, name_key TEXT UNIQUE, created_on TEXT)` |
| `0003-create-check-ins` | #4 | `check_ins (habit_id → habits ON DELETE CASCADE, day TEXT, done 0/1, corrected 0/1, PRIMARY KEY (habit_id, day), CHECK (done = 1 OR corrected = 1))` + index sur `day` |
| `0004-create-character` | #5 | `character (id = 1, xp ≥ 0, retained_xp ≥ 0)`, initialisé à `10 × nombre de suivis « fait »` |

Toutes les tables sont `STRICT`. L'ordre de création des habitudes est celui de `id`
(`AUTOINCREMENT` ne réutilise jamais un identifiant). Le doublon de nom se vérifie sur `name_key`
(nom nettoyé, normalisé NFC, en minuscules), calculé par le domaine : `NOCASE` de SQLite ne connaît
que l'ASCII.

### 4. La marque « corrigé » est un booléen, écrit dès #4

Un suivi porte `done` et `corrected`. L'état de la case au moment de la clôture vaut
`done XOR corrected`.

- Tap sur aujourd'hui : `done` inversé, `corrected` remis à faux (le dernier changement a eu lieu
  jour ouvert, R13).
- Tap sur un jour clos (correction, y compris juste après minuit) : `done` **et** `corrected`
  inversés. Revenir à l'état de la clôture efface donc la marque.
- Une case « pas fait » non corrigée n'a pas de ligne.

La règle est appliquée par `toggleCheckIn` dès #4 ; #9 n'ajoute que l'affichage.

### 5. L'expérience est un solde transactionnel, avec l'Xp conservée à part

`character.xp` est mis à jour dans la **même transaction** que le suivi (+10 / −10, jamais sous 0)
ou que la suppression d'une habitude. `character.retained_xp` reçoit, à la suppression, 10 par
suivi « fait » de l'habitude sur un autre jour qu'aujourd'hui. L'invariant vérifié par les tests :

`xp = 10 × (suivis « fait » des habitudes existantes, toutes dates confondues) + retained_xp`

Il compte tous les suivis « fait », y compris ceux devenus futurs : un recul d'horloge ou un
changement de fuseau ne change jamais l'expérience. La migration 0004 calcule l'expérience des
suivis déjà enregistrés (R19). Le plancher à 0 est une règle de sécurité : il ne joue que sur un
état incohérent.

### 6. Accès à la base par une unité de travail sérialisée

Les cas d'usage n'accèdent aux données que par le port `UnitOfWork.run(work)`, qui fournit les
dépôts (`HabitRepository`, `CheckInRepository`, `CharacterRepository`) et exécute `work` dans une
transaction. L'adaptateur SQLite met les unités de travail en file : une seule transaction à la fois
sur la connexion. Chaque cas d'usage lit aujourd'hui une fois, au début de son unité de travail, et
relit l'état stocké avant d'écrire (un tap inverse l'état enregistré, pas l'état affiché).
Un refus de règle est un résultat typé ; une panne de stockage est une exception, et rien n'est
enregistré.

### 7. Une horloge qui prévient

Le port `Clock` gagne `onTodayChange(listener)`. `SystemClock` prévient à minuit (minuterie
recalculée en heure locale), au retour au premier plan et lors d'une relecture périodique quand
l'application est visible (changement de fuseau). Un tap porte toujours sur le jour de la case
affichée.

### 8. Suppression physique

Supprimer une habitude supprime sa ligne et ses suivis (`ON DELETE CASCADE`, avec
`PRAGMA foreign_keys = ON`). Aucune vue n'affiche une habitude supprimée, et une habitude recréée
repart d'aujourd'hui.

### 9. Écrans

Expo Router : `(tabs)` avec les onglets Journée (`/`, écran d'accueil), Semaine, Mois. Les panneaux
du bas et la confirmation de suppression sont des `Modal` de l'interface, pas des routes. Les
fichiers de route passent aux écrans des rappels de navigation ; les écrans ne connaissent pas les
routes.

## Alternatives écartées

- **Stocker l'état de chaque case à la clôture** (écriture à minuit) : impossible quand
  l'application est fermée (R5), et source d'incohérences lors des changements de fuseau.
- **Stocker `done_at_closing` (nullable)** à la place de `corrected` : équivalent, mais trois états
  là où deux suffisent, et une normalisation à maintenir.
- **Expérience entièrement calculée** à partir des suivis : toujours cohérente, mais elle ne peut
  pas représenter le plancher, ni accueillir les sources d'expérience des épiques suivantes
  (quêtes, monstres) sans réécrire le calcul. Un journal d'événements d'XP a été jugé prématuré.
- **Suppression logique** des habitudes : aucune règle n'en a besoin et elle compliquerait
  l'historique et l'unicité des noms.
- **Panneaux en routes modales** : l'état du formulaire (saisie conservée après une erreur) et les
  tests d'écran seraient liés au routeur sans bénéfice pour le joueur.

## Conséquences

### Positives

- Aucune migration destructrice dans l'épique : 0002, 0003 et 0004 sont additives.
- Les corrections faites entre #4 et #9 gardent leur marque sans reprise de données.
- L'expérience est indépendante de l'horloge, et sa cohérence se vérifie par un invariant.
- Un tap triple ou concurrent ne peut pas créer deux suivis ni compter deux fois l'expérience.
- Le domaine reste pur et testable avec une horloge fixée.

### Négatives et risques

- Le barème (10) est figé dans la migration 0004 : un changement de barème passera par une nouvelle
  migration.
- Les longueurs de nom sont comptées en points de code : un emoji composé (famille, drapeau) compte
  pour plusieurs caractères.
- Une habitude créée pendant que l'horloge du téléphone est fausse reste datée de ce faux jour.
- La relecture périodique de l'horloge consomme un peu d'énergie quand l'application est visible.
- Selon `docs/workflow.md`, une migration rend l'impact « fort » : pour #3, #4 et #5, l'escalade
  est traitée par avance par cet ADR (modèle fixé, migrations additives). La décision est tracée
  sur ces issues avec le PM.
