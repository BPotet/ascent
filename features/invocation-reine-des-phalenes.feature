# language: fr
Fonctionnalité: L'Invocation de la Reine des phalènes
  Story #172 (chemin B, Atelier du 03/11/2026, mécanique nouvelle) : la Reine des phalènes, boss du
  palier 2, appelle ses Phalénides à son changement de phase ; les Phalénides rejoignent les tirages
  du palier 2 (le Beffroi n'en tire plus depuis #214).

  # Les scénarios `@domain` éprouvent les règles du domaine : l'annonce, la poussière et l'aperçu de
  # la Frise d'action y sont l'Invocation annoncée (`summonCalled`, `pendingSummon`) et l'ordre de la
  # manche suivante (`nextRoundOrder`), que l'écran affiche tels quels. Les scénarios `@session`
  # passent par la session d'ascension et son stockage en mémoire ; les scénarios `@ui` passent par
  # l'écran de combat, sur une vraie session de combat et l'horloge de combat manuelle.

  @domain
  Scénario: La Reine est un boss du palier 2
    Quand le joueur atteint l'étage 6 du palier 2
    Alors le boss est la Jardinière des cendres ou la Reine des phalènes, tirées à égalité avec la graine de l'ascension

  @domain
  Scénario: La Reine appelle deux Phalénides à son changement de phase
    Étant donné la Reine des phalènes (400 PV) seule en combat
    Quand ses PV passent à 200 ou moins
    Alors sa garde revient à son maximum, son Initiative passe à 11 et sa Flamme de la lampe s'ajoute
    Et l'annonce « Elle appelle les Phalénides » s'affiche
    Et deux tas de poussière apparaissent à sa droite, aux deux places libres de la première ligne
    Et au début de la manche suivante, avant le calcul de l'ordre d'action, deux Phalénides en sortent, dans la première ligne

  @ui
  Scénario: La Frise d'action annonce les Phalénides
    Étant donné que la Reine vient d'annoncer l'Invocation
    Alors l'aperçu « suiv. » de la Frise d'action montre déjà les deux Phalénides, en pointillé, avec le portrait de la Phalénide
    Et au début de la manche suivante, elles entrent dans la manche en cours à leur Initiative, comme un renfort

  @domain
  Scénario: Les Phalénides invoquées n'agissent pas tout de suite
    Étant donné la manche où la Reine change de phase
    Quand cette manche se termine
    Alors aucune Phalénide invoquée n'a agi
    Et dès la manche suivante, chacune tire son intention et agit à son Initiative, comme les autres ennemis

  @ui
  Scénario: Les Phalénides invoquées portent l'étiquette « Invoquée »
    Étant donné deux Phalénides entrées par l'Invocation
    Alors le cadre de chacune porte l'étiquette « Invoquée »
    Et une Phalénide tirée dans un groupe ordinaire n'a pas cette étiquette

  @domain
  Scénario: Les Phalénides invoquées ont les valeurs du palier
    Étant donné deux Phalénides invoquées au palier 2
    Alors chacune a 33 PV et 7 de garde
    Et son Vol brisé fait 5, ses Mandibules 4 + 4

  @session
  Scénario: Le combat est gagné quand la Reine tombe
    Étant donné une Phalénide invoquée encore debout
    Quand la Reine tombe
    Alors la Phalénide retombe en poussière avec elle
    Et le combat est gagné, avec l'Or et les 12 Éclats du boss, rien de plus pour la Phalénide

  @domain
  Scénario: Une Phalénide abattue ne revient pas
    Étant donné une Phalénide invoquée qui tombe avant la Reine
    Quand la manche suivante commence
    Alors elle ne revient pas et la Reine n'en appelle pas d'autre

  @domain
  Scénario: Limite — une seule Invocation par combat
    Étant donné la Reine déjà en phase 2
    Quand ses PV baissent encore
    Alors elle n'invoque plus rien

  @domain
  Scénario: Limite — la Reine qui tombe du coup qui l'aurait fait changer de phase
    Étant donné la Reine à 210 PV
    Quand un coup lui retire 210 PV ou plus
    Alors elle tombe sans invoquer, et le combat est gagné

  @domain
  Scénario: Limite — pas d'Invocation sans place libre
    Étant donné un boss dont la phase 2 invoque, et une première ligne de 3 ennemis tous debout
    Quand ses PV passent sous le seuil de son changement de phase
    Alors il change de phase (garde, Initiative, nouveaux coups) mais n'invoque rien
    Et il n'y a ni annonce d'Invocation, ni poussière, ni portrait en pointillé dans la Frise d'action
    Et il agit selon l'intention qu'il a tirée

  @domain
  Scénario: Un ennemi invoqué reprend la place d'un ennemi tombé
    Étant donné un boss dont la phase 2 invoque deux ennemis, dans une première ligne où les deux autres places sont occupées par des ennemis tombés
    Quand il change de phase
    Alors la poussière de l'Invocation recouvre les places des deux ennemis tombés
    Et les ennemis invoqués y entrent au début de la manche suivante
    Et les ennemis tombés remplacés ne peuvent plus être relevés

  @domain
  Scénario: Limite — moins de places libres que d'ennemis appelés
    Étant donné un boss dont la phase 2 invoque deux ennemis, et une seule place libre dans la première ligne
    Quand il change de phase
    Alors un seul ennemi invoqué entre, à cette place

  @domain
  Scénario: Limite — un ennemi invoqué n'est jamais relevé
    Étant donné un combat de boss
    Alors il n'y a ni Nécromancien ni Glaneuse de cendre pour relever une Phalénide

  @session
  Scénario: Combat repris entre l'annonce et l'entrée
    Étant donné l'Invocation annoncée et la manche pas encore finie
    Quand l'application est fermée puis le combat repris
    Alors les tas de poussière sont là, sans l'annonce
    Et les Phalénides entrent au début de la manche suivante

  @domain
  Scénario: La Phalénide rejoint les tirages du palier 2
    Étant donné un groupe tiré au palier 2
    Alors il peut compter jusqu'à 2 Phalénides (poids 3)
    Et le palier 3 n'en tire plus (#214)

  @ui
  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand la Reine invoque
    Alors il entend « La Reine des phalènes change de phase. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche. »
    Et chaque Phalénide entrée se lit comme un ennemi : « Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : attaque »
    Et à la victoire, il entend « La Reine des phalènes tombe. Les Phalénides tombent avec elle. »
