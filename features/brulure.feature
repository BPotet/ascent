# language: fr
Fonctionnalité: La Brûlure
  Story #171 (chemin B, Atelier du 01/11/2026, mécanique nouvelle) : des ennemis qui brûlent le
  héros (règles 1 à 8 de la story), l'Embrasé, la Gargouille, le Fondeur de cloches et le Brûleur de
  ronces.

  # Les scénarios `@domain` éprouvent les règles du domaine ; le scénario `@session` passe par la
  # session de combat, ses sons et son horloge ; les scénarios `@ui` passent par l'écran de combat,
  # sur une vraie session de combat et l'horloge de combat manuelle. Les flammes et la fumée sont
  # dessinées par Skia, simulé sous Jest : elles se vérifient sur ce que l'écran passe à la scène.

  Contexte:
    Étant donné que la Brûlure ne touche que le héros

  @domain
  Plan du Scénario: Prendre des charges de Brûlure
    Étant donné un héros sans Brûlure
    Quand la Torche du Brûleur de ronces (2 charges) arrive et que le héros <défense>
    Alors le héros a <charges> charges de Brûlure

    Exemples:
      | défense                        | charges |
      | reçoit le coup                 | 2       |
      | pare (bonne parade)            | 2       |
      | pare parfaitement              | 0       |
      | esquive dans la fenêtre        | 0       |

  @domain
  Scénario: Les charges s'additionnent
    Étant donné un héros avec 1 charge de Brûlure
    Quand la Torche du Brûleur de ronces le touche
    Alors il a 3 charges

  @domain
  Scénario: Limite — 5 charges au plus
    Étant donné un héros avec 4 charges de Brûlure
    Quand la Torche du Brûleur de ronces le touche
    Alors il a 5 charges

  @ui
  Scénario: Limite — à 5 charges, le coup qui brûle se voit quand même
    Étant donné un héros avec 5 charges de Brûlure
    Quand un coup qui brûle le touche
    Alors il a toujours 5 charges et aucune flamme de plus ne s'allume
    Et l'étiquette « Brûlure ×5 » est cerclée un instant, pour dire que le coup a touché
    Et le souffle de flamme se fait entendre

  @domain
  Scénario: La Brûlure au début de chaque manche
    Étant donné un héros avec 2 charges de Brûlure
    Quand une manche commence
    Alors il perd 2 PV, puis une charge s'éteint
    Et à la manche suivante, il perd 1 PV, puis la dernière charge s'éteint
    Et à la manche d'après, il ne perd rien

  @domain
  Scénario: Le Saignement d'abord, puis la Brûlure
    Étant donné un héros qui saigne et qui brûle
    Quand une manche commence
    Alors il perd les PV du Saignement, puis ceux de la Brûlure, avant le renfort et les tirages de la manche

  @domain
  Scénario: Éteindre une charge en jouant bien
    Étant donné un héros avec 3 charges de Brûlure
    Quand il pare parfaitement les deux impacts d'une double frappe de Goule
    Alors 2 charges s'éteignent sur-le-champ et il en garde 1

  @domain
  Scénario: L'esquive éteint aussi une charge
    Étant donné un héros avec 2 charges de Brûlure
    Quand il esquive dans la fenêtre un coup imparable
    Alors une charge s'éteint sur-le-champ

  @domain
  Scénario: Ni la réduction des dégâts ni le Rempart ne la diminuent
    Étant donné la Sentinelle avec 3 charges et son Rempart actif
    Quand une manche commence
    Alors elle perd 3 PV
    Et son Rempart reste actif

  @domain
  Scénario: Limite — la Brûlure ne fait jamais tomber le héros
    Étant donné un héros à 2 PV avec 3 charges de Brûlure
    Quand une manche commence
    Alors il a 1 PV

  @ui
  Scénario: La Brûlure s'éteint à la fin du combat
    Étant donné un héros avec 2 charges de Brûlure
    Quand le combat est gagné
    Alors toutes ses flammes s'éteignent ensemble en fumée, sans perte de PV, avant l'écran de victoire
    Et le lecteur d'écran n'annonce rien sur la Brûlure
    Et il n'a plus aucune charge au combat suivant

  @ui
  Scénario: La Brûlure est sauvegardée avec le combat
    Étant donné un héros avec 3 charges de Brûlure
    Quand l'application est fermée puis le combat repris
    Alors il a toujours 3 charges
    Et ses flammes et l'étiquette réapparaissent telles quelles, sans animation de prise

  @domain
  Scénario: Limite — elle ne bloque aucun soin et ne touche pas les ennemis
    Étant donné un héros avec des charges de Brûlure
    Quand il reçoit le Répit, un Feu de camp, le soin du Bouclier du veilleur ou de Cœur de braise
    Alors le soin a lieu comme d'habitude
    Et la Brûlure ne retire jamais de garde à un ennemi et ne déclenche aucune contre-attaque

  @domain
  Scénario: Les porteurs de la Brûlure au palier 2
    Étant donné un Embrasé au palier 2
    Alors il a 27 PV et 20 de garde
    Et sa Main de braise fait 5 et donne 1 charge
    Et son Embrasement, coup imparable, fait 10

  @domain
  Scénario: Les porteurs de la Brûlure au palier 3
    Étant donné une Gargouille et un Fondeur de cloches au palier 3
    Alors la Gargouille a 52 PV et 66 de garde, et sa Gueule de feu fait 5 et donne 1 charge
    Et le Fondeur a 73 PV et 42 de garde, et sa Coulée fait 7 et donne 1 charge
    Et le multiplicateur de palier ne change jamais le nombre de charges

  @domain
  Scénario: Ils rejoignent les tirages
    Étant donné un groupe tiré au palier 2
    Alors il peut compter un Embrasé (poids 2, 1 au plus)
    Et au palier 3, une Gargouille ou un Fondeur de cloches (poids 2, 1 au plus chacun)
    Et une porte Élite du palier 2 mène à l'Épouvantail, au Brûleur de ronces ou à la Mère-ronce (#259), tirés à un tiers chacun

  @ui
  Scénario: Ce que voit le joueur
    Étant donné un héros avec 3 charges de Brûlure
    Alors 3 petites flammes orange braise brûlent sur lui
    Et l'étiquette « Brûlure ×3 » s'affiche en orange braise sous ses PV, à droite de « Saignement ×N » s'il saigne aussi
    Et une flamme qui s'éteint part en fumée grise

  @session
  Scénario: Ce qu'entend le joueur — trois sons de Brûlure
    Quand un coup qui brûle touche le héros
    Alors un souffle de flamme court se joue par-dessus le son du touché ou de la parade
    Quand une manche commence et que le héros brûle
    Alors le feu crépite
    Quand une flamme s'éteint, par la manche, une parade parfaite ou une esquive
    Alors le son d'extinction se joue

  @ui
  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le héros prend 3 charges, puis qu'une charge s'éteint
    Alors il entend « Brûlure, 3 charges, 3 dégâts », puis « Une flamme s'éteint »
    Et au début de manche, il entend « Brûlure, moins 3 PV »
