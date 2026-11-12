# language: fr
Fonctionnalité: Les nouveaux ennemis du Beffroi
  Story #214 (épique #210, chemin B, Atelier du 05/11/2026) : le Beffroi n'a plus que ses propres
  ennemis. Le Squelette, le Spectre, le Nécromancien et la Phalénide en sortent, le Novice des
  cloches (remplissage), la Sonneuse de matines (soutien) et le Jaquemart (menace lisible) y entrent
  (voir **Rôle d'ennemi** et **Ennemi propre au palier**).

  # Les scénarios `@domain` éprouvent les règles du domaine ; le scénario `@ui` passe par la colonne
  # de l'ennemi et l'atlas que la scène dessine ; le scénario `@session` passe par une vraie session
  # d'ascension sur un Stockage clé-valeur en mémoire (« après la mise à jour » : une nouvelle session
  # sur le même stockage).

  @domain
  Scénario: Le palier 3 ne tire plus que ses propres ennemis
    Étant donné une ascension au palier 3
    Quand les groupes d'ennemis de ses combats ordinaires sont tirés, pour 200 graines
    Alors aucun groupe ne contient de Squelette, de Spectre, de Nécromancien ni de Phalénide
    Et chaque ennemi tiré est un Veilleur d'airain, une Gargouille, un Fondeur de cloches, un Novice des cloches, une Sonneuse de matines, un Jaquemart, un Bélier de bronze ou un Battant de cloche

  @domain
  Scénario: Le remplissage nombreux
    Étant donné la liste des ennemis du palier 3
    Alors l'ennemi de remplissage a le poids 3 et le plafond 2
    Et un groupe du palier 3 peut en compter 2

  @domain
  Scénario: Le soutien n'est jamais seul
    Étant donné un groupe du palier 3 où le soutien du Beffroi est tiré
    Alors le groupe compte au moins un autre ennemi qui n'est pas ce soutien

  @ui
  Scénario: La menace lisible se reconnaît pendant sa préparation
    Étant donné la menace du Beffroi prépare son coup signature
    Quand le joueur regarde l'ennemi
    Alors le coup se reconnaît comme le prévoit sa fiche validée (coup imparable, coup trompeur, ou annonce « Il se relève »)

  @domain
  Scénario: Chaque nouvel ennemi suit sa fiche du Codex
    Étant donné un nouvel ennemi du Beffroi au palier 3
    Quand le combat commence
    Alors ses PV et sa garde sont ceux du Codex multipliés par le multiplicateur du palier 3 (PV ×1,75, garde ×1,5)
    Et ses coups, leurs dégâts et leurs poids sont ceux de sa fiche validée

  @domain
  Scénario: Aucun ennemi dans deux paliers
    Étant donné les ennemis tirés dans les groupes de chaque palier
    Alors aucun ennemi du palier 3 n'est tiré au palier 1 ou au palier 2

  @session
  Scénario: Un combat d'étage déjà tiré garde son groupe
    Étant donné une ascension sauvegardée au palier 3, dont le combat d'étage déjà tiré compte un Squelette
    Quand le joueur reprend l'ascension après la mise à jour
    Alors ce combat garde son Squelette
    Et les combats d'étage tirés ensuite n'en ont plus

  @domain
  Scénario: Le palier 1 ne change pas
    Étant donné les 200 ascensions rejouées du palier 1
    Quand elles sont rejouées
    Alors elles sont les mêmes qu'avant
