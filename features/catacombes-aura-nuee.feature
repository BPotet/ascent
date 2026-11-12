# language: fr
Fonctionnalité: Les Catacombes, l'Aura et la Nuée
  Story #268 (épique #246) : aux Catacombes, le Porte-cierge, dont l'Aura renforce de 20 % les coups
  de ses alliés tant qu'il vit, étourdi compris, et les Rats de crypte, qui viennent jusqu'à 3 et
  frappent plus fort en Nuée (voir **Aura** et **Nuée**).

  # Les scénarios `@domain` éprouvent les règles du domaine (le moteur du combat, les paliers). Les
  # scénarios `@ui` passent par ce que l'écran montre et dit (la vue du combat, l'état d'affichage,
  # ses textes). Les scénarios `@session` passent par une vraie session de combat sur un stockage en
  # mémoire.

  # --- Le Porte-cierge et l'Aura ---

  @domain
  Scénario: Le Porte-cierge est un ennemi ordinaire des Catacombes
    Étant donné un combat ordinaire au palier 1 avec un Porte-cierge
    Alors ses valeurs sont 36 PV, garde 24 et Initiative 2
    Et son coup est le Coup de cierge, coup simple de 5
    Et maudit, il a 43 PV, une garde de 28 et un Coup de cierge de 6

  @domain
  Scénario: Le Porte-cierge n'est jamais seul, mais n'est pas un soutien
    Étant donné un groupe d'ennemis d'un seul ennemi au palier 1
    Alors ce n'est jamais un Porte-cierge
    Étant donné un combat à la malédiction −1 avec un Porte-cierge en première ligne
    Alors le Porte-cierge peut être l'ennemi maudit

  @ui
  Scénario: L'Aura renforce les coups des alliés
    Étant donné un Porte-cierge debout en première ligne
    Et une Goule dont le coup simple fait 5
    Quand la Goule porte son coup
    Alors il fait 6 dégâts avant la défense du héros
    Et le chiffre de dégâts porte une petite flamme

  @domain
  Scénario: L'Aura donne au moins +1 par impact
    Étant donné un Porte-cierge debout en première ligne
    Quand un allié porte une double frappe de 3 + 3
    Alors chaque impact fait 4
    Quand une Goule maudite porte un coup simple de 6
    Alors il fait 7

  @domain
  Scénario: L'Aura ne renforce pas le Porte-cierge lui-même
    Étant donné un Porte-cierge debout
    Quand il porte son Coup de cierge
    Alors il fait 5 dégâts

  @ui
  Scénario: Étourdi, le Porte-cierge garde son Aura
    Étant donné un Porte-cierge dont la garde est brisée
    Quand un allié porte un coup pendant qu'il est étourdi
    Alors ce coup est renforcé de 20 %, au moins +1
    Et la lueur du cierge et les « +20 % » des alliés restent affichés

  @ui
  Scénario: L'Aura s'éteint à sa chute
    Étant donné un Porte-cierge debout et une Goule dont le coup simple fait 5
    Quand le Porte-cierge tombe
    Alors le mot de scène « L'aura s'éteint » s'affiche et les « +20 % » des alliés se barrent puis disparaissent
    Et le lecteur d'écran annonce « Porte-cierge tombe. L'aura s'éteint »
    Et le coup suivant de la Goule fait 5

  @domain
  Scénario: L'Aura est lue au début de la préparation
    Étant donné un Porte-cierge debout au début de la préparation d'une double frappe d'un allié
    Alors les deux impacts de cette double frappe sont renforcés

  @domain
  Scénario: Un Porte-cierge en réserve n'a pas d'Aura
    Étant donné un Porte-cierge dans la réserve
    Quand un ennemi de la première ligne porte un coup
    Alors ce coup n'est pas renforcé
    Quand le Porte-cierge entre en renfort
    Alors son Aura s'allume à son entrée

  @ui
  Scénario: Un renfort reçoit l'Aura en entrant
    Étant donné un Porte-cierge debout en première ligne
    Quand un ennemi de la réserve entre en renfort
    Alors il porte « +20 % » sur sa plaque et ses coups sont renforcés

  @ui
  Scénario: Seul debout, l'Aura ne sert à rien
    Étant donné un Porte-cierge seul debout en première ligne, la réserve vide
    Alors sa marque de signature est « Aura · seul », grisée

  # --- Le Rat de crypte et la Nuée ---

  @domain
  Scénario: Le Rat de crypte est un ennemi ordinaire des Catacombes
    Étant donné un combat ordinaire au palier 1 avec un Rat de crypte
    Alors ses valeurs sont 12 PV, garde 14 et Initiative 7
    Et ses coups sont la Morsure (coup simple de 4) et le Grouillement (double frappe de 3 + 3), dans un rapport de 2 contre 1
    Et maudit, il a 14 PV, une garde de 16, une Morsure de 5 et un Grouillement de 4 + 4

  @domain
  Scénario: Les Rats de crypte viennent jusqu'à 3
    Étant donné le palier 1
    Alors un groupe d'ennemis compte au plus 3 Rats de crypte
    Et un groupe d'un seul ennemi peut être un Rat de crypte

  @domain
  Scénario: La Nuée renforce chaque Rat
    Étant donné 3 Rats de crypte debout et non étourdis en première ligne
    Quand l'un d'eux porte une Morsure
    Alors elle fait 8 dégâts avant la défense du héros
    Quand l'un d'eux porte un Grouillement
    Alors chaque impact fait 7

  @domain
  Scénario: Un Rat étourdi ou en réserve ne compte pas dans la Nuée
    Étant donné 2 Rats de crypte en première ligne, dont un étourdi
    Et un 3ᵉ Rat de crypte dans la réserve
    Quand le Rat non étourdi porte une Morsure
    Alors elle fait 4 dégâts

  @domain
  Scénario: Un Rat seul n'a pas de Nuée
    Étant donné un seul Rat de crypte debout
    Quand il porte une Morsure
    Alors elle fait 4 dégâts

  @domain
  Scénario: Un Rat entré en renfort compte dès sa première préparation
    Étant donné un Rat de crypte debout en première ligne
    Quand un 2ᵉ Rat de crypte entre en renfort
    Alors la Morsure suivante de chacun fait 6

  @domain
  Scénario: Une bonne frappe abat un Rat
    Étant donné la Sentinelle avec une Attaque de 10 et un Rat de crypte à 12 PV
    Quand elle le touche d'une bonne frappe
    Alors il tombe d'un coup
    Et la cible passe à l'ennemi debout le plus à gauche

  @domain
  Scénario: Nuée, malédiction et Aura s'enchaînent dans l'ordre
    Étant donné 2 Rats de crypte et un Porte-cierge, debout et non étourdis en première ligne
    Quand un Rat porte une Morsure de 4
    Alors la Nuée la porte à 6, puis l'Aura à 7

  # --- Rencontre, tirage, marches figées ---

  @session
  Scénario: Première rencontre du Porte-cierge
    Étant donné un joueur qui n'a jamais rencontré le Porte-cierge
    Quand un combat avec un Porte-cierge commence
    Alors la bulle de première rencontre « Porte-cierge » s'affiche, sans rien bloquer
    Et le premier toucher la ferme
    Et elle ne revient plus dans les combats suivants

  @session
  Scénario: Le Rat de crypte n'a ni marque de signature ni bulle de première rencontre
    Étant donné un premier combat avec des Rats de crypte
    Alors aucune bulle de première rencontre ne s'affiche pour eux
    Et leur plaque ne porte aucune marque de signature

  @domain
  Scénario: Les nouveaux ennemis entrent dans les groupes des Catacombes
    Étant donné le palier 1
    Alors un groupe d'ennemis est tiré parmi la Goule, le Spectre, le Nécromancien, le Squelette, le Villageois fou, le Porte-cierge et le Rat de crypte, dans cet ordre
    Et le Porte-cierge a un poids de tirage de 1, au plus 1 par groupe, jamais seul
    Et le Rat de crypte a un poids de tirage de 2, au plus 3 par groupe
    Et ils ne sont tirés dans aucun autre palier

  @domain
  Scénario: Une même graine garde la même ascension, hors compositions du palier 1
    Étant donné une graine de l'ascension jouée avant cette story
    Quand la même graine est jouée après cette story
    Alors les tailles des groupes, l'Or, le butin, les offres de bienfaits, les portes, les Élites et les boss sont identiques
    Mais la composition des combats ordinaires du palier 1 peut changer

  @domain
  Scénario: Les autres paliers ne changent pas
    Étant donné une ascension aux Jardins de cendre ou au Beffroi
    Alors ses groupes d'ennemis et ses escortes sont identiques à ceux d'avant cette story
