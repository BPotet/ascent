# language: fr
Fonctionnalité: La Mère-ronce et le Bedeau
  Story #259 (épique #245) : aux Jardins de cendre, la Mère-ronce et ses Épines, qui coûtent
  des PV à chaque frappe tant qu'elle n'est pas étourdie ; au Beffroi, le Bedeau et son
  Sanctuaire, qui le protège tant que sa garde tient.

  # Les scénarios `@domain` éprouvent les règles du domaine (le moteur du combat, avec les
  # multiplicateurs du combat d'Élite). Le scénario `@session` passe par une vraie session
  # d'ascension sur un stockage en mémoire.

  @domain
  Scénario: La Mère-ronce est une Élite du palier 2
    Étant donné le héros au palier 2 dans un combat d'Élite contre la Mère-ronce
    Alors ses valeurs du Codex sont 170 PV, garde 45 et Initiative 4
    Et au combat elles suivent le multiplicateur d'Élite et de boss du palier 2 (136 PV, garde 63 avec la compensation de #257)
    Et ses coups sont Lianes (double frappe de 4 + 4), Étreinte d'épines (coup retardé de 9 qui fait saigner 2 PV pendant 3 manches) et Floraison noire (coup retardé imparable de 13), un tiers chacun
    Et au combat, avec la compensation de #257, ils font 3 + 3, 7 (Saignement inchangé) et 10

  @domain
  Scénario: Une frappe sur la Mère-ronce coûte 2 PV au héros
    Étant donné le héros à 30 PV et la Mère-ronce non étourdie
    Quand une frappe en rythme du héros la touche
    Alors la Mère-ronce subit ses dégâts
    Et le héros perd 2 PV d'Épines et passe à 28 PV

  @domain
  Scénario: Une frappe de plusieurs coups ne pique qu'une fois
    Étant donné la Mère-ronce non étourdie
    Quand l'Errante la touche de ses 2 coups d'une même frappe
    Alors le héros perd 2 PV d'Épines, une seule fois
    Quand une Rafale la touche
    Alors le héros perd 2 PV d'Épines, une seule fois

  @domain
  Scénario: La frappe qui brise la garde pique
    Étant donné la Mère-ronce non étourdie
    Quand une frappe brise sa garde
    Alors le héros perd 2 PV d'Épines
    Et la Mère-ronce est étourdie

  @domain
  Scénario: Étourdie, elle ne pique pas
    Étant donné la Mère-ronce étourdie
    Quand une frappe du héros la touche
    Alors elle subit × 1,5 dégâts
    Et le héros ne perd aucun PV d'Épines

  @domain
  Scénario: Contre-attaque et Riposte ne piquent pas
    Étant donné la Mère-ronce non étourdie
    Quand une contre-attaque ou la Riposte du Rempart la touche
    Alors le héros ne perd aucun PV d'Épines

  @domain
  Scénario: Les Épines ne font jamais tomber le héros
    Étant donné le héros à 2 PV
    Quand une frappe touche la Mère-ronce non étourdie
    Alors le héros passe à 1 PV
    Étant donné le héros à 1 PV
    Quand une frappe touche la Mère-ronce non étourdie
    Alors le héros reste à 1 PV

  @domain
  Scénario: Les Épines ignorent les protections et les multiplicateurs
    Étant donné le héros avec de la réduction des dégâts, un Rempart et la Brume
    Et la Mère-ronce maudite au palier 2
    Quand une frappe la touche alors qu'elle n'est pas étourdie
    Alors le héros perd exactement 2 PV d'Épines

  @domain
  Scénario: Le Bedeau est une Élite du palier 3
    Étant donné le héros au palier 3 dans un combat d'Élite contre le Bedeau
    Alors ses valeurs du Codex sont 190 PV, garde 64 et Initiative 5
    Et au combat elles suivent le multiplicateur d'Élite et de boss du palier 3 (167 PV, garde 96 avec la compensation de #257)
    Et ses coups sont le Bâton de procession (coup simple de 11), « Silence ! » (coup trompeur de 11) et la Volée du beffroi (coup retardé imparable de 19), un tiers chacun
    Et au combat, avec la compensation de #257, ils font 9, 9 et 16

  @domain
  Scénario: Sous son Sanctuaire, le Bedeau ne perd que la moitié des PV
    Étant donné la Sentinelle avec une Attaque de 10
    Et le Bedeau avec sa garde au-dessus de 0, non étourdi
    Quand elle le touche d'une frappe parfaite
    Alors le Bedeau perd 7 PV
    Et la garde qu'il perd est la même que sans Sanctuaire

  @domain
  Scénario: Le Sanctuaire réduit aussi la contre-attaque et la Riposte
    Étant donné le Bedeau sous son Sanctuaire
    Quand une contre-attaque ou la Riposte du Rempart le touche
    Alors il perd la moitié des PV, au moins 1

  @domain
  Scénario: Le coup qui brise est réduit, puis plus de Sanctuaire
    Étant donné le Bedeau sous son Sanctuaire
    Quand une frappe brise sa garde
    Alors cette frappe ne lui retire que la moitié des PV
    Et il est étourdi
    Quand la Sentinelle avec une Attaque de 10 le touche ensuite d'une frappe parfaite
    Alors il perd 22 PV

  @domain
  Scénario: Le Sanctuaire revient avec la garde
    Étant donné le Bedeau étourdi
    Quand il fait son retour en garde
    Alors son Sanctuaire le protège de nouveau

  @domain
  Scénario: Les escortes n'ont ni Épines ni Sanctuaire
    Étant donné un combat d'Élite escortée contre la Mère-ronce ou le Bedeau (une fois #257 mergée)
    Quand une frappe touche un ennemi d'escorte
    Alors le héros ne perd aucun PV d'Épines
    Et l'ennemi d'escorte subit ses dégâts entiers

  @session
  Scénario: Les nouvelles Élites entrent dans le tirage des Élites
    Étant donné le palier 2
    Alors l'Élite d'une porte Élite est tirée parmi l'Épouvantail, le Brûleur de ronces et la Mère-ronce, selon la règle d'Élite non répétée en vigueur
    Étant donné le palier 3
    Alors elle est tirée parmi le Premier Pèlerin, le Saint de pierre et le Bedeau
