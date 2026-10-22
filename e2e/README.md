# Tests end-to-end (Maestro)

Les parcours sont dans `flows/`, un fichier YAML par parcours, écrits avec [Maestro](https://maestro.mobile.dev).
Les sous-parcours partagés sont dans `subflows/`, hors de `flows/` pour ne pas être lancés seuls :
`launch-fresh.yaml` lance l'app sur une installation neuve et attend la Vue Journée vide, en
rejouant le lancement (au plus deux fois) si l'émulateur laisse un écran blanc.
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

La sonde de toucher (`preview-touch-probe.yaml`, outil du build de preview) s'ouvre par le lien
profond `ascent://preview/touch-probe` (`openLink`) : aucun bouton n'y mène. L'APK de la CI est
construit sur le canal `preview` ; sur un build de production, le lien ramène à l'accueil. En
local, lancer l'app avec `EXPO_PUBLIC_ASCENT_CHANNEL=preview` (par exemple
`EXPO_PUBLIC_ASCENT_CHANNEL=preview npx expo run:android --variant release`) pour ouvrir la sonde.

Sélecteurs : privilégier les textes visibles (libellés du glossaire) et les `testID` des écrans.

Libellés des lignes de la Vue Journée (lecteur d'écran) : `<nom>, <jour>, <état>[, corrigé], <progression>, <Difficulté>, <X> XP par suivi[, objectif atteint]`,
par exemple `Lire, mercredi 21 octobre, à faire, 2 sur 5 cette semaine, Moyenne, 10 XP par suivi`. La
progression de la semaine est `<N> sur <objectif> cette semaine`, puis `<N> fois cette semaine`
au-delà de l'objectif ; comme Maestro ne pilote pas la date, l'objectif d'une habitude créée
pendant le parcours dépend du jour (semaine de création réduite) : les parcours l'écrivent
`.+ cette semaine` ou `\d`. Les cases de la Vue
Semaine et du détail du jour ne portent pas la difficulté : `<nom>, <jour>, <état>`.

Vérifier la syntaxe sans émulateur : `maestro check-syntax e2e/flows/<parcours>.yaml`.
