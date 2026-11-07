# language: fr
Fonctionnalité: Rééquilibrage du palier 3
  Story #244 (épique #243) : des gardes plus solides, des Élites et des boss plus forts aux paliers
  2 et 3, des soins de combat mesurés et des Élites variées, pour que le Sommet redevienne un vrai
  défi.

  # Les scénarios `@domain` éprouvent les règles du domaine (moteur du combat, règle du palier,
  # ascension). Les scénarios `@session` passent par une vraie session d'ascension sur un Stockage
  # clé-valeur en mémoire. Le Coup de bouclier (#236) n'existe pas encore : son scénario est vérifié
  # sur le calcul de la garde retirée (`strikeBlow`).

  # G1 — Brise-garde d'une frappe
  @domain
  Scénario: Les bonus de frappe parfaite n'entrent que dans les PV
    Étant donné la Sentinelle avec Lame juste et Heure juste
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 23 PV et 18 de garde

  @domain
  Scénario: Les pourcentages de Brise-garde s'appliquent à la garde
    Étant donné la Sentinelle avec Lame juste, Heure juste et Braise brisante
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 23 de garde

  @domain
  Scénario: Frappe de pouvoir parfaite avec une part de garde
    Étant donné la Sentinelle avec Lame juste
    Quand elle fait un Coup de bouclier parfait sur un ennemi non étourdi
    Alors elle retire 36 de garde (12 × 150 % × 200 %)

  @domain
  Scénario: Chaque coup de l'Errante est calculé seul
    Étant donné l'Errante avec Lame juste et Entaille
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 11 + 11 de garde

  @domain
  Scénario: Une bonne frappe ne change pas
    Étant donné la Sentinelle avec Lame juste
    Quand elle fait une bonne frappe sur un ennemi non étourdi
    Alors elle retire 14 de garde, comme aujourd'hui

  @domain
  Scénario: Aucune garde retirée sur un ennemi étourdi
    Étant donné un ennemi étourdi
    Quand le héros fait une frappe parfaite sur lui
    Alors il ne perd aucun point de garde

  @domain
  Scénario: Contre-attaques et Riposte du Rempart inchangées
    Étant donné la Sentinelle avec Lame juste
    Quand elle contre-attaque après une parade parfaite, ou que sa Riposte du Rempart frappe
    Alors la garde retirée est la même qu'avant le rééquilibrage

  # R1 — Multiplicateur d'Élite et de boss
  @domain
  Plan du scénario: Une Élite ou un boss reçoit le multiplicateur de son palier
    Étant donné une ascension au palier <palier>
    Quand le héros affronte <ennemi>
    Alors <ennemi> a <pv> PV max et une garde max de <garde>
    Et les dégâts de ses coups valent <coups>

    Exemples:
      | palier | ennemi                     | pv  | garde | coups                          |
      | 1      | Les Jumeaux                | 200 | 37    | 6 + 6, 10, 5                   |
      | 1      | Le Chevalier déchu         | 200 | 56    | 8, 8, 12                       |
      | 1      | La Gardienne des ossuaires | 300 | 75    | 9, 10 ; phase 2 : 6 + 6, 15    |
      | 1      | Le Prieur sans visage      | 300 | 75    | 8, 5 + 5 ; phase 2 : 10, 14    |
      | 2      | L'Épouvantail              | 228 | 70    | 13, 13, 19                     |
      | 2      | Le Brûleur de ronces       | 252 | 77    | 12, 7 + 7, 18                  |
      | 2      | La Jardinière des cendres  | 420 | 97    | 12, 13 ; phase 2 : 7 + 7, 18   |
      | 3      | Le Premier Pèlerin         | 364 | 82    | 10 + 10, 18, 18, 28            |
      | 3      | Le Saint de pierre         | 337 | 120   | 17, 21, 29                     |
      | 3      | Le Sonneur des heures      | 650 | 130   | 9 + 9, 18 ; phase 2 : 16, 27   |
      | 3      | Celle qui exauce           | 650 | 121   | 16, 16 ; phase 2 : 10 + 10, 28 |

  @domain
  Scénario: Saignement, Brûlure et Initiative ne sont pas multipliés
    Étant donné une ascension au palier 2
    Quand le héros affronte le Brûleur de ronces
    Alors la Torche allume 2 charges de Brûlure
    Et le Fagot d'épines fait saigner 2 PV pendant 3 manches
    Et son Initiative vaut 6

  @domain
  Scénario: Le changement de phase suit les PV multipliés
    Étant donné le Sonneur des heures au palier 3 à 650 PV max
    Quand ses PV passent à 325 ou moins
    Alors son changement de phase a lieu

  @domain
  Scénario: PV et dégâts inchangés au palier 1 et chez les boss du palier 2, gardes changées
    Étant donné une ascension au palier 1, ou au palier 2 contre la Reine des phalènes ou la Jardinière des cendres
    Quand le héros affronte une Élite ou un boss
    Alors ses PV et les dégâts de ses coups sont ceux d'avant le rééquilibrage
    Et sa garde max suit la colonne garde du multiplicateur d'Élite et de boss (Reine des phalènes 87, Jardinière des cendres 97)
    Et les 200 ascensions rejouées du palier 1 changent : leurs tests figés sont mis à jour, jamais la graine

  @domain
  Scénario: Une Élite maudite part de la valeur du palier
    Étant donné une ascension en malédiction −2 au palier 3
    Quand la porte Élite mène au Premier Pèlerin, Élite maudite
    Alors il a 436 PV max et une garde max de 98

  # Option A, retenue par l'orchestrateur le 07/11/2026 : une seule fiche par ennemi ; la garde de
  # la Phalénide est doublée comme celle des autres ennemis ordinaires (G2).
  @domain
  Scénario: Les Phalénides invoquées gardent leur multiplicateur actuel
    Étant donné la Reine des phalènes qui invoque des Phalénides
    Quand une Phalénide entre en combat
    Alors ses PV et ses dégâts sont ceux d'avant le rééquilibrage, et sa garde est de 15

  # G2 — Gardes doublées et colonne garde
  @domain
  Plan du scénario: La garde des ennemis ordinaires est doublée, puis multipliée par le palier
    Étant donné une ascension au palier <palier>
    Quand le héros affronte <ennemi> dans un combat ordinaire
    Alors sa garde max vaut <garde>

    Exemples:
      | palier | ennemi            | garde |
      | 1      | Goule             | 30    |
      | 1      | Squelette         | 20    |
      | 2      | Pèlerin enronce   | 50    |
      | 2      | Ronce de cendre   | 25    |
      | 2      | Phalénide         | 15    |
      | 3      | Veilleur d'airain | 72    |
      | 3      | Gargouille        | 66    |
      | 3      | Novice            | 24    |

  @domain
  Scénario: L'intention Garde d'un soutien suit la nouvelle garde max
    Étant donné un ennemi de soutien dont l'intention est Garde
    Quand il exécute son intention
    Alors l'allié gagne 30 % de sa nouvelle garde max

  @domain
  Scénario: Un ennemi qui se relève seul retrouve sa nouvelle garde entière
    Étant donné l'Épouvantail au palier 2 avec une garde max de 70
    Quand il tombe et se relève seul
    Alors il a 70 de garde

  @domain
  Scénario: Le changement de phase rend la nouvelle garde max
    Étant donné le Sonneur des heures au palier 3 avec une garde max de 130
    Quand son changement de phase a lieu
    Alors sa garde revient à 130
