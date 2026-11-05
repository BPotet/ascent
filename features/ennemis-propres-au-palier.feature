# language: fr
Fonctionnalité: Ennemis propres au palier 2
  Story #213 (épique #210) : les Jardins de cendre n'ont plus que leurs propres ennemis. La Goule
  et le Villageois fou restent au palier 1 (Ennemi propre au palier, `tierExclusive`).

  # Les scénarios `@domain` éprouvent les règles du domaine ; le scénario `@session` passe par une
  # vraie session d'ascension sur un Stockage clé-valeur en mémoire (« après la mise à jour » : une
  # nouvelle session sur le même stockage).

  @domain
  Scénario: Plus de Goule ni de Villageois fou au palier 2
    Étant donné une ascension au palier 2
    Quand les groupes d'ennemis de ses combats ordinaires sont tirés, pour 200 graines
    Alors aucun groupe ne contient de Goule ni de Villageois fou
    Et chaque ennemi tiré est un Pèlerin enronce, une Ronce de cendre, une Glaneuse de cendre, un Embrasé ou une Phalénide

  @domain
  Scénario: Les poids et plafonds des autres ennemis ne changent pas
    Étant donné la liste des ennemis du palier 2
    Alors le Pèlerin enronce garde le poids 2 et le plafond 1, la Ronce de cendre 2 et 1, la Glaneuse de cendre 1 et 1 (jamais seule), l'Embrasé 2 et 1, la Phalénide 3 et 2
    Et la taille des groupes du palier 2 reste de 2 à 4 ennemis

  @domain
  Scénario: Le palier 1 garde ses ennemis
    Étant donné les 200 ascensions rejouées du palier 1
    Quand elles sont rejouées
    Alors leurs groupes sont les mêmes qu'avant, Goule et Villageois fou compris

  @domain
  Scénario: Aucun ennemi commun aux paliers 1 et 2
    Étant donné les ennemis tirés dans les groupes du palier 1 et ceux du palier 2
    Alors aucun ennemi n'est dans les deux listes

  @session
  Scénario: Un combat d'étage déjà tiré garde son groupe
    Étant donné une ascension sauvegardée au palier 2, dont le combat d'étage déjà tiré compte une Goule
    Quand le joueur reprend l'ascension après la mise à jour
    Alors ce combat garde sa Goule
    Et les combats d'étage tirés ensuite n'en ont plus
