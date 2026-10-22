# ADR 0001 — Socle technique et barrières de qualité

- **Statut** : accepté
- **Date** : 14 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : préalable à l'épique #2 (stories #3, #4, #7, #9, #5, #6, #10)

## Contexte

Le dépôt ne contenait ni code applicatif ni pipeline. L'épique #2 demande une application mobile
qui fonctionne hors ligne, avec des données stockées sur le téléphone uniquement, et le propriétaire
veut une version testable livrée en **APK Android**. `docs/workflow.md` fixe l'architecture
hexagonale, les barrières de qualité (toutes bloquantes) et leurs seuils, mais laisse les outils
« pressentis » à confirmer par l'Architect.

Contraintes constatées lors de la mise en place :

- Les services Expo (`api.expo.dev`, donc EAS Build) et le SDK Android (`dl.google.com`) ne sont
  pas joignables depuis l'environnement des agents : l'APK ne peut pas y être construit.
- Aucun compte SonarQube Cloud n'est encore configuré pour le dépôt.
- Aucun émulateur n'est disponible en local pour les tests end-to-end.

## Décision

### Stack

| Sujet | Choix |
|---|---|
| Application | Expo SDK 57 (React Native 0.86, React 19.2), TypeScript 6 en mode strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Navigation | Expo Router, routes dans `src/app/` |
| Natif | Continuous Native Generation : `android/` et `ios/` sont générés (`expo prebuild`) et jamais versionnés |
| Identité | Nom « Ascent », package Android et bundle iOS `com.bpotet.ascent`, thème sombre (`userInterfaceStyle: dark`) |
| Base locale | SQLite via `expo-sqlite`, migrations versionnées par `PRAGMA user_version` |
| Node | 22 (`.nvmrc`), requis notamment pour `node:sqlite` dans les tests |

### Architecture

L'arborescence est celle de `docs/workflow.md` : `src/domain`, `src/application`,
`src/adapters/{persistence,ui,device}`, `src/app`, `e2e/`. Le socle livre :

- **Domaine** : `Day` (Jour), date du calendrier local, sans heure ni fuseau.
- **Ports** (`src/application/ports`) : `Clock` (Horloge, donne aujourd'hui) et `KeyValueStore`
  (Stockage clé-valeur). Cas d'usage d'exemple : `getToday`.
- **Persistence** : `SqlDatabase`, une interface SQL minimale implémentée par `expo-sqlite` sur le
  téléphone (`openAscentDatabase`, `expoSqliteDatabase`) et par `node:sqlite` dans les tests
  (`testing/nodeSqliteDatabase`), pour tester les adaptateurs sur une **vraie base SQLite** ;
  `runMigrations` (une transaction par migration, refus d'une base plus récente que l'application) ;
  sur le téléphone, la transaction passe par `withTransactionAsync`, sur la **même connexion** que les
  requêtes de la migration (`withExclusiveTransactionAsync` ouvre une autre connexion et laisserait
  ces requêtes hors transaction) ; si l'ouverture ou une migration échoue, la connexion est fermée
  avant que l'erreur ne remonte ; `SqliteKeyValueStore` et
  `InMemoryKeyValueStore`, qui passent le même **test de contrat**.
- **Device** : `SystemClock` (date locale du téléphone) et `FixedClock` (date fixée, pour les tests).
- **UI** : `DependenciesProvider` (les ports fournis à l'interface), écran d'accueil provisoire
  `WelcomeScreen` (« Ascent » et la date du jour), écrans de démarrage (chargement, erreur avec
  « Réessayer »). La Vue Journée de #3 remplacera l'écran d'accueil.
- **App** : `_layout.tsx` est l'assemblage : il ouvre la base locale (migrations comprises), puis
  branche les adaptateurs sur l'interface.

Les fichiers de `src/**/testing/` sont des aides de test : jamais importées par le code livré
(vérifié), exclues de la couverture et de la mutation.

### Barrières de qualité

| # | Barrière | Outil retenu | En local | CI (job) |
|---|---|---|---|---|
| 1 | Secrets | Gitleaks 8 (`.gitleaks.toml`, règles par défaut) | hook pre-commit (`npm run secrets`) | `secrets` |
| 1 bis | Commits | commitlint + `@commitlint/config-conventional`, types et scopes de `docs/workflow.md` | hook commit-msg | `commits`, `PR title` |
| 2 | Style | Prettier 3 + ESLint 9 (`eslint-config-expo`, `eslint-config-prettier`) | pre-commit (lint-staged), `npm run format:check`, `npm run lint` | `static` |
| 3 | Types | `tsc --noEmit` | pre-commit, `npm run typecheck` | `static` |
| 4 | Architecture | dependency-cruiser (`.dependency-cruiser.cjs`) | `npm run arch` | `static` |
| 5 | Tests unitaires | Jest, projet `unit` (`src/domain`, `src/application`) | `npm run test:unit` | `tests` |
| 6 | Tests d'intégration | Jest (`jest-expo`) + React Native Testing Library 14, projet `integration` (`src/adapters`, `test/`) | `npm run test:integration` | `tests` |
| 7 | Tests BDD | jest-cucumber, projet `bdd` (`features/*.feature` en `# language: fr`, étapes dans `features/step-definitions/`) | `npm run test:bdd` | `tests` |
| 8 | End-to-end | Maestro (`e2e/flows`) sur émulateur Android | — | `e2e-android` |
| 9 | Mutation | StrykerJS 10 + jest-runner | `npm run mutation:changed`, `npm run mutation`, `npm run mutation:domain` | `mutation` |
| 10 | Coverage et qualité | Jest (seuils) + SonarQube Cloud (`sonar-project.properties`) | `npm run test:coverage` | `tests`, `sonar` |

`npm run verify` enchaîne en local style, types, architecture et tous les tests avec les seuils de
couverture ; `npm run verify:full` y ajoute la mutation complète. Les hooks Git sont installés par
husky au `npm install`.

Règles d'architecture (dependency-cruiser), appliquées à tout `src/`, tests compris :
`domain` n'importe rien hors de `domain` (ni bibliothèque, ni module Node) ; `application`
n'importe que `domain` ; un adaptateur n'importe pas un autre adaptateur ; personne n'importe `app` ;
pas de cycle ; pas de dépendance non déclarée ; pas de devDependency dans le code livré ; pas d'aide
de test dans le code livré.

Seuils, tels que `docs/workflow.md` les fixe :

- Couverture : ≥ 80 % sur l'ensemble et ≥ 95 % sur `src/domain` (Jest, bloquant). La couverture et
  la duplication du **code nouveau** sont mesurées par SonarQube Cloud.
- Mutation : en PR, seuls les fichiers de `src/` modifiés sont mutés (`scripts/mutation-changed.mjs`),
  seuil 70 %, et 85 % pour les fichiers du domaine ; sur `release/*` et `hotfix/*`, tout le code
  est muté : le domaine avec ses seuls tests unitaires (85 %), le reste avec tous les tests (70 %).
  Chaque fichier n'est muté qu'une fois. Un push sur `develop` ou `main` ne relance pas la mutation :
  le code y arrive déjà muté par sa PR ou par sa branche de release.
- Les styles visuels (`StyleSheet.create`, options d'apparence de la navigation) sont exclus de la
  mutation par un commentaire `// Stryker disable all: …` : leur contrôle est la conformité aux
  maquettes (barrière 10 bis). Aucune autre exclusion n'est admise sans ADR.

### CI/CD

- **`CI`** (PR vers `develop`, `main`, `release/*`, `hotfix/*`, et push sur ces branches) : jobs
  `commits`, `secrets`, `static`, `tests`, `mutation`, `sonar`, `android-apk`, `e2e-android`.
- **`android-apk`** : `expo prebuild --platform android` puis `./gradlew assembleRelease` (JDK 17),
  APK publié en artefact `ascent-android-apk`. Sur `develop`, c'est le **build de preview**.
- **`cleanup-artifacts`** (PR du dépôt et push sur `develop`) : supprime les anciens artefacts
  `ascent-android-apk` (`scripts/ci/cleanup-artifacts.mjs`). Conservation : APK 1 jour sur une PR,
  7 jours sur `develop`, 30 jours sur `main`, `release/*` et `hotfix/*` ; rapports de couverture
  et d'end-to-end 7 jours (voir « CI/CD et Git Flow » dans `docs/workflow.md`).
- **`Release`** (tag `v*`) : construit l'APK et l'attache à la GitHub Release du tag.
- **EAS Build et EAS Update ne sont pas retenus** pour l'instant : les builds passent par GitHub
  Actions, sans compte Expo ni service externe.

## Conséquences

### Positives

- Toutes les barrières sauf l'end-to-end s'exécutent en local, en une commande (`npm run verify`).
- Les adaptateurs de persistance sont testés sur une vraie base SQLite, sans émulateur.
- Le domaine et les cas d'usage restent testables sans framework.
- Un APK installable est produit à chaque push, et attaché à chaque release.

### Négatives et risques

- `node:sqlite` est encore expérimental dans Node 22 (avertissement à l'exécution) ; le SQL reste
  standard, mais une différence de comportement avec `expo-sqlite` reste possible : les tests
  end-to-end sur l'APK sont le filet de sécurité. Le pont vers `expo-sqlite` est testé en
  intégration avec une connexion simulée (`testing/fakeExpoSqlite`) qui reproduit le comportement
  transactionnel d'expo-sqlite 57 ; seul le module natif lui-même n'est exercé que par l'end-to-end.
- L'APK est signé avec la **clé de debug** : installable pour tester, pas publiable sur un store.
  Une clé de signature (secret GitHub) sera nécessaire avant toute publication.
- ESLint reste en 9 : `eslint-config-expo` et ses plugins ne sont pas encore validés avec ESLint 10.
- Prettier ne reformate pas le Markdown (`.prettierignore`) : la documentation est rédigée à la main.

### Écarts temporaires (à résorber)

| Écart | Raison | Sortie |
|---|---|---|
| Le job `sonar` est **sauté** (avertissement dans la CI) tant que le secret `SONAR_TOKEN` n'existe pas | Pas de compte SonarQube Cloud | Créer le projet `BPotet_ascent` dans l'organisation `bpotet` sur SonarQube Cloud, ajouter le secret `SONAR_TOKEN`, rendre le job obligatoire dans la protection de branche |
| Le job `e2e-android` est **non bloquant** (`continue-on-error`) | Émulateur en CI pas encore éprouvé (temps, stabilité) | Le rendre bloquant après une série de passages verts |
| Pas d'end-to-end ni de build **iOS** | Demande un runner macOS et un compte Apple | À décider à la première release iOS |
| Gitleaks est **facultatif en local** (le hook prévient s'il manque, la CI bloque toujours) | Binaire hors npm, non installable dans l'environnement des agents | Installer Gitleaks sur les postes et dans l'environnement des agents |
| Mutation en PR **par fichier modifié**, pas par ligne | StrykerJS mute des fichiers entiers | Acceptable : plus strict que « code nouveau » |
