# language: fr
Fonctionnalité: Riposte du Rempart
  Story #128 (chemin B, Atelier du 29/10/2026) : le Rempart de la Sentinelle s'use au premier
  impact qui lui fait des dégâts, et elle riposte une fois, à la fin du coup, sur l'ennemi qui l'a
  frappée (règles R1 à R6).

  # Les scénarios `@ui` passent par l'écran de combat, sur une vraie session de combat, l'horloge
  # de combat manuelle et des coups fixés. L'écu, ses éclats et l'onde sont dessinés par Skia,
  # simulé sous Jest : ils se vérifient sur ce que l'écran passe à la scène et par les fonctions
  # pures de la scène. Le scénario de l'ennemi étourdi est une règle du domaine, sans écran.

  Contexte:
    Étant donné le héros est la Sentinelle, sans bienfait
    Et son Rempart est actif

  @ui
  Scénario: Le Rempart actif se voit pendant la phase ennemie
    Quand la phase ennemie commence
    Alors l'écu d'argent est visible devant la Sentinelle, fixe, sans pulsation
    Et l'étiquette « Rempart » est visible sous ses PV
    Et le lecteur d'écran dit « La Sentinelle, PV 51 sur 80, Élan 0 sur 5, Rempart »

  @ui
  Scénario: Un coup reçu use le Rempart et déclenche la riposte
    Étant donné la Sentinelle a 51 PV et la garde de la Goule est à 15
    Quand un coup simple de la Goule touche la Sentinelle
    Alors le chiffre « −2 » apparaît sur la Sentinelle
    Et l'écu se fend puis éclate
    Et l'étiquette sous ses PV devient « Rempart usé », puis disparaît à la fin du coup
    Et le lecteur d'écran dit « Touché, 2 dégâts. Rempart usé. »
    Et à la fin du coup, la Sentinelle riposte sur la Goule : 3 PV et 3 de garde
    Et le mot de scène « Riposte » apparaît, précédé de l'écu
    Et le chiffre « −3 », précédé de l'écu et de taille normale, apparaît sur la Goule
    Et le son de choc de bouclier est joué une seule fois, avec une vibration courte et sans arrêt sur image
    Et le lecteur d'écran dit « Riposte du Rempart, Goule, 3 dégâts »
    Et l'Élan de la Sentinelle ne change pas

  @ui
  Scénario: Un coup imparable encaissé déclenche la riposte
    Quand un coup imparable du Spectre touche la Sentinelle
    Alors les dégâts du coup sont divisés par deux, après la réduction des dégâts
    Et le Rempart est usé : l'écu éclate et l'étiquette devient « Rempart usé »
    Et à la fin du coup, la Sentinelle riposte sur le Spectre : 3 PV et 3 de garde
    Et le mot de scène « Riposte » apparaît
    Et le lecteur d'écran dit « Riposte du Rempart, Spectre, 3 dégâts »
    Et la riposte ne donne pas d'Élan

  @ui
  Scénario: Une bonne parade déclenche la riposte
    Quand la Sentinelle pare un coup simple de la Goule avec une bonne parade
    Alors le Rempart est usé : l'écu éclate et l'étiquette devient « Rempart usé »
    Et à la fin du coup, elle riposte sur la Goule : 3 PV et 3 de garde
    Et le mot de scène « Riposte » apparaît

  @ui
  Scénario: La riposte vise l'ennemi qui a porté le coup, pas la cible choisie
    Étant donné la cible choisie par le joueur est le Villageois fou
    Quand un coup de la Goule use le Rempart
    Alors la riposte touche la Goule
    Et le lecteur d'écran dit « Riposte du Rempart, Goule, 3 dégâts »

  @ui
  Scénario: Une parade parfaite donne la contre-attaque normale et garde le Rempart
    Quand la Sentinelle pare parfaitement tous les impacts d'un coup de la Goule
    Alors elle contre-attaque normalement : 6 PV et 12 de garde, « Parfait · contre-attaque »
    Et il n'y a pas de riposte : ni mot de scène « Riposte » ni son de choc de bouclier
    Et le Rempart reste actif : l'écu et l'étiquette « Rempart » restent intacts

  @ui
  Scénario: Une esquive ne donne rien
    Quand la Sentinelle esquive un coup du Spectre
    Alors il n'y a ni riposte ni contre-attaque
    Et le Rempart reste actif : l'écu et l'étiquette « Rempart » restent intacts

  @ui
  Scénario: Limite : une double frappe ne donne qu'une seule riposte
    Quand les deux impacts d'une double frappe de la Goule touchent la Sentinelle
    Alors seul le premier impact est divisé par deux
    Et l'étiquette devient « Rempart usé » au premier impact
    Et la Sentinelle riposte une seule fois, à la fin du coup, jamais entre deux impacts

  @ui
  Scénario: Limite : double frappe, premier impact paré parfaitement, second en bonne parade
    Quand la Sentinelle pare parfaitement le premier impact d'une double frappe puis pare le second avec une bonne parade
    Alors le Rempart est usé au second impact, le premier qui fait des dégâts
    Et la Sentinelle riposte une seule fois, à la fin du coup
    Et il n'y a pas de contre-attaque

  Scénario: Limite (règle du domaine, sans écran) : sur un ennemi étourdi, la riposte fait 4 PV et 0 de garde
    Étant donné l'ennemi qui porte le coup est étourdi
    Quand son coup use le Rempart
    Alors la riposte lui retire 4 PV et aucun point de garde

  @ui
  Scénario: Limite : la riposte brise la garde
    Étant donné la garde de la Goule est à 3 ou moins
    Quand la riposte la touche
    Alors c'est une cassure de garde normale : « Cassure » prend la place de « Riposte », la Goule est étourdie
    Et le lecteur d'écran dit « Riposte du Rempart, Goule, 3 dégâts », puis « Cassure, Goule étourdie »
    Et si le héros a Cœur de braise, il gagne 1 Élan et 5 PV

  @ui
  Scénario: Limite : la riposte fait tomber l'ennemi
    Étant donné la Goule n'a plus que 3 PV
    Quand la riposte la touche
    Alors la Goule tombe, comme sous une frappe
    Et « Riposte » reste le seul mot de scène

  @ui
  Scénario: Erreur : pas de riposte si la Sentinelle tombe
    Étant donné la Sentinelle n'a plus que quelques PV
    Quand un coup qui use le Rempart la fait tomber
    Alors il n'y a pas de riposte et le combat est perdu

  @ui
  Scénario: Limite : un Rempart encore actif en fin de combat est perdu
    Étant donné le Rempart est actif quand le dernier ennemi tombe
    Quand le combat suivant commence
    Alors le Rempart n'est pas actif
    Et ni l'écu ni l'étiquette « Rempart » ne sont visibles

  @ui
  Scénario: Le pouvoir est décrit par le texte du Codex
    Quand le joueur regarde la Sentinelle sur le Choix du héros
    Alors son pouvoir Rempart est décrit par la description validée dans l'Atelier
