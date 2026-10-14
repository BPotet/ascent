# Tests end-to-end (Maestro)

Les parcours sont dans `flows/`, un fichier YAML par parcours, écrits avec [Maestro](https://maestro.mobile.dev).
Ils s'exécutent sur l'APK release, sans serveur de développement.

## En CI
Le job `e2e-android` du workflow `CI` installe l'APK du job `android-apk` sur un émulateur Android
(API 34) et lance `maestro test e2e/flows`. Les captures d'écran (`takeScreenshot`) sont publiées
dans l'artefact `e2e-report` pour la comparaison avec les maquettes.

## En local
Avec un émulateur ou un téléphone branché et l'APK installé :

```sh
maestro test e2e/flows
```

Sélecteurs : privilégier les textes visibles (libellés du glossaire) et les `testID` des écrans.
