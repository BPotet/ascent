# language: fr
Fonctionnalité: Élite escortée
  Story #257 (épique #245) : aux paliers 2 et 3, l'Élite vient escortée d'ennemis ordinaires du
  palier, annoncée par la porte Élite ; le héros choisit sa cible et doit tout battre. Les PV et
  les dégâts des Élites passent à 80 / 80 / 88 % (décision du 08/11/2026).

  # Les scénarios `@domain` éprouvent les règles du domaine (règle du palier, tirages de
  # l'ascension, moteur du combat). Les scénarios `@session` passent par une vraie session
  # d'ascension sur un stockage en mémoire. Les scénarios `@ui` passent en plus par les portes et
  # le combat.

  Contexte:
    Étant donné une ascension sans malédiction

  @ui
  Scénario: Au palier 1, l'Élite vient seule
    Étant donné le héros au palier 1 devant une porte Élite
    Quand il entre dans le combat d'Élite
    Alors la porte dit « Élite », sans annonce d'escorte
    Et l'Élite est le seul ennemi du combat
    Et les tirages de l'ascension sont les mêmes qu'avant cette story

  @ui
  Scénario: Au palier 2, une escorte de 1 ennemi
    Étant donné le héros au palier 2
    Quand les sorties de l'étage proposent une porte Élite
    Alors la porte Élite annonce « escortée » et la taille 1, jamais quel ennemi
    Quand il entre dans le combat d'Élite
    Alors l'Élite est à la place de gauche et elle est la cible par défaut
    Et 1 ennemi d'escorte, tiré parmi le Pèlerin enronce, la Ronce de cendre, l'Embrasé et la Phalénide, est en première ligne à sa droite

  @domain
  Scénario: Au palier 3, une escorte de 2 ennemis, jamais un soutien
    Étant donné le héros au palier 3 dans un combat d'Élite
    Alors 2 ennemis d'escorte sont tirés de gauche à droite parmi le Veilleur d'airain, la Gargouille, le Fondeur de cloches, le Novice des cloches, le Jaquemart, le Bélier de bronze et le Battant de cloche
    Et l'escorte ne contient jamais la Sonneuse de matines, la Glaneuse de cendre ni le Nécromancien
    Et l'escorte ne contient jamais plus de 2 Phalénides ni plus de 2 Novices des cloches
    Et le combat n'a ni réserve ni renfort

  @domain
  Scénario: Chaque ennemi garde son multiplicateur
    Étant donné un Novice des cloches d'escorte au palier 3
    Alors il a 45 PV, garde 24, et son Bout de corde fait 7
    Et son Initiative est celle du Codex
    Et le Premier Pèlerin qu'il escorte a 237 PV et garde 82

  @domain
  Scénario: Compensation des Élites (décision du 08/11/2026)
    Quand une Élite est affrontée au palier 1, 2 ou 3
    Alors ses PV max et les dégâts de ses coups prennent 80 %, 80 % ou 88 % de ses valeurs du Codex, à l'entier inférieur
    Et la colonne garde du multiplicateur d'Élite et de boss ne change pas (125 %, 140 % et 150 %)
    Et le multiplicateur des boss ne change pas

  @domain
  Scénario: Au palier 1, les Élites des Catacombes passent à 80 %
    Étant donné le héros au palier 1 dans un combat d'Élite
    Quand l'Élite est le Chevalier déchu
    Alors il a 160 PV et garde 56, et ses coups font 6, 6 et 9
    Quand l'Élite est les Jumeaux
    Alors ils ont 160 PV et garde 37, et leurs coups font 4 + 4, 8 et 4
    Et les boss du palier 1 gardent leurs PV et leurs dégâts du Codex

  @domain
  Scénario: Au palier 2, Se relève seul suit les PV compensés
    Étant donné l'Épouvantail au palier 2
    Alors il a 152 PV et garde 70, et ses coups font 8, 8 et 12
    Quand il tombe une première fois
    Alors il se relève seul à 60 PV (40 % de 152, à l'entier inférieur)

  @domain
  Scénario: Au palier 3, l'arrondi se fait à l'entier inférieur
    Étant donné le Premier Pèlerin au palier 3
    Alors il a 237 PV (270 × 88 % = 237,6) et garde 82
    Et ses coups font 7 + 7, 12, 12 et 18
    Étant donné le Saint de pierre au palier 3
    Alors il a 220 PV et garde 120, et ses coups font 11, 14 et 19

  @domain
  Scénario: La chute de l'Élite ne termine pas le combat (décision Q3)
    Étant donné un combat d'Élite escortée où l'escorte est encore debout
    Quand l'Élite tombe pour de bon
    Alors le combat continue
    Et la cible passe à l'ennemi debout le plus à gauche
    Quand le dernier ennemi d'escorte tombe pour de bon
    Alors c'est la victoire

  @domain
  Scénario: Un ennemi d'escorte qui se relève seul doit tomber pour de bon
    Étant donné une Élite tombée et un seul ennemi d'escorte debout qui se relève seul
    Quand cet ennemi tombe une première fois
    Alors il se relève et le combat continue

  @domain
  Scénario: L'escorte tombe d'abord
    Étant donné un combat d'Élite escortée
    Quand tous les ennemis d'escorte tombent pour de bon
    Alors la cible revient à l'Élite
    Et aucun ennemi n'entre en renfort

  @session
  Scénario: Les récompenses ne changent pas
    Quand le héros gagne un combat d'Élite escortée au palier 3
    Alors il gagne 37 Or, l'objet Rare garanti, le Coffre scellé, 2 Éclats, le tirage du Cœur de braise et le Répit, comme pour une Élite seule
    Et l'escorte ne rapporte aucun Or

  @ui
  Scénario: Malédiction −1, un ennemi d'escorte maudit
    Étant donné une ascension à −1 de malédiction au palier 2
    Quand le héros arrive aux sorties de l'étage
    Alors la porte Élite dit aussi « dont 1 maudit »
    Quand il entre dans le combat d'Élite
    Alors l'ennemi d'escorte est maudit et l'Élite ne l'est pas
    Et une Phalénide d'escorte maudite a 39 PV, garde 18 et un Vol brisé de 6

  @domain
  Scénario: Malédiction −1 au palier 3, un seul maudit parmi l'escorte
    Étant donné une ascension à −1 de malédiction au palier 3
    Quand il entre dans le combat d'Élite
    Alors exactement 1 des 2 ennemis d'escorte est maudit, tiré à égalité

  @ui
  Scénario: Malédiction −2, l'Élite est maudite, pas l'escorte
    Étant donné une ascension à −2 de malédiction au palier 3
    Alors la porte Élite dit « Élite maudite »
    Et dans le combat, l'Élite est maudite et aucun ennemi d'escorte ne l'est

  @domain
  Scénario: Malédiction −1 au palier 1
    Étant donné une ascension à −1 de malédiction au palier 1
    Quand le héros entre dans un combat d'Élite
    Alors aucun ennemi n'est maudit, comme avant cette story

  @domain
  Scénario: Ordre des tirages
    Étant donné une graine de l'ascension fixée
    Quand le combat d'Élite est préparé au palier 2 ou 3
    Alors les tirages se font dans l'ordre : Élite (aucun s'il n'y a qu'un candidat), escorte (1 par ennemi), ennemi maudit, graine du combat
    Et la même graine donne toujours la même Élite, la même escorte et le même ennemi maudit

  @session
  Scénario: Combat d'Élite sauvegardé avant la mise à jour
    Étant donné une ascension sauvegardée pendant un combat d'Élite au palier 3, avant cette story
    Quand le joueur la reprend
    Alors le combat se rejoue sans escorte
