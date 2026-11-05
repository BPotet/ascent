# language: fr
Fonctionnalité: Le fond de palier
  Story #176 (chemin B, épique #174) : chaque palier a son propre fond sur l'écran de combat, choisi
  et validé par le propriétaire dans l'Atelier de l'ascension, recopié le 01/11/2026.

  # Les scénarios passent par le vrai écran de l'ascension, sur une vraie session d'ascension et un
  # Stockage clé-valeur en mémoire (« fermée puis reprise » : une nouvelle session sur le même
  # stockage). Le canevas Skia du fond est simulé sous Jest : la simulation expose son palier.

  Plan du Scénario: Chaque palier a son fond
    Étant donné une ascension au palier <palier>
    Quand un combat commence
    Alors l'écran de combat montre le fond de palier <fond>

    Exemples:
      | palier | fond                  |
      | 1      | des Catacombes        |
      | 2      | des Jardins de cendre |
      | 3      | du Beffroi            |

  Scénario: Le fond change avec le palier
    Étant donné le boss du palier 1 vaincu
    Quand le premier combat du palier 2 commence
    Alors l'écran de combat montre le fond des Jardins de cendre

  Scénario: Les Élites et le boss gardent le fond de leur palier
    Étant donné un combat d'Élite ou de boss au palier 3
    Alors l'écran de combat montre le fond du Beffroi

  Scénario: Le fond est repris avec le combat
    Étant donné un combat en cours au palier 2
    Quand l'application est fermée puis le combat repris
    Alors l'écran de combat montre toujours le fond des Jardins de cendre

  Scénario: Limite — le fond ne gêne jamais le combat
    Étant donné l'écran de combat sur n'importe quel fond de palier
    Alors le sceau, le Reflet, les intentions, les PV, la garde et les touches de combat restent aussi lisibles qu'aujourd'hui
    Et chaque texte garde un contraste d'au moins 4,5:1

  Scénario: Limite — mouvement réduit
    Étant donné le mouvement réduit actif
    Alors le fond de palier est fixe

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Alors le fond de palier n'est pas lu
