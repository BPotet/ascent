# Test de fumée end-to-end (Maestro)

Décision du propriétaire du 3 novembre 2026 : l'end-to-end se réduit à un **test de fumée** rapide,
qui vérifie que l'app s'installe et démarre. Il n'y a plus de parcours ni de captures par story :
le propriétaire juge l'interface sur l'APK de preview.

- `flows/launch.yaml` : l'app s'ouvre hors ligne sur une installation neuve, crée sa base locale et
  affiche la Vue Journée vide ; une relance à froid rouvre la base déjà migrée. Il prouve aussi que
  l'écran de démarrage natif se cache (#166).
- `subflows/launch-fresh.yaml` : le lancement sur une installation neuve, rejoué au plus deux fois
  si l'émulateur de la CI laisse un écran blanc. Il est hors de `flows/` pour ne pas être lancé seul.

Le test s'exécute sur l'APK release, sans serveur de développement.

## En CI
Le job `e2e-android` du workflow `CI` installe l'APK du job `android-apk` sur un émulateur Android
(API 34) et lance `maestro test e2e/flows/launch.yaml`. Le rapport est publié dans l'artefact
`e2e-report`.

## En local
Avec un émulateur ou un téléphone branché et l'APK installé :

```sh
maestro test e2e/flows/launch.yaml
```

Pour construire l'app soi-même (`npx expo run:android`), passer `EXPO_IMAGE_UTILS_NO_SHARP=1`,
comme le build de la CI : si `sharp` est installé sur la machine, le prebuild lisserait l'icône de
l'application et l'écran de démarrage (#166, ADR 0011).

Vérifier la syntaxe sans émulateur : `maestro check-syntax e2e/flows/launch.yaml`.
