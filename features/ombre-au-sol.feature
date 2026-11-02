# language: fr
Fonctionnalité: Ombre au sol à la place des socles sur l'écran de combat
  Story #184 (chemin A, épique #174) : les socles sous les personnages du combat sont retirés,
  remplacés par l'ombre au sol de la maquette validée (`docs/mockups/174-tier-identity/`, `.sock`).

  # Les scénarios passent par le vrai écran de l'ascension, sur une vraie session d'ascension et un
  # Stockage clé-valeur en mémoire. Sous Jest, l'écran reçoit la simulation de la scène, qui expose ce
  # qu'on lui donne ; la vraie scène est ensuite dessinée avec Skia sur ces mêmes entrées, et ses
  # images lues (les ombres au sol, les sprites). La cible se lit sur les colonnes des ennemis.

  Contexte:
    Étant donné une ascension en cours
    Et un combat contre un groupe d'ennemis

  Scénario: Plus aucun socle sous le héros ni sous les ennemis
    Quand l'écran de combat s'affiche
    Alors aucun socle n'est dessiné sous le héros
    Et aucun socle n'est dessiné sous aucun ennemi, qu'il y en ait un seul ou plusieurs

  Scénario: Une ombre au sol sous chaque personnage, comme dans la maquette
    Quand l'écran de combat s'affiche
    Alors chaque ennemi a une ombre au sol sous ses pieds, plate et sombre, comme dans la maquette validée
    Et le héros a une ombre au sol sous ses pieds, du même aspect, à sa taille
    Et l'ombre au sol ne porte aucun bord d'or ni aucune couleur qui distingue la cible

  Scénario: La cible reste marquée sans le socle
    Étant donné la cible sur l'ennemi le plus à gauche
    Quand le joueur touche la colonne d'un autre ennemi debout
    Alors ce nouvel ennemi est la cible
    Et sa plaque a le double cadre d'or, une flèche au-dessus de son intention et son nom en gras
    Et l'ancien ennemi visé n'a plus ni double cadre d'or ni flèche
    Et le lecteur d'écran annonce toujours « cible » pour le nouvel ennemi

  Plan du scénario: Les trois fonds de palier
    Étant donné un combat au palier <palier>
    Quand l'écran de combat s'affiche sur le fond de palier « <fond> »
    Alors aucun socle n'est dessiné
    Et l'ombre au sol de chaque personnage se voit sur le fond, comme dans la maquette

    Exemples:
      | palier | fond                    |
      | 1      | le puits des ossements  |
      | 2      | sous le jardin suspendu |
      | 3      | la cloche tombée        |

  Scénario: Boss seul sur la scène
    Étant donné un combat contre un boss seul
    Quand l'écran de combat s'affiche
    Alors aucun socle n'est dessiné sous le boss
    Et le boss a une ombre au sol sous ses pieds

  Scénario: Ennemi étourdi, tombé ou relevé
    Étant donné un ennemi étourdi, puis un ennemi tombé, puis un ennemi relevé
    Quand l'écran de combat s'affiche
    Alors aucun socle n'apparaît sous eux, dans aucun de ces états
    Et l'ombre au sol reste à sa place sous chacun

  Scénario: Mouvement réduit
    Étant donné le mouvement réduit actif
    Quand un ennemi frappe le héros et que le héros attaque sa cible
    Alors aucun socle n'est dessiné
    Et l'ombre au sol reste fixe sous chaque personnage, sans aucune animation

  Scénario: Combat repris sans régression
    Étant donné un combat mis en pause au milieu d'une manche
    Quand le joueur reprend l'ascension et que le compte à rebours de reprise se termine
    Alors le combat reprend sur le même fond de palier
    Et aucun socle n'est dessiné
    Et chaque personnage a son ombre au sol
    Et la cible est la même qu'avant la pause, toujours marquée par le double cadre d'or et la flèche

  Scénario: Repli quand le fond de palier ne peut pas être dessiné
    Étant donné un fond de palier qui ne peut pas être dessiné
    Quand l'écran de combat s'affiche sur la nuit de repli
    Alors aucun socle n'est dessiné
    Et l'ombre au sol de chaque personnage reste dessinée
