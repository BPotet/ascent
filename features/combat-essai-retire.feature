# language: fr
Fonctionnalité: Le combat d'essai est retiré du build de preview
  Story #121 (épique #118), décision du propriétaire du 28/10/2026 : tous les combats passent par
  l'ascension, dans l'onglet Tour. Le bouton provisoire « Combat d'essai » quitte le dessus de la
  barre d'onglets, et la transition de phase et l'avancée gardent les durées du glossaire.

  # Les scénarios `@ui` passent par les vraies routes de l'app (`src/app`), une vraie base SQLite
  # et le canal du build posé comme par l'action de build. La place exacte au pixel de la barre
  # d'onglets et de la liste se compare sur la capture du parcours e2e old-trial-battle-link.
  # Le scénario sans tag passe par la session d'ascension (cas d'usage), avec l'horloge de combat
  # manuelle. Le bienfait et l'objet trouvé de l'ascension restent vérifiés par les tests
  # d'intégration de l'ascension (AscentSession.test.ts, AscentScreen.test.tsx), inchangés.

  @ui
  Scénario: Plus de bouton « Combat d'essai »
    Étant donné le build de preview
    Quand le joueur ouvre l'app, sur n'importe quel onglet
    Alors aucun bouton « Combat d'essai » n'apparaît au-dessus de la barre d'onglets
    Et la barre d'onglets est à la même place que dans le build de production

  @ui
  Scénario: La Vue Journée retrouve sa hauteur
    Étant donné le build de preview
    Quand la Vue Journée s'affiche
    Alors sa liste a la même hauteur que dans le build de production

  @ui
  Scénario: Les combats de l'ascension ne changent pas
    Étant donné une ascension en cours
    Quand le joueur commence l'ascension, choisit son héros et entre dans un combat, une Élite ou le boss
    Alors le choix du héros, le combat, la bulle d'aide, le bienfait et l'objet trouvé sont ceux d'aujourd'hui

  @ui
  Scénario: Limite — un ancien lien vers le combat d'essai
    Étant donné le build de preview ou de production
    Quand l'app est ouverte sur l'ancienne adresse du combat d'essai
    Alors elle ramène à l'accueil, sans erreur

  Scénario: Limite — les réglages d'essai déjà enregistrés
    Étant donné un téléphone sur lequel des réglages d'essai ont été changés
    Quand le joueur entre dans un combat de l'ascension
    Alors la transition de phase dure 800 ms et l'avancée 400 ms, les valeurs du glossaire
    Et plus rien ne permet de les changer

  @ui
  Scénario: Limite — la sonde de toucher reste
    Étant donné le build de preview
    Quand le lien de la sonde de toucher est ouvert
    Alors la sonde s'ouvre comme aujourd'hui
