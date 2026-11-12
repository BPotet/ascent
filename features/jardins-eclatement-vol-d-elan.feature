# language: fr
Fonctionnalité: Les Jardins de cendre, l'Éclatement et le Vol d'Élan
  Story #267 (épique #246) : aux Jardins de cendre, la Cosse de braise, dont l'Éclatement inflige
  2 charges de Brûlure au héros à sa mort sauf si elle meurt étourdie, et la Phalène voleuse, dont
  le Vol d'Élan retire 1 Élan au héros à chaque impact qui le touche (voir **Éclatement** et **Vol
  d'Élan**).

  # Les scénarios `@domain` éprouvent les règles du domaine (le moteur du combat, les paliers). Les
  # scénarios `@ui` passent par ce que l'écran montre, dit et fait entendre (la vue du combat, l'état
  # d'affichage, ses textes, ses sons). Les scénarios `@session` passent par une vraie session de
  # combat sur un stockage en mémoire.

  # --- La Cosse de braise et l'Éclatement ---

  @domain
  Scénario: La Cosse de braise est un ennemi ordinaire des Jardins de cendre
    Étant donné un combat ordinaire au palier 2 avec une Cosse de braise
    Alors ses valeurs du Codex sont 34 PV, garde 18 et Initiative 3
    Et au combat elle a 45 PV et une garde de 22 (multiplicateur de palier)
    Et ses coups sont l'Éclat de coque (coup simple de 8) et le Crachin de cendre (double frappe de 4 + 4), à une chance sur deux
    Et maudite, elle a 54 PV, une garde de 26, un Éclat de coque de 9 et un Crachin de cendre de 5 + 5

  @ui
  Scénario: Abattue debout, la Cosse éclate
    Étant donné le héros avec 1 charge de Brûlure
    Et une Cosse de braise non étourdie, avec 2 autres ennemis encore debout
    Quand une frappe la fait tomber
    Alors elle éclate et le héros prend 2 charges de Brûlure, sur-le-champ
    Et il a 3 charges de Brûlure
    Et le mot de scène « Elle éclate » s'affiche, 2 flammes volent vers le héros et l'étiquette « Brûlure ×3 » est cerclée
    Et au début de la manche suivante il perd 3 PV, puis passe à 2 charges

  @ui
  Scénario: Achevée étourdie, la Cosse s'éteint
    Étant donné une Cosse de braise étourdie
    Quand une frappe la fait tomber
    Alors elle s'éteint en fumée, sans Brûlure pour le héros
    Et le mot de scène « Éteinte » s'affiche
    Et le lecteur d'écran annonce « Cosse de braise tombe, étourdie : elle s'éteint, pas de Brûlure »

  @domain
  Scénario: L'état est lu avant le coup
    Étant donné une Cosse de braise non étourdie
    Quand une même frappe brise sa garde et la fait tomber
    Alors elle éclate et le héros prend 2 charges de Brûlure

  @domain
  Scénario: Peu importe ce qui la fait tomber
    Étant donné une Cosse de braise non étourdie
    Quand une frappe, une frappe de pouvoir, une contre-attaque ou la Riposte du Rempart la fait tomber
    Alors elle éclate et le héros prend 2 charges de Brûlure

  @ui
  Scénario: Les charges de Brûlure plafonnent à 5
    Étant donné le héros avec 4 charges de Brûlure
    Quand une Cosse de braise non étourdie tombe
    Alors le héros a 5 charges de Brûlure
    Et l'Éclatement se voit et s'entend quand même
    Étant donné le héros avec 5 charges de Brûlure
    Quand une autre Cosse de braise non étourdie tombe
    Alors il reste à 5 charges, et l'Éclatement se voit et s'entend

  @ui
  Scénario: La Cosse qui gagne le combat n'éclate pas
    Étant donné une Cosse de braise non étourdie, dernier ennemi debout, la réserve vide
    Quand une frappe la fait tomber
    Alors le combat est gagné et le héros ne prend aucune charge de Brûlure
    Et aucun Éclatement n'est montré

  @domain
  Scénario: L'Éclatement ignore les protections et les multiplicateurs
    Étant donné le héros avec de la réduction des dégâts, un Rempart actif et la Brume
    Et une Cosse de braise maudite non étourdie
    Quand elle tombe
    Alors le héros prend exactement 2 charges de Brûlure
    Et ni le Rempart ni la Brume ne sont usés

  @domain
  Scénario: Une Cosse relevée éclate de nouveau
    Étant donné une Cosse de braise relevée par la Glaneuse de cendre
    Quand elle tombe une 2ᵉ fois sans être étourdie
    Alors elle éclate de nouveau et le héros prend 2 charges de Brûlure

  @ui
  Scénario: Le prix se lit avant de frapper
    Étant donné une Cosse de braise non étourdie
    Alors sa marque de signature est « Braises 2 »
    Quand sa garde est brisée
    Alors la marque « Braises 2 » est barrée et grisée tant qu'elle est étourdie
    Quand elle fait son retour en garde
    Alors la marque « Braises 2 » revient

  # --- La Phalène voleuse et le Vol d'Élan ---

  @domain
  Scénario: La Phalène voleuse est un ennemi ordinaire des Jardins de cendre
    Étant donné un combat ordinaire au palier 2 avec une Phalène voleuse
    Alors ses valeurs du Codex sont 26 PV, garde 12 et Initiative 9
    Et au combat elle a 35 PV et une garde de 15
    Et ses coups sont le Frôlement (double frappe de 4 + 4) et la Poudre d'ailes (coup trompeur de 8), dans un rapport de 2 contre 1
    Et maudite, elle a 42 PV, une garde de 18, un Frôlement de 5 + 5 et une Poudre d'ailes de 9

  @ui
  Scénario: Un impact reçu vole 1 Élan
    Étant donné le héros avec 3 Élan
    Quand un impact de la Phalène voleuse le touche sans défense
    Alors il subit les dégâts, puis perd 1 Élan et passe à 2 Élan
    Et un losange d'or quitte sa barre d'Élan et file vers la Phalène, avec le mot « −1 Élan »
    Et le lecteur d'écran annonce les dégâts, puis « La Phalène voleuse te vole 1 Élan, 2 sur 5 »

  @domain
  Scénario: Une bonne parade laisse voler l'Élan
    Étant donné le héros avec 3 Élan
    Quand il fait une bonne parade sur un impact de la Phalène voleuse
    Alors il subit 25 % des dégâts et perd 1 Élan

  @domain
  Scénario: Un Frôlement reçu en entier vole 2 Élan
    Étant donné le héros avec 3 Élan
    Quand les 2 impacts d'un Frôlement le touchent
    Alors il perd 2 Élan et passe à 1 Élan

  @domain
  Scénario: Parade parfaite et esquive protègent l'Élan
    Étant donné le héros avec 3 Élan
    Quand il pare parfaitement un impact de la Phalène voleuse
    Alors rien n'est volé et il gagne son +1 Élan habituel
    Quand il esquive un impact dans la fenêtre
    Alors rien n'est volé

  @ui
  Scénario: Sans Élan, rien n'est volé
    Étant donné le héros avec 0 Élan
    Quand un impact de la Phalène voleuse le touche
    Alors il subit les dégâts et reste à 0 Élan
    Et aucun losange ni aucun mot « −1 Élan » ne s'affiche
    Et le lecteur d'écran n'annonce rien de plus que les dégâts

  @domain
  Scénario: Le Rempart réduit les dégâts mais n'empêche pas le vol
    Étant donné le héros sous un Rempart actif avec 3 Élan
    Quand un impact de la Phalène voleuse le touche
    Alors les dégâts sont réduits par le Rempart et la Riposte part
    Et il perd quand même 1 Élan

  @domain
  Scénario: Le Vol d'Élan ne change ni avec le palier ni avec la malédiction
    Étant donné une Phalène voleuse maudite au palier 2
    Quand un impact le touche
    Alors le héros perd exactement 1 Élan

  @ui
  Scénario: Le vol se ressent en phase du héros
    Étant donné le héros à qui la Phalène voleuse a volé l'Élan d'un pouvoir
    Quand vient sa phase du héros
    Alors la touche de ce pouvoir est grisée et dit « Il manque 1 Élan », comme aujourd'hui

  # --- Rencontre, tirage, escorte ---

  @session
  Scénario: Première rencontre de la Cosse de braise et de la Phalène voleuse
    Étant donné un joueur qui n'a jamais rencontré la Phalène voleuse
    Quand un combat avec une Phalène voleuse commence
    Alors la bulle de première rencontre « Phalène voleuse » s'affiche, sans rien bloquer
    Et le premier toucher la ferme
    Et elle ne revient plus dans les combats suivants
    Et il en va de même pour la Cosse de braise avec sa propre bulle

  @domain
  Scénario: Les nouveaux ennemis entrent dans les groupes des Jardins de cendre
    Étant donné le palier 2
    Alors un groupe d'ennemis est tiré parmi le Pèlerin enronce, la Ronce de cendre, la Glaneuse de cendre, l'Embrasé, la Phalénide, la Cosse de braise et la Phalène voleuse, dans cet ordre
    Et la Cosse de braise et la Phalène voleuse ont chacune un poids de tirage de 2 et au plus 1 par groupe
    Et l'escorte d'une Élite des Jardins de cendre peut les tirer, au multiplicateur de palier
    Et elles ne sont tirées dans aucun autre palier

  @domain
  Scénario: Les autres paliers ne changent pas
    Étant donné une ascension aux Catacombes ou au Beffroi
    Alors ses groupes d'ennemis, ses escortes et ses marches figées du palier 1 sont identiques à ceux d'avant cette story
