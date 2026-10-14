# Épique #2 — Notes techniques

> Notes de l'Architect pour l'épique [#2](https://github.com/BPotet/ascent/issues/2) (étape 3, Ready),
> rédigées le 14 octobre 2026 : plan d'ensemble puis une section par story (#3, #4, #7, #9, #5, #6, #10).
> Les décisions structurantes sont dans l'[ADR 0002](../adr/0002-modele-suivi-habitudes.md). Le vocabulaire
> vient de [`docs/glossary.md`](../glossary.md).

Auteur : Architect. Date : 14 octobre 2026.
Base lue : épique #2 et stories #3, #4, #7, #9, #5, #6, #10 (GitHub), socle de la PR #12 (worktree
`chore/setup-foundation`, lu sans modification), `docs/workflow.md`, `docs/glossary.md`,
`docs/adr/0001-socle-technique.md`, `.claude/agents/architect.md` et `dev-*.md`, règles de jeu
révisées (R1 à R24), maquette v2 validée.

Hypothèse sur le socle : PR #12 mergée **sans** `Day.equals/isBefore/isAfter/compareTo` ni
`features/today.feature`. Chaque méthode de `Day` réapparaît donc dans la story qui l'utilise, avec
ses tests (seuils de mutation du domaine : 85 %).

---

## Plan d'ensemble

### Principes structurants (détaillés dans l'ADR 0002 ci-dessous)

1. **L'état d'une case (une habitude × un jour) est calculé, jamais stocké.** On ne stocke que
   les habitudes (avec leur jour de création), les suivis et le personnage. `CheckInStatus` (fait,
   à faire, pas fait, à venir, hors habitude) se déduit du suivi, du jour de création et
   d'aujourd'hui. La clôture du jour n'écrit rien (R4, R5).
2. **La marque « corrigé » est stockée dès #4**, sous la forme d'un booléen `corrected` sur le
   suivi. L'état à la clôture s'en déduit : `doneAtClosing = done XOR corrected`. Un tap sur un jour
   clos inverse `done` **et** `corrected` ; un tap sur aujourd'hui inverse `done` et remet
   `corrected` à faux. La marque disparaît donc d'elle-même quand la case revient à son état à la
   clôture (R13). Le tap juste après minuit de #4 est ainsi retrouvable par #9 sans migration.
3. **L'expérience est un solde stocké** (`character.xp`), modifié dans la **même transaction** que
   le suivi ou la suppression qui le fait varier, avec plancher à 0 (R16). L'**Xp conservée**
   (`retained_xp`) est tenue à part pour que l'invariant soit vérifiable :
   `xp = 10 × (tous les suivis « fait » des habitudes existantes, quelle que soit leur date) + retained_xp`.
   Il compte **tous** les suivis « fait », y compris ceux devenus futurs après un recul d'horloge
   ou un changement de fuseau (note Ready n° 1 de l'épique, qui précise R15). Le calcul rétroactif
   (R19) est fait par la migration de #5.
4. **Toute lecture et écriture de la base passe par une unité de travail sérialisée**
   (`UnitOfWork`). Un tap triple, un tap pendant un chargement ou une suppression pendant un
   affichage ne peuvent pas s'entrelacer (expo-sqlite refuse un `BEGIN` dans une transaction
   ouverte sur la même connexion).
5. **L'horloge prévient quand aujourd'hui change** (`Clock.onTodayChange`) : à minuit, au retour
   au premier plan et lors d'un changement de fuseau. Les écrans se recalent seuls.
6. **Suppression physique** d'une habitude (suivis effacés en cascade, R17). Pas de suppression
   logique : aucune vue n'affiche une habitude supprimée et une habitude recréée repart
   d'aujourd'hui (R12).

### Modèle de domaine cible (`src/domain`)

| Module | Élément (code) | Terme du glossaire | Story |
|---|---|---|---|
| `day/Day.ts` | `Day` : `toIsoString()`, `Day.fromIsoString()`, `equals`, `compareTo`, `isBefore`, `isAfter` (#3, #4) ; `plusDays`, `dayOfWeek` (#7) | Jour | socle, #3, #4, #7 |
| `day/DayClosing.ts` | `isClosedDay(day, today)` (`day < today`) | Clôture du jour, Jour clos | #4 |
| `habit/Habit.ts` | `Habit { id: HabitId, name: HabitName, createdOn: Day }`, `isActiveOn(day)` | Habitude (jour de création, active) | #3 |
| `habit/HabitName.ts` | `HabitName.parse(raw)` : nettoyage, 1 à 40 caractères, `key` (comparaison sans majuscules) ; `habitNameLength(raw)` pour le compteur | Habitude (nom) | #3 |
| `habit/HabitRules.ts` | `MAX_HABITS = 10`, `assertCanAddHabit`, `assertNameAvailable(habits, name, exceptId?)` ; erreurs `EmptyHabitNameError`, `HabitNameTooLongError`, `DuplicateHabitNameError`, `HabitLimitReachedError` | Habitude | #3, #6 |
| `checkIn/CheckIn.ts` | `CheckIn { habitId, day, done, corrected }`, `toggleCheckIn(habit, day, current, today)` → nouveau suivi + `isCorrection` ; erreurs `NotStartedDayError`, `UpcomingDayError` | Suivi, Correction | #4 |
| `checkIn/CheckInStatus.ts` | `CheckInStatus` (`Done`, `Pending`, `Missed`, `Upcoming`, `NotStarted`) | État du suivi | #4 |
| `checkIn/HabitDay.ts` | `HabitDay { habitId, day, status, editable, corrected }`, `habitDayOf(habit, day, checkIn, today)` | **Case** (à ajouter au glossaire, voir #3) | #4 |
| `week/Week.ts` | `Week.containing(day)`, `days()`, `previous()`, `next()`, `start`, `end` | Semaine | #7 |
| `month/Month.ts` | `Month.containing(day)`, `days()`, `weeks()` (grille lundi → dimanche), `previous()`, `next()` | **Mois** (à ajouter, voir #3) | #10 |
| `history/History.ts` | `History.of(habits, today)` : `firstWeek`, `firstMonth`, `canGoBefore(week|month)`, `canGoAfter(...)` | Historique | #7, #10 |
| `character/Character.ts` | `Character { xp, retainedXp }`, `XP_PER_CHECK_IN = 10`, `applyCheckInChange(done)`, `retainOnHabitDeletion(...)`, plancher 0 | Personnage, Expérience, Xp conservée | #5, #6 |

Règles de calcul de `habitDayOf` (R8, R7, R13), avec `T` = aujourd'hui et `C` = jour de création :

| Condition | `status` | `editable` | `corrected` affiché |
|---|---|---|---|
| `day < C` | `NotStarted` | non | non |
| `day > T`, suivi « fait » (horloge reculée, R7) | `Done` | non | non |
| `day > T`, sinon | `Upcoming` | non | non |
| `day = T` | `Done` si « fait », sinon `Pending` | oui | non |
| `C ≤ day < T` | `Done` si « fait », sinon `Missed` | oui (correction) | `checkIn.corrected` |

### Schéma final de la base locale (`ascent.db`)

Numérotation à la suite de `0001-create-key-value`. Toutes les migrations de l'épique sont
**additives** (aucune n'est destructrice). Les jours sont stockés en texte ISO `AAAA-MM-JJ` : l'ordre
alphabétique est l'ordre chronologique, ce qui permet `BETWEEN` et `MIN`.

```sql
-- 0002-create-habits.ts (#3)
CREATE TABLE habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,      -- AUTOINCREMENT : jamais réutilisé, donc ordre de création
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  name_key TEXT NOT NULL UNIQUE,             -- nom nettoyé, en minuscules (doublons, R PM)
  created_on TEXT NOT NULL
    CHECK (created_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
) STRICT;

-- 0003-create-check-ins.ts (#4)
CREATE TABLE check_ins (
  habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  done INTEGER NOT NULL CHECK (done IN (0, 1)),
  corrected INTEGER NOT NULL CHECK (corrected IN (0, 1)),
  PRIMARY KEY (habit_id, day),
  CHECK (done = 1 OR corrected = 1)          -- une case « pas fait » non corrigée n'a pas de ligne
) STRICT, WITHOUT ROWID;
CREATE INDEX check_ins_by_day ON check_ins (day);

-- 0004-create-character.ts (#5)
CREATE TABLE character (
  id INTEGER PRIMARY KEY CHECK (id = 1),     -- un seul personnage
  xp INTEGER NOT NULL CHECK (xp >= 0),
  retained_xp INTEGER NOT NULL CHECK (retained_xp >= 0)
) STRICT;
INSERT INTO character (id, xp, retained_xp)
  SELECT 1, 10 * COUNT(*), 0 FROM check_ins WHERE done = 1;   -- R19, calcul rétroactif
```

`key_value` (0001) sert aux préférences d'affichage (aide au premier usage de #4, rappel d'hier
de #9). `PRAGMA foreign_keys = ON` est déjà posé par `prepareAscentDatabase` : la cascade de #6 en
dépend (un test d'intégration le vérifie).

### Ports (`src/application/ports`)

```ts
// Existant (socle), étendu en #4
interface Clock {
  today(): Day;
  /** Prévient quand aujourd'hui change (minuit, retour au premier plan, fuseau). Renvoie le désabonnement. */
  onTodayChange(listener: (today: Day) => void): () => void;   // #4
}

interface HabitRepository {
  listAll(): Promise<Habit[]>;                          // #3, ordre de création
  add(name: HabitName, createdOn: Day): Promise<Habit>; // #3
  findById(id: HabitId): Promise<Habit | null>;         // #4
  rename(id: HabitId, name: HabitName): Promise<void>;  // #6
  remove(id: HabitId): Promise<void>;                   // #6, suivis effacés en cascade
}

interface CheckInRepository {
  find(habitId: HabitId, day: Day): Promise<CheckIn | null>;  // #4
  /** Enregistre la case ; supprime la ligne si elle n'est ni « fait » ni corrigée. */
  save(checkIn: CheckIn): Promise<void>;                      // #4
  listBetween(from: Day, to: Day): Promise<CheckIn[]>;        // #4 (un jour), #7, #10
  listByHabit(habitId: HabitId): Promise<CheckIn[]>;          // #6
}

interface CharacterRepository {                                // #5
  get(): Promise<Character>;
  save(character: Character): Promise<void>;
}

interface Repositories {           // grandit au fil des stories
  readonly habits: HabitRepository;
  readonly checkIns: CheckInRepository;   // #4
  readonly character: CharacterRepository; // #5
}

/** Unité de travail : exécute `work` dans une transaction, une seule à la fois. */
interface UnitOfWork {                                          // #3
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

interface KeyValueStore { /* socle, inchangé */ }

interface Haptics { success(): void }                            // #5 (retour haptique du gain d'XP)
```

Adaptateurs :

| Port | Téléphone | Tests |
|---|---|---|
| `Clock` | `adapters/device/clock/SystemClock` (date locale ; minuterie jusqu'au prochain minuit local, `AppState` → `active`, relecture toutes les 30 s quand l'app est visible pour attraper un changement de fuseau) | `FixedClock` (`setToday` prévient les abonnés) |
| `UnitOfWork` + dépôts | `adapters/persistence/sqlite/SqliteUnitOfWork` (file d'attente + `SqlDatabase.transaction`), `SqliteHabitRepository`, `SqliteCheckInRepository`, `SqliteCharacterRepository` | `adapters/persistence/memory/InMemoryUnitOfWork` (+ dépôts en mémoire, restauration de l'instantané en cas d'échec) ; **tests de contrat** communs SQLite/mémoire dans `persistence/testing/` |
| `KeyValueStore` | `SqliteKeyValueStore` (socle) | `InMemoryKeyValueStore` (socle) |
| `Haptics` | `adapters/device/haptics/ExpoHaptics` (`expo-haptics`) | `adapters/device/haptics/SilentHaptics` |

Les erreurs : un refus de règle (nom vide, doublon, limite, jour hors habitude, jour à venir) est
renvoyé par le cas d'usage sous forme de résultat typé (`{ ok: false, reason }`) ; une panne de
stockage est une exception. L'interface les distingue pour choisir le message (« … n'a pas pu être
enregistrée » pour une panne).

### Cas d'usage (`src/application/useCases`)

| Cas d'usage | Entrée → sortie | Story |
|---|---|---|
| `getToday` | socle | — |
| `getDayView(deps)` | → `{ day, habits: HabitDay[] (actives aujourd'hui, R20), canAddHabit, doneCount }` | #3, #4 |
| `createHabit(deps, rawName)` | → `{ ok, habit }` ou refus (`empty`, `tooLong`, `duplicate`, `limit`) | #3 |
| `toggleCheckIn(deps, habitId, day)` | → `{ ok, habitDay, isCorrection }` (+ `xpChange`, `xp` en #5) ou refus (`notStarted`, `upcoming`) | #4, #5 |
| `getCheckInHint` / `dismissCheckInHint` | aide au premier usage (clé `day-view.check-in-hint.dismissed`) | #4 |
| `getWeekView(deps, week)` | → `{ week, today, rows: { habit, days: HabitDay[7] }[], canGoPrevious, canGoNext }` | #7, #9 |
| `getYesterdayReminder` / `dismissYesterdayReminder` | → `{ day, done, active }` ou rien (voir #9) | #9 |
| `getCharacter(deps)` | → `{ xp }` | #5 |
| `renameHabit(deps, habitId, rawName)` | → `{ ok }` ou refus | #6 |
| `previewHabitDeletion(deps, habitId)` | → `{ name, xpRemoved }` (texte de la confirmation) | #6 |
| `deleteHabit(deps, habitId)` | → `{ xpRemoved, xp }` | #6 |
| `getMonthView(deps, month)` | → `{ month, today, days: { day, kind: neutral/upcoming/tracked, done, active, corrected }[], canGoPrevious, canGoNext }` | #10 |
| `getDayDetail(deps, day)` | → `{ day, habits: HabitDay[] }` (toutes les habitudes existantes) | #10 |

`deps` = `{ clock, unitOfWork }` (+ `keyValueStore` pour les préférences). Chaque cas d'usage lit
aujourd'hui **une seule fois** (`clock.today()`) au début de sa transaction.

### Écrans et routes (Expo Router, `src/app`)

```
src/app/
  _layout.tsx            Stack racine + assemblage (ouvre la base, construit Dependencies)   [mobile]
  (tabs)/_layout.tsx     Tabs « Journée / Semaine / Mois », barre d'onglets du front (#7)     [mobile]
  (tabs)/index.tsx       → DayViewScreen   (créé en #3 sous src/app/index.tsx, déplacé en #7)
  (tabs)/week.tsx        → WeekViewScreen  (#7)
  (tabs)/month.tsx       → MonthViewScreen (#10)
```

- La Vue Journée reste à l'URL `/` (un groupe `(tabs)` ne change pas l'URL), donc écran d'accueil.
- `Tabs` est fourni par `expo-router` 57 (aucune dépendance de navigation à ajouter). La barre
  d'onglets elle-même est un composant du front (`ui/components/TabBar`), passé en `tabBar` :
  fond et gras pour l'onglet actif, 52 px, comme la maquette.
- **Les panneaux du bas et les fenêtres ne sont pas des routes** : `NewHabitSheet` (#3),
  `EditHabitSheet` et `DeleteHabitDialog` (#6), `DayDetailSheet` (#10) sont des composants `Modal`
  du front, ouverts par l'écran. Leur état (saisie conservée après une erreur) reste local et se
  teste avec React Native Testing Library sans routeur. Pas de bibliothèque de bottom sheet.
- Les fichiers de route sont minces : ils passent aux écrans les rappels de navigation
  (ex. `onCorrectYesterday={() => router.navigate('/week')}` en #9). Les écrans ne connaissent pas
  les routes.
- Rafraîchissement entre onglets : un contexte d'interface `TrackingRevision`
  (`ui/state/TrackingRevision.tsx`) est incrémenté après chaque écriture réussie ; les vues et le
  compteur d'XP se rechargent quand il change. Pas de dépendance au focus du routeur.
- `useToday()` (socle) s'abonne à `Clock.onTodayChange` à partir de #4.
- Dépendances fournies à l'interface (`Dependencies`) : `clock`, `unitOfWork`, `keyValueStore`,
  `haptics` (#5).

Dépendances npm à ajouter (toujours par `npx expo install`, AGENTS.md) :
`@expo-google-fonts/sora` et `@expo-google-fonts/inter` + plugin `expo-font` dans `app.json` (polices
intégrées au build, donc hors ligne) en #3 ; `expo-haptics` en #5. Animations avec l'API `Animated`
de React Native (pas de Reanimated en dépendance directe), mouvement réduit via `AccessibilityInfo`.

### Glossaire : compléments à porter par la PR de #3

En plus de la liste validée dans #3, termes que le code va utiliser et qui manquent :

| Terme | Définition proposée |
|---|---|
| **Case** (`HabitDay`) | Une habitude un jour donné. Elle a un état du suivi, est modifiable ou non, et peut porter la marque « corrigé ». |
| **Mois** (`Month`) | Un mois du calendrier local ; ses semaines vont du lundi au dimanche. |
| **Xp conservée** (`retainedXp`) | Expérience acquise sur les jours passés d'habitudes supprimées (préciser dans la définition d'Expérience). |
| **Jour neutre** (`neutral`) | Un jour sans habitude active : aucune expérience, rien à corriger (#10, peut attendre #10). |
| **Dépôt** (`Repository`) — Architecture | Port de stockage d'un type de données du domaine (habitudes, suivis, personnage). |
| **Unité de travail** (`UnitOfWork`) — Architecture | Port qui exécute un cas d'usage dans une transaction, un seul à la fois. |
| **Horloge** (`Clock`) — précisé en #4 | « … et prévient quand aujourd'hui change ». |
| **Retour haptique** (`Haptics`) — en #5 | Vibration légère qui accompagne un gain d'expérience. |
| **Suivi** — précisé | Ajouter : « Un suivi « pas fait » n'existe que s'il porte la marque « corrigé » (correction d'un jour « fait » à sa clôture). » |

### Plan de test commun

- **Unitaire** (`npm run test:unit`) : tout `src/domain` et `src/application`, avec `FixedClock` et
  les adaptateurs en mémoire. Une règle de jeu (R1–R24) = au moins un test nommé avec son numéro.
  Tests de table pour `habitDayOf` et pour l'invariant d'XP (séquences de taps, corrections,
  suppressions, recul d'horloge).
- **Intégration** (`npm run test:integration`) : adaptateurs SQLite sur `node:sqlite` réel
  (`openNodeSqliteDatabase` + `prepareAscentDatabase`), **tests de contrat** partagés avec les
  adaptateurs en mémoire, migrations appliquées sur une base remplie (montée 1 → N), écrans avec
  React Native Testing Library et `renderScreen`.
- **BDD** (`npm run test:bdd`) : un fichier `.feature` par story, scénarios **recopiés mot pour mot**
  depuis l'issue, exécutés à travers l'application assemblée comme `startup.steps.ts` :
  `renderRouter(src/app)` + `FakeExpoSqliteConnection` (vraie base SQLite) + horloge simulée par
  `jest.useFakeTimers({ now, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] })` et
  `jest.setSystemTime` (minuit : avancer les minuteries ; changement de fuseau ou recul d'horloge :
  la date locale change, c'est ce que voit `SystemClock`). Aides de test à ajouter dans
  `persistence/testing/` (backend) : rouvrir la même base après « fermeture de l'application »,
  faire échouer les lectures ou les écritures d'une table.
- **End-to-end** (Maestro, `e2e/flows`) : un flux par story pour le parcours principal du jour
  (la date du téléphone ne se pilote pas : minuit, fuseau et jours passés restent en BDD), avec
  `takeScreenshot` pour la conformité à la maquette (barrière 10 bis). `testID` stables fournis par
  le front.

### Analyse d'impact (sommaire, pour toute l'épique)

**GitNexus n'est pas disponible** dans cet environnement (aucune commande `gitnexus`, aucun index
`.gitnexus`) : aucune mesure de *blast radius* n'a été faite, rien n'est inventé ici. L'analyse
ci-dessous est faite à la main, sur le socle de la PR #12 (environ 40 fichiers dans `src/`,
`features/`, `e2e/`). L'Impact Analyst devra la refaire à l'étape 4.

Point de procédure : selon `docs/workflow.md`, toute migration rend l'impact **fort**. #3, #4 et #5
ajoutent chacune une migration. Ces migrations sont **additives** (création de table, et
initialisation du personnage en #5) et le modèle est fixé une fois pour toutes par l'ADR 0002.
Proposition de l'Architect, à valider avec le PM et à tracer en commentaire sur #3, #4 et #5 par
l'orchestrateur : l'escalade est traitée par avance par l'ADR 0002, le périmètre validé ne change
pas, les stories partent en développement sans retour au propriétaire.

---

## #3 — Créer une habitude et la voir dans la vue Journée

### Couches touchées
`domain`, `application`, `adapters/persistence`, `adapters/ui`, `adapters/device` (aucune
modification attendue), `app`, `e2e`, `features`, `docs/glossary.md`.

### Devs nécessaires
- **Backend** : `Day` (`toIsoString`, `fromIsoString`, `compareTo`, `isAfter`, `equals`),
  `Habit`, `HabitName`, `HabitRules`, ports `HabitRepository` et `UnitOfWork`, cas d'usage
  `createHabit` et `getDayView`, migration 0002, adaptateurs SQLite et mémoire + tests de contrat,
  aides de test (réouverture de la base, pannes), mise à jour du glossaire pour toute l'épique
  (liste validée dans l'issue + compléments du plan d'ensemble), étapes BDD côté métier.
- **Front** : `DayViewScreen` (remplace `WelcomeScreen`) avec ses états (chargement, vide,
  erreur + « Réessayer », liste, limite de 10), `HabitRow` (état « à faire »), `NewHabitSheet`
  (champ unique avec clavier ouvert, compteur, bouton désactivé, erreurs sous le champ, erreur
  d'enregistrement avec saisie conservée), mise en évidence de l'habitude créée, toast « Habitude
  ajoutée », jetons de typographie (Sora, Inter) dans `ui/theme`, libellés lecteur d'écran
  (« Cuisiner, mercredi 14 octobre, à faire »), `useDayView` / `useCreateHabit` dans `ui/state`.
  Libellés exacts : ceux de la maquette.
- **Mobile** : assemblage dans `_layout.tsx` (la base ouverte est enfin utilisée :
  `SqliteUnitOfWork(db)` dans `Dependencies`), route `src/app/index.tsx` → `DayViewScreen`,
  polices Sora et Inter intégrées par le plugin `expo-font`, mise à jour de `e2e/flows/launch.yaml`
  (le `testID` `welcome-today` disparaît) et nouveau flux e2e.

### Domaine
- `HabitName.parse(raw)` : `normalize('NFC')`, retrait des espaces de début et de fin, espaces
  internes (`/\s+/gu`, espaces insécables compris) réduits à un seul ; longueur comptée en **points
  de code** (`Array.from(name).length`, comme `length()` de SQLite) : 1 à 40 ; `key` =
  `name.toLowerCase()` (sans locale : « Eté » ≠ « Été », « Cuisiner » = « cuisiner »).
- `assertNameAvailable(habits, name)` : doublon si même `key`.
- `assertCanAddHabit(habits)` : au plus `MAX_HABITS = 10`.
- `Habit.isActiveOn(day)` : `createdOn ≤ day` (R20) ; le jour de création est `clock.today()` au
  moment de la création (R1, R2).

### Cas d'usage et ports
- `createHabit({ clock, unitOfWork }, rawName)` : dans une transaction, lit les habitudes, applique
  limite + nom + doublon, ajoute avec `createdOn = today`. La transaction couvre limite et doublon
  (pas de course possible). Renvoie l'habitude ou le motif du refus.
- `getDayView({ clock, unitOfWork })` : habitudes actives aujourd'hui, dans l'ordre de création,
  toutes `Pending` dans cette story ; `canAddHabit`.
- Ports : `HabitRepository` (`listAll`, `add`), `UnitOfWork`, `Repositories`.

### Adaptateurs
`SqliteUnitOfWork` (file d'attente : une transaction à la fois ; capture du résultat de `work`
puisque `SqlDatabase.transaction` renvoie `void`), `SqliteHabitRepository` (tri par `id`) ;
`InMemoryUnitOfWork` et `InMemoryHabitRepository` (restaurent leur état si `work` échoue) ; un
contrat commun `habitRepositoryContract` + `unitOfWorkContract` (rollback, sérialisation).

### Données
Migration `0002-create-habits.ts` (schéma du plan d'ensemble), ajoutée à
`migrations/index.ts`. L'index `UNIQUE` sur `name_key` est un filet de sécurité : la règle est
vérifiée par le domaine avant.

### Plan de test
- Unitaire : `HabitName` (espaces, 40/41 caractères, emoji simple = 1, accents, majuscules, NFC),
  `HabitRules`, `Day` (ISO aller-retour, comparaisons), `createHabit` et `getDayView` avec
  `FixedClock` et mémoire (ordre, jour de création, limite, doublon, panne d'écriture → rien créé).
- Intégration : contrats SQLite/mémoire ; migration 0002 sur une base en version 1 avec des
  données `key_value` ; `DayViewScreen` et `NewHabitSheet` (états, bouton désactivé, message de
  limite, focus, annonces d'erreur, saisie conservée).
- BDD : `features/create-habit.feature` (15 scénarios de l'issue) + adaptation de
  `features/startup.feature` (« l'écran d'accueil s'affiche » = Vue Journée). Redémarrage : nouveau
  `renderRouter` sur la même base. Erreur de chargement : lecture de `habits` en échec.
- E2E : `e2e/flows/create-habit.yaml` (état vide → créer « Cuisiner » → relance à froid → toujours
  là ; captures : vide, panneau, liste), `launch.yaml` mis à jour.

### Risques
- **Comptage des caractères** : un emoji composé (famille, drapeau) compte pour plusieurs points
  de code. Accepté (la règle PM dit « chaque emoji compte pour un caractère » ; vrai pour les emoji
  simples). Le compteur de l'interface doit appeler `habitNameLength` du domaine et **ne pas**
  utiliser `maxLength` de `TextInput` (qui compte en unités UTF-16 et tronquerait un collage, alors
  que le scénario demande d'informer le joueur).
- `String.prototype.normalize` sous Hermes : à vérifier par l'e2e (créer « Été » puis « été »).
- Horloge du téléphone fausse à la création : l'habitude est datée de ce faux jour (R1). Accepté.
- Remplacement de `WelcomeScreen` : tests du socle à adapter (`WelcomeScreen.test.tsx`,
  `startup.steps.ts`, `launch.yaml`, `test/app/startup.test.tsx`).
- Polices : le plugin `expo-font` change la configuration native ; vérifier le build APK en CI.

### Impact (sommaire, sans GitNexus)
Fichiers existants modifiés : `Day.ts` (+ test), `migrations/index.ts`, `Dependencies.tsx`,
`_layout.tsx`, `app/index.tsx`, `WelcomeScreen*` (supprimés), `startup.feature` et ses étapes,
`test/app/startup.test.tsx`, `launch.yaml`, `app.json`, `package.json`, `docs/glossary.md` : environ
13 fichiers, 4 modules. **Fort au sens du workflow** (migration, plus de 10 fichiers), attendu et
couvert par l'ADR 0002 ; aucun conflit avec les autres stories.

---

## #4 — Confirmer ses habitudes du jour d'un tap

### Couches touchées
`domain`, `application`, `adapters/persistence`, `adapters/device`, `adapters/ui`, `app`, `e2e`,
`features`, glossaire (Horloge, Case, Suivi).

### Devs nécessaires
- **Backend** : `CheckIn`, `CheckInStatus`, `HabitDay`, `DayClosing`, `Day.isBefore`, cas d'usage
  `toggleCheckIn`, `getDayView` étendu, `getCheckInHint`/`dismissCheckInHint`, port
  `CheckInRepository`, extension de `Clock` (`onTodayChange`), migration 0003, adaptateurs SQLite et
  mémoire + contrat.
- **Mobile** : `SystemClock.onTodayChange` (minuterie jusqu'au prochain minuit local, `AppState`,
  relecture toutes les 30 s quand l'app est active, notification seulement si le jour a changé),
  `FixedClock.setToday` qui prévient, e2e.
- **Front** : tap sur toute la ligne (`accessibilityRole="switch"` / état coché), coche visible
  (pas seulement la couleur), rebond 320 ms, compteur « faites » et barre de la Journée, message
  d'encouragement quand tout est fait (maquette), aide au premier usage, annonce « Nouvelle
  journée : jeudi 15 octobre », retour arrière + message bref en cas d'échec, `useToday` abonné à
  l'horloge, `TrackingRevision`.

### Domaine
- `toggleCheckIn(habit, day, current, today)` :
  - `day < habit.createdOn` → refus `NotStartedDayError` ; `day > today` → refus
    `UpcomingDayError` (R7 : un suivi devenu futur n'est pas modifiable) ;
  - `day = today` → `done` inversé, `corrected = false` ;
  - `day < today` (jour clos : tap juste après minuit, ou plus tard une correction) → `done` **et**
    `corrected` inversés, `isCorrection = true`.
- Toujours un seul suivi par habitude et par jour : la lecture et l'écriture se font dans la même
  transaction, à partir de l'état **stocké** (pas de l'état affiché), donc trois taps rapides
  donnent « fait ».
- `habitDayOf` et la table du plan d'ensemble (R4, R7, R8, R20).

### Cas d'usage et ports
- `toggleCheckIn({ clock, unitOfWork }, habitId, day)` : `day` est le jour **de la case affichée**
  (la Vue Journée envoie le jour qu'elle affiche, pas `today`) ; `today` est relu dans la transaction.
  C'est ce qui rend correct le scénario « Tap au moment du changement de jour ».
- `getDayView` : statuts `Pending`/`Done` réels ; habitudes dont `createdOn ≤ today` (« Horloge
  reculée avant la création »).
- Ports : `CheckInRepository` (`find`, `save`, `listBetween`), `HabitRepository.findById`,
  `Clock.onTodayChange`.

### Adaptateurs
`SqliteCheckInRepository` (`INSERT … ON CONFLICT (habit_id, day) DO UPDATE`, `DELETE` quand
`done = 0 AND corrected = 0`), `InMemoryCheckInRepository`, contrat commun ; `SystemClock`,
`FixedClock`.

### Données
Migration `0003-create-check-ins.ts` (schéma du plan d'ensemble) : la colonne `corrected` est
**écrite dès cette story** (note Ready n° 2 de l'épique). Aucune donnée existante à transformer.

### Plan de test
- Unitaire : `toggleCheckIn` (aller-retour, triple tap, jour clos → `corrected`, refus hors habitude
  et à venir), `habitDayOf` (tableau complet R8 + R7), `isClosedDay`, cas d'usage avec `FixedClock`
  (minuit, fuseau vers l'ouest : `today` recule et la case redevient `Pending`).
- Intégration : contrat `CheckInRepository` (dont : une ligne `done = 0, corrected = 0` n'existe
  jamais ; cascade pas encore exercée) ; `SystemClock` avec minuteries simulées (prévient à minuit,
  au retour au premier plan, pas de notification sans changement, désabonnement) ; `DayViewScreen`
  (tap, échec → retour arrière, aide au premier usage, passage de jour).
- BDD : `features/check-in.feature` (15 scénarios). Le scénario « Tap au moment du changement de
  jour » vérifie aussi en base `corrected = 1` (préparation de #9).
- E2E : `e2e/flows/check-in.yaml` (créer, taper, re-taper, relancer, toujours « fait » ; captures
  E1 « à faire », « fait », tout fait).

### Risques
- **Concurrence** : sans la file de `SqliteUnitOfWork`, deux taps rapides ouvrent deux `BEGIN` sur
  la même connexion expo-sqlite (erreur). Test de contrat dédié (taps concurrents).
- Minuterie de minuit et mise en veille Android : la minuterie peut être retardée ; le retour au
  premier plan et la relecture périodique rattrapent. `setTimeout` de plus de 24 h à éviter (recalculer
  à chaque déclenchement).
- Jour d'été / d'hiver : le prochain minuit se calcule avec `new Date(y, m, d + 1)` (heure locale),
  jamais en ajoutant 24 h.
- Fausses minuteries de Jest et promesses SQLite : ne pas simuler `nextTick`/`queueMicrotask`.
- Interface optimiste : l'état affiché après une rafale de taps doit être recalé sur la réponse du
  dernier cas d'usage.

### Impact (sommaire, sans GitNexus)
Modifie `Clock.ts` (port du socle, ajout d'une méthode : `SystemClock`, `FixedClock` et leurs tests
suivent), `Day.ts`, `migrations/index.ts`, `getDayView`, `DayViewScreen`, `useToday`,
`Dependencies` : environ 12 fichiers. **Fort au sens du workflow** (migration, port partagé),
couvert par l'ADR 0002.

---

## #7 — Voir sa semaine et les semaines précédentes

### Couches touchées
`domain`, `application`, `adapters/ui`, `app`, `e2e`, `features`. Pas de persistance nouvelle.

### Devs nécessaires
- **Backend** : `Day.plusDays`, `Day.dayOfWeek`, `Week`, `History` (bornes en semaines), cas
  d'usage `getWeekView`.
- **Front** : `WeekViewScreen` (une carte par habitude, 7 cases, aujourd'hui mis en évidence),
  composant `HabitDayCell` avec les **cinq formes** (coche, contour plein, croix sur fond plein,
  pointillés, point seul), sélecteur de semaine (« Semaine précédente », « Semaine suivante », retour
  à la semaine en cours, libellés de la maquette), états chargement / erreur + « Réessayer » / aucune
  habitude, `TabBar`, libellés lecteur d'écran et « indisponible ». Dans cette story, **seule la
  case d'aujourd'hui est interactive** (les jours clos le deviennent en #9).
- **Mobile** : groupe `(tabs)` avec `Tabs` d'`expo-router`, déplacement de `index.tsx`, route
  `week.tsx`, e2e.

### Domaine
- `Week.containing(day)` : du lundi (`dayOfWeek` ISO 1) au dimanche (R3).
- `History.of(habits, today)` : première semaine = semaine du plus ancien `createdOn` parmi les
  habitudes existantes, dernière = semaine d'aujourd'hui ; sans habitude, semaine en cours seule
  (R22).

### Cas d'usage et ports
`getWeekView({ clock, unitOfWork }, week)` : toutes les habitudes existantes (R21, y compris
celles créées après la semaine : 7 cases `NotStarted`), `checkIns.listBetween(week.start,
week.end)`, `habitDayOf` pour chaque case, `canGoPrevious` / `canGoNext`. Aucun nouveau port.

### Adaptateurs
Aucun nouveau. `SqliteCheckInRepository.listBetween` utilise l'index `check_ins_by_day`.

### Données
Aucune migration.

### Plan de test
- Unitaire : `Week` (lundi/dimanche, changement de mois et d'année, semaine du 29 décembre),
  `plusDays`, `dayOfWeek`, `History`, `getWeekView` (cinq états du scénario, suivi futur « fait »
  non modifiable, bornes de navigation).
- Intégration : `WeekViewScreen` (formes des cases, désactivation des flèches, erreur puis retour à
  la semaine en cours), `TabBar`.
- BDD : `features/week-view.feature` (13 scénarios). « Le dimanche soir… » : la vue qui montre la
  semaine en cours suit `onTodayChange` ; une semaine passée affichée reste affichée.
- E2E : `e2e/flows/week-view.yaml` (onglet Semaine, tap sur la case du jour, retour Journée « fait »,
  semaine précédente ; captures E4).

### Risques
- État de la semaine affichée : la mémoriser comme « semaine en cours » ou comme une semaine fixe,
  sinon minuit du dimanche ne fait pas avancer la vue (ou la fait avancer à tort).
- Cohérence entre onglets (tap dans la Semaine, Journée à jour) : repose sur `TrackingRevision`.
- Le déplacement de `index.tsx` dans `(tabs)` touche les tests qui chargent les routes
  (`renderRouter`).

### Impact (sommaire, sans GitNexus)
Modifie `Day.ts`, `app/index.tsx` (déplacé), `_layout.tsx` éventuellement, `DayViewScreen` (rien de
fonctionnel), étapes BDD qui naviguent. Environ 5 fichiers, aucune migration, aucun port modifié :
**faible**.

---

## #9 — Corriger un jour passé

### Couches touchées
`application` (peu), `adapters/ui`, `app` (rappel de navigation), `e2e`, `features`. Le domaine et
la persistance sont déjà prêts depuis #4.

### Devs nécessaires
- **Backend** : vérifier par des tests que `toggleCheckIn` couvre toutes les règles R10–R13 (pas de
  nouveau code attendu dans le domaine) ; `getWeekView` expose déjà `corrected` ;
  `getYesterdayReminder` / `dismissYesterdayReminder` si le PM confirme le rappel (voir risques).
- **Front** : cases des jours clos interactives dans la Vue Semaine, pastille « corrigé » en coin
  de case (forme + mot pour le lecteur d'écran : « …, fait, corrigé »), toast « Correction
  enregistrée », message pour une case hors habitude, retour arrière en cas d'échec (état **et**
  marque), Journée : tap juste après minuit enregistré sur le jour affiché puis passage au nouveau
  jour (comportement déjà livré en #4, la marque devient visible dans la Semaine).
- **Mobile** : rappel de navigation « Corriger » → onglet Semaine (si rappel retenu), e2e.

### Domaine
Rien de nouveau : R10 (pas de limite), R12 (refus avant le jour de création, refus à venir), R13
(`corrected` inversé à chaque correction, remis à faux par un tap le jour même) sont dans
`toggleCheckIn` depuis #4. Ajouter les tests nommés R10–R13 manquants.

### Cas d'usage et ports
`toggleCheckIn` (inchangé), `getWeekView` (inchangé). Aucun nouveau port.

### Adaptateurs
Aucun nouveau.

### Données
Aucune migration : la colonne `corrected` existe et est remplie depuis #4. Les corrections faites
entre #4 et #9 (tap juste après minuit) s'affichent donc avec leur marque sans reprise de données.

### Plan de test
- Unitaire : séquences de corrections (pas fait → fait → pas fait : marque posée puis effacée ;
  fait à la clôture → pas fait : marque ; jour sauté par un fuseau vers l'est ; premier jour de
  l'habitude corrigeable ; veille de la création refusée).
- Intégration : `HabitDayCell` (pastille, libellé), `WeekViewScreen` (tap sur un jour clos, échec).
- BDD : `features/correction.feature` (12 scénarios), dont « Les corrections et leur marque sont
  conservées après redémarrage ».
- E2E : `e2e/flows/correction.yaml`. Sur un émulateur fraîchement installé, une habitude créée le
  jour même n'a aucun jour clos corrigeable (la veille est « hors habitude »), et Maestro ne pilote
  pas la date. Proposition : l'e2e vérifie le refus sur une case hors habitude et capture la
  Semaine ; les corrections réelles sont couvertes en BDD. Les captures E5 de la PR viennent des
  tests d'écran, à signaler au Reviewer.

### Risques
- **Rappel d'hier** (« Hier : 2/4 faites · Corriger ») : choix UX validé dans l'épique et présent
  dans la maquette, mais **aucun critère d'acceptation** ne le porte. Proposition : le livrer dans
  #9 (il mène à la correction), fermeture mémorisée par jour dans `key_value`
  (`day-view.yesterday-reminder.dismissed-for` = jour ISO). À confirmer par le PM ; sinon il risque
  d'être oublié par toutes les stories.
- L'e2e ne peut pas produire un jour clos (voir plan de test).
- Confusion possible pour le joueur entre « hors habitude » et « pas fait » : formes distinctes,
  message explicatif (maquette).

### Impact (sommaire, sans GitNexus)
Modifie `WeekViewScreen`, `HabitDayCell`, éventuellement `DayViewScreen` (rappel) et
`(tabs)/index.tsx`. Environ 4 à 6 fichiers, aucun port, aucune migration : **faible**.

---

## #5 — Gagner de l'expérience en tenant ses habitudes

### Couches touchées
`domain`, `application`, `adapters/persistence`, `adapters/device`, `adapters/ui`, `app`, `e2e`,
`features`, glossaire (Retour haptique, Xp conservée).

### Devs nécessaires
- **Backend** : `Character` (solde, plancher, `XP_PER_CHECK_IN`), port `CharacterRepository`,
  migration 0004 avec calcul rétroactif, `toggleCheckIn` qui met à jour le personnage **dans la
  même transaction** et renvoie `xpChange` et `xp`, cas d'usage `getCharacter`.
- **Front** : compteur « 40 XP » dans l'en-tête de la Journée et de la Semaine (or `#FFC94D`,
  chiffres tabulaires, libellé « Expérience du personnage : 40 XP »), feedback « +10 XP » qui
  s'envole vers le compteur (900 ms) et compteur animé (450 ms), « −10 XP » discret, aucune
  animation quand le mouvement réduit est demandé (`AccessibilityInfo.isReduceMotionEnabled` et son
  événement), annonce « +10 points d'expérience. Total : 40 XP. », même feedback pour une
  correction, aucun feedback si `xpChange = 0`.
- **Mobile** : port `Haptics` implémenté par `ExpoHaptics` (`expo-haptics`, installé par
  `npx expo install`), `SilentHaptics` pour les tests, assemblage, e2e.

### Domaine
- `Character.applyCheckInChange(done: boolean)` : +10 si la case passe à « fait », −10 sinon, jamais
  sous 0 (R14, R16). Uniquement sur un vrai changement d'état : `toggleCheckIn` change toujours
  l'état ou refuse, donc un refus vaut 0.
- La clôture du jour ne touche pas au personnage (rien n'est écrit à minuit).
- Invariant (R15 précisé par la note Ready) : `xp = 10 × count(done = 1) + retainedXp` pour les
  habitudes existantes, **toutes dates confondues** ; un recul d'horloge ou un changement de fuseau
  n'a donc aucun effet (R6).

### Cas d'usage et ports
- `toggleCheckIn` : lit habitude, suivi et personnage, applique, enregistre suivi + personnage dans
  une transaction ; en cas d'échec, rien n'est enregistré (état et XP inchangés).
- `getCharacter` : solde courant.
- Ports : `CharacterRepository` (`get`, `save`), `Repositories.character`, `Haptics`.

### Adaptateurs
`SqliteCharacterRepository` (ligne `id = 1`), `InMemoryCharacterRepository`, contrat commun ;
`ExpoHaptics`, `SilentHaptics` (`adapters/device/haptics`).

### Données
Migration `0004-create-character.ts` : création + `INSERT … SELECT 10 * COUNT(*) FROM check_ins
WHERE done = 1` (R19 : 7 suivis « fait » → 70 Xp). `retained_xp = 0` car aucune suppression n'est
possible avant #6 (ordre de livraison à respecter : **#5 avant #6**). La migration fige le barème
10 : un barème futur différent passera par une nouvelle migration.

### Plan de test
- Unitaire : `Character` (gain, perte, plancher), `toggleCheckIn` (+10, −10, triple tap = +10,
  correction ±10, refus = 0, panne = rien), test de table de l'**invariant** sur des séquences
  aléatoires déterministes (taps, corrections, minuit, recul d'horloge).
- Intégration : migration 0004 sur une base en version 3 remplie (70 Xp ; base vide → 0 Xp) ;
  contrat `CharacterRepository` ; transaction : panne simulée sur l'écriture du personnage → le
  suivi n'est pas enregistré non plus ; compteur et feedback (mouvement réduit simulé).
- BDD : `features/experience.feature` (15 scénarios). « L'expérience existante est calculée… » :
  base en version 3 préparée par la migration 0003 puis ouverture de l'app (migration 0004).
  « Ne descend jamais sous 0 » : l'étape force un état incohérent (`UPDATE character SET xp = 0`
  avec un suivi « fait » aujourd'hui), c'est la règle de sécurité R16.
- E2E : `e2e/flows/experience.yaml` (tap → « 10 XP », re-tap → « 0 XP », relance → conservé ;
  capture du feedback).

### Risques
- Dérive entre le solde et l'invariant si une écriture sort de la transaction : test de contrat
  et revue (aucune écriture de suivi hors `toggleCheckIn`).
- Animation et tests : l'envol ne doit pas retarder la mise à jour du compteur pour le lecteur
  d'écran ; tests avec minuteries simulées.
- `expo-haptics` ajoute un module natif : vérifier le build APK en CI.

### Impact (sommaire, sans GitNexus)
Modifie `toggleCheckIn` (cas d'usage partagé par la Journée, la Semaine et la correction),
`Repositories`, `SqliteUnitOfWork`, `InMemoryUnitOfWork`, `migrations/index.ts`, `Dependencies`,
`_layout.tsx`, en-têtes de `DayViewScreen` et `WeekViewScreen`, `package.json`, `app.json` :
environ 12 fichiers. **Fort au sens du workflow** (migration avec reprise de données, règle partagée),
couvert par l'ADR 0002.

---

## #6 — Renommer et supprimer une habitude

### Couches touchées
`domain`, `application`, `adapters/persistence`, `adapters/ui`, `e2e`, `features`.

### Devs nécessaires
- **Backend** : `assertNameAvailable(…, exceptId)`, `Character.retainOnHabitDeletion`, cas d'usage
  `renameHabit`, `previewHabitDeletion`, `deleteHabit`, méthodes `rename`, `remove`, `listByHabit`
  des dépôts + contrats.
- **Front** : bouton « ⋯ » à droite de chaque ligne de la Journée (cible distincte du tap qui
  confirme ; libellé « Modifier l'habitude Cuisiner ») et tap sur le nom dans la Semaine ;
  `EditHabitSheet` (sans clavier à l'ouverture, enregistrement désactivé tant que le nom n'a pas
  changé, erreurs comme à la création) ; `DeleteHabitDialog` (nomme l'habitude, suivis effacés, XP
  retirée ou conservée, « Annuler » par défaut, action destructive signalée autrement que par la
  couleur) ; mise à jour du compteur ; état vide après la dernière suppression.
- **Mobile** : e2e uniquement (aucune route nouvelle).

### Domaine
- Renommer (R18) : mêmes règles de nom ; l'habitude elle-même n'est pas un doublon (« CUISINER »
  permis) ; ni suivis, ni jour de création, ni XP ne changent.
- Supprimer (R17) : `xpRemoved = 10` si la case d'aujourd'hui est « fait », sinon 0, borné par le
  solde (plancher R16) ; `retainedXp += 10 × (suivis « fait » de l'habitude dont le jour ≠
  aujourd'hui)`. Les suivis devenus futurs après un recul d'horloge sont donc **conservés** comme
  ceux des jours clos (cohérent avec « seule celle d'aujourd'hui est retirée » et avec l'invariant).

### Cas d'usage et ports
- `renameHabit`, `previewHabitDeletion` (texte de la fenêtre), `deleteHabit` (une transaction :
  calcul, mise à jour du personnage, `habits.remove` ; les suivis partent par `ON DELETE CASCADE`).
- Ports : `HabitRepository.rename`, `HabitRepository.remove`, `CheckInRepository.listByHabit`.

### Adaptateurs
SQLite et mémoire (le dépôt mémoire efface lui-même les suivis de l'habitude) ; contrat commun.

### Données
Aucune migration : `ON DELETE CASCADE` et `retained_xp` existent depuis 0003 et 0004.
`PRAGMA foreign_keys = ON` est indispensable (posé par `prepareAscentDatabase` à chaque ouverture).

### Plan de test
- Unitaire : renommage (doublon autre habitude, casse seule, vide, 41 caractères), suppression
  (40 → 30 Xp ; sans « fait » aujourd'hui → inchangé ; plancher 0 ; Xp conservée ; habitude
  recréée datée d'aujourd'hui, jours antérieurs hors habitude), invariant après suppression.
- Intégration : contrat (cascade réelle sur SQLite : plus aucun suivi), panne → rien de supprimé
  et XP inchangée, `EditHabitSheet`, `DeleteHabitDialog` (focus par défaut sur « Annuler »).
- BDD : `features/edit-habit.feature` (16 scénarios).
- E2E : `e2e/flows/edit-habit.yaml` (renommer, supprimer avec confirmation, état vide ; captures
  E7, E8).

### Risques
- Conflit de gestes dans la Journée entre la ligne (tap = confirmer) et « ⋯ » : zone de « ⋯ »
  d'au moins 44 × 44 et hors de la cible de la ligne.
- Sans `foreign_keys = ON`, la cascade ne se fait pas en silence : test d'intégration obligatoire.
- La navigation de la Semaine (et du Mois) doit se recalculer après suppression (première semaine
  plus récente) : la vue affichée peut devenir hors bornes, la ramener à la première semaine
  consultable.

### Impact (sommaire, sans GitNexus)
Modifie les dépôts (port partagé, ajout de méthodes), `HabitRules`, `Character`, `DayViewScreen`,
`WeekViewScreen`. Environ 8 fichiers, aucune migration : **faible à moyen** (ajouts sur des ports
existants, aucune signature modifiée).

---

## #10 — Consulter un mois et tout l'historique

### Couches touchées
`domain`, `application`, `adapters/ui`, `app`, `e2e`, `features`, glossaire (Mois, Jour neutre si
pas déjà fait).

### Devs nécessaires
- **Backend** : `Month` (grille lundi → dimanche), `History` étendu aux mois, cas d'usage
  `getMonthView` et `getDayDetail`.
- **Front** : `MonthViewScreen` (grille, compteur « faites / actives », un point par habitude
  active — plein = fait, cerclé = pas fait —, aujourd'hui mis en évidence, jours neutres et à venir
  distincts, repère discret « corrigé », compteur d'XP dans l'en-tête), sélecteur de mois,
  `DayDetailSheet` (état de chaque habitude, correction d'un tap, « corrigé » en toutes lettres),
  états chargement / erreur / aucune habitude, libellés lecteur d'écran (« mardi 13 octobre,
  2 habitudes faites sur 2 », « aucune habitude active »).
- **Mobile** : route `(tabs)/month.tsx`, troisième onglet, e2e.

### Domaine
- `Month.containing(day)`, `days()`, `weeks()` (cases vides avant le 1er et après le dernier jour
  pour aligner sur le lundi).
- Par jour (R23) : `active` = habitudes existantes avec `createdOn ≤ jour` ; `done` = suivis
  « fait » de ces habitudes ce jour ; **neutre** si `active = 0` ; **à venir** si `jour > today`
  (compteur non affiché) ; `corrected` = au moins une case corrigée ce jour (jour clos).
- `History` : premier mois = mois du plus ancien `createdOn` ; sans habitude, mois en cours seul.

### Cas d'usage et ports
`getMonthView({ clock, unitOfWork }, month)` (`listBetween(premier, dernier jour)`, une requête) ;
`getDayDetail(…, day)` (toutes les habitudes existantes, `NotStarted` compris) ; correction par
`toggleCheckIn` (XP et marque déjà gérées). Aucun nouveau port.

### Adaptateurs
Aucun nouveau.

### Données
Aucune migration.

### Plan de test
- Unitaire : `Month` (février bissextile, mois commençant un lundi ou un dimanche, 31 jours),
  `History` mois, `getMonthView` (compteurs 1/1, 2/2, 0/2, neutres, à venir), `getDayDetail`.
- Intégration : `MonthViewScreen`, `DayDetailSheet` (correction, repère « corrigé », hors habitude
  inerte), erreur de chargement + « Réessayer ».
- BDD : `features/month-view.feature` (14 scénarios).
- E2E : `e2e/flows/month-view.yaml` (onglet Mois, ouvrir aujourd'hui, confirmer, compteur 1/1 ;
  captures E6).

### Risques
- Performance : 31 jours × 10 habitudes au plus, une seule requête par mois ; aucun risque notable.
- Le libellé « Mois précédent » doit rester désactivé quand la première habitude a été supprimée
  (#6) : bornes recalculées à chaque chargement.
- Ordre de livraison : #10 dépend de #5 (XP dans l'en-tête et pour les corrections) ; s'il était
  livré avant #6, les scénarios de suppression de #10 attendraient #6 (l'issue dit « peut être
  livrée avant ou après #6 » : dans ce cas, le scénario « Une habitude supprimée disparaît de
  l'historique » prépare l'état directement en base).

### Impact (sommaire, sans GitNexus)
Ajoute des fichiers ; modifie `History`, `(tabs)/_layout.tsx`, `TabBar`. Environ 3 fichiers
existants, aucune migration, aucun port : **faible**.
