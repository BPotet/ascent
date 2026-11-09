# language: fr
Fonctionnalité: Le Fossoyeur et l'Élite non répétée étendue
  Story #258 (épique #245) : aux Catacombes, une 3ᵉ Élite, le Fossoyeur, exhume un Squelette aux
  manches paires ; une Élite ne revient qu'après que toutes celles du palier ont été affrontées
  (la règle du sac).

  # Les scénarios `@domain` éprouvent les règles du domaine (le moteur du combat, les tirages de
  # l'ascension). Les scénarios `@session` passent par une vraie session d'ascension sur un
  # stockage en mémoire.

  @domain
  Scénario: Le Fossoyeur est une Élite du palier 1
    Étant donné le héros au palier 1 dans un combat d'Élite contre le Fossoyeur
    Alors ses valeurs du Codex sont 150 PV, garde 40 et Initiative 4
    Et au combat elles suivent le multiplicateur d'Élite et de boss du palier 1 (120 PV, garde 50 avec la compensation de #257)
    Et il vient seul
    Et ses coups sont le Coup de pelle (coup simple de 8), Terre jetée (double frappe de 4 + 4) et Fosse ouverte (coup imparable de 12), un tiers chacun
    Et au combat, avec la compensation de #257, ils font 6, 3 + 3 et 9

  @domain
  Scénario: Il exhume un Squelette à la manche 2
    Étant donné le Fossoyeur debout, non étourdi, sans Squelette exhumé debout
    Quand la manche 2 commence
    Alors son intention montre Exhumer
    Quand vient son action
    Alors un Squelette entre à la première place libre, avec 35 PV, garde 20 et Initiative 6
    Et il porte l'étiquette « Invoqué »
    Et il n'agit pas dans cette manche

  @domain
  Scénario: Une manche impaire, il frappe
    Étant donné le Fossoyeur debout et non étourdi
    Quand la manche 3 commence
    Alors son intention montre un de ses coups, jamais Exhumer

  @domain
  Scénario: Un seul Squelette exhumé debout à la fois
    Étant donné un Squelette exhumé encore debout
    Quand la manche 4 commence
    Alors le Fossoyeur montre un coup, pas Exhumer

  @domain
  Scénario: Le Squelette exhumé tombé laisse sa place
    Étant donné le Squelette exhumé tombé pour de bon avant la manche 4
    Quand la manche 4 commence
    Alors le Fossoyeur montre Exhumer
    Et le nouveau Squelette entre à la première place libre, vides d'abord, puis tombés, de gauche à droite

  @domain
  Scénario: Un Squelette exhumé qui se relève seul reste debout
    Étant donné un Squelette exhumé qui tombe pour la première fois
    Alors il se relève seul à 50 % de ses PV max
    Et il compte comme Squelette exhumé debout

  @domain
  Scénario: Étourdi, il n'exhume pas
    Étant donné le Fossoyeur étourdi au début de la manche 2
    Alors son intention ne montre pas Exhumer

  @domain
  Scénario: Garde brisée avant son action
    Étant donné le Fossoyeur qui montre Exhumer à la manche 2
    Quand le héros brise sa garde avant l'action du Fossoyeur
    Alors le Fossoyeur perd son action
    Et aucun Squelette n'entre
    Et rien n'est reporté à la manche suivante

  @domain
  Scénario: Les Squelettes tombent avec lui
    Étant donné un Squelette exhumé debout
    Quand le Fossoyeur tombe pour de bon
    Alors le Squelette tombe aussi, sans Or
    Et c'est la victoire

  @domain
  Scénario: Le Fossoyeur maudit, jamais son Squelette
    Étant donné une ascension à −2 de malédiction
    Quand le héros affronte le Fossoyeur
    Alors le Fossoyeur est maudit
    Et aucun Squelette exhumé n'est maudit

  @domain
  Scénario: Les tirages ne dépendent pas de l'intention
    Étant donné une graine de l'ascension fixée
    Quand le Fossoyeur montre Exhumer
    Alors ses tirages de la manche sont consommés comme pour un coup
