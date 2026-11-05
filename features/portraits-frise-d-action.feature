# language: fr
Fonctionnalité: Les portraits dans la Frise d'action
  Story #175 (chemin B, épique #174) : la Frise d'action montre le portrait de chaque combattant,
  recopié de son icône validée dans l'Atelier de l'ascension (relue le 02/11/2026), à la place de
  « Toi » et des initiales.

  # Les scénarios passent par le vrai écran de combat sur une vraie session de combat et l'horloge
  # de combat manuelle, ou par le vrai écran de l'ascension sur un Stockage clé-valeur en mémoire
  # (« fermée puis reprise » : une nouvelle session sur le même stockage). Skia est simulé sous
  # Jest : la simulation expose le nom de chaque portrait et sa taille.

  Scénario: Le héros a son portrait
    Étant donné un combat avec la Sentinelle
    Alors la Frise d'action montre le portrait de la Sentinelle, à la place de « Toi »
    Et avec l'Errante, le portrait de l'Errante

  Scénario: Chaque ennemi a son portrait
    Étant donné un combat contre une Goule et un Spectre
    Alors la Frise d'action montre le portrait de la Goule et celui du Spectre, à la place de leur initiale
    Et dans la manche en cours comme dans l'aperçu « suiv. »

  Scénario: Les Élites et les boss ont leur portrait
    Étant donné un combat d'Élite ou de boss, à n'importe quel palier
    Alors la Frise d'action montre le portrait de l'Élite ou du boss

  Scénario: Deux ennemis du même nom, sans pastille
    Étant donné un combat contre deux Goules
    Alors la Frise d'action montre le même portrait de Goule dans la case de chacune
    Et aucune pastille, aucun numéro ni aucune autre marque ne s'ajoute au portrait ou à côté
    Et le cadre de chaque Goule est le même qu'aujourd'hui

  Plan du Scénario: Le boss prend son portrait de phase 2 à son changement de phase
    Étant donné un combat contre <boss>
    Quand ses PV passent à <seuil> ou moins
    Alors dans toutes ses cases de la Frise d'action, manche en cours et aperçu « suiv. », son portrait devient son portrait de phase 2
    Et au même instant que son aspect de phase 2, sans animation propre

    Exemples:
      | boss                      | seuil |
      | la Jardinière des cendres | 210   |
      | le Sonneur des heures     | 250   |
      | Celle qui exauce          | 250   |

  Scénario: Limite — un boss sans aspect de phase 2 garde son portrait
    Étant donné un combat contre la Gardienne des ossuaires ou le Prieur sans visage
    Quand ses PV passent à 150 ou moins
    Alors la Frise d'action garde son portrait

  Scénario: Limite — combat repris après le changement de phase
    Étant donné un combat contre la Jardinière des cendres, déjà en phase 2
    Quand l'application est fermée puis le combat repris
    Alors la Frise d'action montre son portrait de phase 2

  Scénario: La frise vit comme aujourd'hui
    Étant donné un combat en cours
    Quand un ennemi tombe
    Alors son portrait sort aussitôt de la manche et de l'aperçu
    Quand un renfort entre
    Alors il entre dans la frise avec son portrait

  Scénario: Limite — un combattant sans portrait validé
    Étant donné un combattant dont l'icône n'est pas validée dans l'Atelier
    Alors la Frise d'action montre son initiale, comme aujourd'hui (« Toi » pour le héros)
    Et la frise ne montre jamais de case vide

  Scénario: Limite — lecteur d'écran inchangé
    Étant donné que le lecteur d'écran est actif
    Alors la Frise d'action se lit avec la même phrase qu'aujourd'hui, par exemple « Ordre d'action. Manche 3 : Spectre, toi, Goule, Goule. Manche suivante : Spectre, toi, Goule, Goule. »
    Et deux ennemis du même nom se lisent toujours « Goule, Goule »
    Et les portraits, celui de phase 2 compris, ne sont pas lus

  Scénario: Limite — mouvement réduit
    Étant donné le mouvement réduit actif
    Quand un ennemi tombe ou qu'un renfort entre
    Alors son portrait disparaît ou apparaît d'un coup, sans grisé ni glissement
