# Tests end-to-end (Maestro)

Les parcours sont dans `flows/`, un fichier YAML par parcours, écrits avec [Maestro](https://maestro.mobile.dev).
Les sous-parcours partagés sont dans `subflows/`, hors de `flows/` pour ne pas être lancés seuls :
`launch-fresh.yaml` lance l'app sur une installation neuve et attend la Vue Journée vide, en
rejouant le lancement (au plus deux fois) si l'émulateur laisse un écran blanc. `expect-xp.yaml`
vérifie l'expérience exacte du personnage après un tap qui peut atteindre un objectif de la semaine
(voir « Prime d'objectif » plus bas).
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

Le combat d'essai (`trial-battle.yaml`, stories #31 et #32) s'ouvre par le bouton « Combat d'essai », au-dessus
de la barre d'onglets : il n'existe que dans le build de preview (canal `preview`), et la story #33 le
remplacera. Le bouton est dans le flux de la mise en page : en preview, il réduit la hauteur de la liste
de la Vue Journée, et `weekly-target.yaml` remonte donc jusqu'à la première habitude avant de la
modifier. Le parcours ne teste pas le timing de la parade ni de la frappe (Maestro ne touche pas à 10 ms
près). Depuis #32, le combat ne se gagne plus sans parer : le parcours joue « Attaquer » jusqu'à la fin
du combat, victoire ou défaite. Chaque commande Maestro prend une seconde ou plus sur l'émulateur de la
CI : le parcours n'attend que des états d'au moins 2 secondes, ou qui durent jusqu'à son action
suivante. La frappe en rythme (F3, « Frapper », 1 180 ms) est donc trop brève : elle est vérifiée par
les tests d'intégration et la revue, pas par Maestro. Le parcours capture les écrans F2, F1 (intentions,
garde, Élan, « Pouvoir »), P9, le Spectre étourdi (sa garde brisée par la frappe), puis l'écran de fin
(avec les panneaux Réglages d'essai et Mesures) pour la comparaison avec la maquette. Il utilise aussi le
Rempart. Les états précis (frappe parfaite, parades, garde du Nécromancien, tous étourdis, action
perdue) sont couverts par les tests d'intégration et les scénarios ; les captures de la scène dessinée
viennent avec #81. Les états brefs (P0, F0) sont capturés au second combat, après avoir allongé la
transition et l'avancée à 2 000 ms (le maximum) dans les réglages d'essai. Ce combat s'ouvre par le
Rempart (500 ms) plutôt que par « Attaquer » (1 180 ms) : la bannière P0 est alors à l'écran de 0,5 à
2,5 s après le toucher. Chaque état est attendu par un texte qui n'existe que dans cet état, sans attente
facultative. Le parcours joue les sons du combat et vérifie, dans le panneau Mesures, qu'une latence du
son a été mesurée. L'émulateur de la CI tourne sans animations : l'app réduit alors les animations, et
la bannière de phase porte l'identifiant `phase-banner-still`.

Sélecteurs : privilégier les textes visibles (libellés du glossaire) et les `testID` des écrans.

Libellés des lignes de la Vue Journée (lecteur d'écran) : `<nom>, <jour>, <état>[, corrigé], <progression>, <Difficulté>, <X> XP par suivi[, objectif atteint]`,
par exemple `Lire, mercredi 21 octobre, à faire, 2 sur 5 cette semaine, Moyenne, 10 XP par suivi`. La
progression de la semaine est `<N> sur <objectif> cette semaine`, puis `<N> fois cette semaine`
au-delà de l'objectif ; comme Maestro ne pilote pas la date, l'objectif d'une habitude créée
pendant le parcours dépend du jour (semaine de création réduite) : les parcours l'écrivent
`.+ cette semaine` ou `\d`. Les cases de la Vue
Semaine ne portent pas la difficulté : `<nom>, <jour>, <état>`. Les lignes du détail du jour non plus,
mais elles portent la progression de la semaine du jour (#27) : `<nom>, <jour>, <état>[, <progression>][, corrigé][, objectif atteint]`,
où la progression est `<N> sur <objectif> cette semaine` pour la semaine en cours et `<N> sur <objectif> semaine du <lundi>`
sinon (`2 sur 3 semaine du 12 octobre`) ; une habitude sans objectif de la semaine n'en a pas.

Compteurs (#25) : l'en-tête de la Vue Journée affiche `<faites>/<attendues> faites`, lu
`<N> habitude(s) faite(s) sur <M> attendue(s)` ; un jour de la Vue Mois est lu `<jour>[, aujourd’hui], <N>
habitude(s) faite(s) sur <M> attendue(s)`, ou `<jour>, objectifs de la semaine atteints, aucune habitude
attendue` avec le drapeau.

Prime d'objectif (#26) : une habitude créée pendant le parcours a un objectif de la semaine réduit
aux jours restants, 1 le dimanche ; son premier « fait » peut donc atteindre l'objectif et rapporter
la prime d'objectif. **Toute assertion d'Xp exacte après un tap qui peut atteindre un objectif passe
par `subflows/expect-xp.yaml`** (paramètres `ROW`, le libellé de la ligne sans `, objectif atteint`,
`XP` et `XP_IF_TARGET_REACHED`) : deux branches exclusives, choisies sur le libellé
`<ROW>, objectif atteint` lu par le lecteur d'écran, vérifient chacune une valeur exacte. Pour un
texte (message, confirmation de suppression), la branche porte sur le libellé lu avant l'action. Le
parcours `target-bonus.yaml` crée ses habitudes avec l'objectif 1 : il atteint l'objectif tous les
jours. Le message « Objectif de la semaine atteint » (F1) écrit son titre sur sa propre ligne :
`Objectif de la semaine atteint\sLire 1/1 · \+5 XP prime`.

Objectifs par semaine (#27) : sous la grille de la Vue Mois, la section `targets-by-week` a une
ligne par semaine (`week-targets-<lundi AAAA-MM-JJ>`), lue `Semaine du <jour> <mois>, <N> objectif(s)
atteint(s) sur <M>, ouvrir la semaine`, ou `Cette semaine, …` pour la semaine en cours (singulier
jusqu'à 1). Le texte affiché est `Semaine du 5 octobre` puis `3/4 objectifs atteints` (`0/1 objectif
atteint`). Toucher une ligne ouvre la Vue Semaine sur sa semaine.

Vérifier la syntaxe sans émulateur : `maestro check-syntax e2e/flows/<parcours>.yaml`.
