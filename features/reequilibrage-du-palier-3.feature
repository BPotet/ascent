# language: fr
Fonctionnalité: Rééquilibrage du palier 3
  Story #244 (épique #243) : des gardes plus solides, des Élites et des boss plus forts aux paliers
  2 et 3, des soins de combat mesurés et des Élites variées, pour que le Sommet redevienne un vrai
  défi.

  # Les scénarios `@domain` éprouvent les règles du domaine (moteur du combat, règle du palier,
  # ascension). Les scénarios `@session` passent par une vraie session d'ascension sur un Stockage
  # clé-valeur en mémoire.

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
  # #257 (décision du 08/11/2026) : la colonne PV et dégâts des Élites passe à 80 / 80 / 88 % ; les
  # lignes des Élites suivent, celles des boss ne changent pas.
  @domain
  Plan du scénario: Une Élite ou un boss reçoit le multiplicateur de son palier
    Étant donné une ascension au palier <palier>
    Quand le héros affronte <ennemi>
    Alors <ennemi> a <pv> PV max et une garde max de <garde>
    Et les dégâts de ses coups valent <coups>

    Exemples:
      | palier | ennemi                     | pv  | garde | coups                          |
      | 1      | Les Jumeaux                | 160 | 37    | 4 + 4, 8, 4                    |
      | 1      | Le Chevalier déchu         | 160 | 56    | 6, 6, 9                        |
      | 1      | La Gardienne des ossuaires | 300 | 75    | 9, 10 ; phase 2 : 6 + 6, 15    |
      | 1      | Le Prieur sans visage      | 300 | 75    | 8, 5 + 5 ; phase 2 : 10, 14    |
      | 2      | L'Épouvantail              | 152 | 70    | 8, 8, 12                       |
      | 2      | Le Brûleur de ronces       | 168 | 77    | 8, 4 + 4, 12                   |
      | 2      | La Jardinière des cendres  | 420 | 97    | 12, 13 ; phase 2 : 7 + 7, 18   |
      | 3      | Le Premier Pèlerin         | 237 | 82    | 7 + 7, 12, 12, 18              |
      | 3      | Le Saint de pierre         | 220 | 120   | 11, 14, 19                     |
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

  # #257 (décision du 08/11/2026) : les Élites du palier 1 passent à 80 % ; le scénario ne vaut plus
  # que pour les boss.
  @domain
  Scénario: PV et dégâts inchangés chez les boss des paliers 1 et 2, gardes changées
    Étant donné une ascension au palier 1, ou au palier 2 contre la Reine des phalènes ou la Jardinière des cendres
    Quand le héros affronte un boss
    Alors ses PV et les dégâts de ses coups sont ceux d'avant le rééquilibrage
    Et sa garde max suit la colonne garde du multiplicateur d'Élite et de boss (Reine des phalènes 87, Jardinière des cendres 97)
    Et les 200 ascensions rejouées du palier 1 changent : leurs tests figés sont mis à jour, jamais la graine

  # #257 (décision du 08/11/2026) : 237 PV au palier 3, 284 maudit (237 + 47).
  @domain
  Scénario: Une Élite maudite part de la valeur du palier
    Étant donné une ascension en malédiction −2 au palier 3
    Quand la porte Élite mène au Premier Pèlerin, Élite maudite
    Alors il a 284 PV max et une garde max de 98

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

  # R5 — Élite non répétée
  @domain
  Scénario: Avec 2 Élites au palier, elles alternent
    Étant donné une ascension au palier 3 où le héros a affronté le Saint de pierre
    Quand il franchit la porte Élite suivante du palier 3
    Alors il affronte le Premier Pèlerin

  @domain
  Scénario: La première Élite d'un palier est tirée comme aujourd'hui
    Étant donné une ascension qui arrive au palier 2 sans Élite affrontée à ce palier
    Quand le héros franchit sa première porte Élite du palier 2
    Alors l'Élite est tirée à égalité parmi les Élites du palier avec la graine de l'ascension

  # R3 — Répit par palier
  @domain
  Plan du scénario: Le répit dépend du palier
    Étant donné un héros à <max> PV max et à 50 PV
    Quand il gagne un combat au palier <palier>
    Alors il regagne <répit> PV

    Exemples:
      | max | palier | répit |
      | 80  | 1      | 8     |
      | 80  | 2      | 4     |
      | 80  | 3      | 4     |
      | 92  | 1      | 9     |
      | 92  | 3      | 4     |

  @domain
  Scénario: Le répit ne dépasse pas le maximum
    Étant donné un héros à 78 PV sur 80 au palier 2
    Quand il gagne un combat
    Alors il est à 80 PV

  # R4 — Plafond de soin de parade
  @domain
  Scénario: Les soins de parade parfaite sont plafonnés à 10 PV par combat
    Étant donné un héros dont chaque parade parfaite rend 7 PV, loin de ses PV max
    Quand il fait 3 parades parfaites dans le même combat
    Alors il regagne 7, puis 3, puis 0 PV

  @domain
  Scénario: Le plafond est remis à zéro au combat suivant
    Étant donné un héros qui a regagné 10 PV de parade parfaite dans un combat
    Quand il entre dans le combat suivant et fait une parade parfaite
    Alors il regagne de nouveau ses PV de parade parfaite

  @domain
  Scénario: Un soin à PV pleins ne compte pas dans le plafond
    Étant donné un héros à PV max
    Quand il fait une parade parfaite qui devrait le soigner
    Alors il ne regagne rien
    Et le reste du plafond du combat est toujours de 10 PV

  @domain
  Scénario: Répit et Cœur de braise sont hors plafond
    Étant donné un héros qui a déjà regagné 10 PV de parade parfaite dans le combat
    Et qui possède Cœur de braise
    Quand il casse une garde puis gagne le combat
    Alors il regagne 5 PV de Cœur de braise et son répit en entier

  # Sauvegarde
  @session
  Scénario: Une ascension sauvegardée au milieu d'un combat d'Élite garde ses valeurs
    Étant donné une ascension sauvegardée avant le rééquilibrage, au milieu d'un combat d'Élite du palier 3
    Quand le joueur la reprend après la mise à jour
    Alors l'Élite garde ses PV, sa garde et ses coups d'avant

  @session
  Scénario: Un combat sauvegardé avant la mise à jour garde ses gardes enregistrées
    Étant donné une ascension sauvegardée avant le rééquilibrage, au milieu d'un combat ordinaire
    Quand le joueur la reprend après la mise à jour
    Alors chaque ennemi garde sa garde et sa garde max enregistrées

  @session
  Scénario: Le plafond de soin est sauvegardé
    Étant donné un combat où 7 PV de parade parfaite ont été rendus
    Quand l'application est fermée puis rouverte
    Alors il ne reste que 3 PV de soin de parade parfaite dans ce combat
