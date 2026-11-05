# language: fr
# Story #140 (épique #136), chemin B : les scénarios de la story, tels quels. Les poses se vérifient
# sur les fonctions pures de la scène (`heroFrame`) et sur les sprites et l'atlas de chaque
# héroïne ; l'héroïne en jeu, l'ascension reprise et le lecteur d'écran à travers l'écran de
# l'ascension (`AscentScreen`) ; le mouvement et l'échelle sur la scène dessinée avec Skia.

Fonctionnalité: L'Errante et la Sentinelle animées, chacune avec son animation complète

  Contexte:
    Étant donné que l'image et l'animation complète de l'Errante (wanderer) sont validées dans l'Atelier de l'ascension au 29/10/2026
    Et que l'image 2.5D légère et l'animation complète de la Sentinelle (sentinel) sont validées dans l'Atelier
    Et que chaque animation complète de héros est recopiée telle quelle dans le code

  Plan du Scénario: L'héroïne choisie combat avec son propre dessin
    Étant donné une ascension commencée avec <héroïne>
    Quand le joueur entre dans un combat
    Alors <héroïne> s'affiche de dos avec son image validée (36 × 44 pixels d'art), à la place et à la taille du héros d'aujourd'hui
    Et elle n'est plus dessinée avec <dessin d'avant>

    Exemples:
      | héroïne        | dessin d'avant                               |
      | l'Errante      | le dessin de la Sentinelle                   |
      | la Sentinelle  | son dessin de #81                            |

  Plan du Scénario: Chaque moment du combat joue les poses de l'animation complète de l'héroïne
    Étant donné l'Errante ou la Sentinelle en combat
    Quand elle <moment>
    Alors elle joue les poses <poses> de son animation complète, aux mêmes moments et durées qu'aujourd'hui
    Et aucune pose n'est obtenue en déplaçant ou en étirant une autre

    Exemples:
      | moment                                   | poses              |
      | attend                                   | idle0, idle1       |
      | lève sa garde                            | raise              |
      | lève sa garde au moment du reflet        | raiseG             |
      | frappe                                   | atk0, atk1         |
      | pare                                     | parry0, parry1     |
      | esquive                                  | dodge0, dodge1     |
      | est touchée                              | hit0, hit1         |
      | est déséquilibrée                        | off0, off1         |
      | tombe                                    | hit1, comme aujourd'hui |

  Scénario: Une ascension reprise garde son héroïne
    Étant donné une ascension sauvegardée avec l'Errante
    Quand le joueur la reprend et entre dans un combat
    Alors l'Errante s'affiche avec son animation complète

  Scénario: Limite — l'esquive et la frappe gardent leur mouvement
    Étant donné l'Errante ou la Sentinelle en combat
    Quand elle esquive ou frappe
    Alors son déplacement à l'écran est celui d'aujourd'hui
    Et seul le dessin des poses change

  Scénario: Limite — ni liseré ni traînée
    Étant donné l'Errante ou la Sentinelle en combat
    Quand elle lève sa garde au moment du reflet
    Alors la pose raiseG s'affiche telle que validée dans l'Atelier, pixel pour pixel, sans liseré d'or ajouté

  Plan du Scénario: Limite — l'échelle du héros d'aujourd'hui, jamais fractionnaire
    Étant donné un écran de <largeur>
    Et l'Errante ou la Sentinelle avec son image validée
    Quand elle s'affiche, dans n'importe quelle pose
    Alors elle est à <échelle> dp par pixel d'art, comme le héros d'aujourd'hui sur cet écran
    Et jamais à une échelle fractionnaire

    Exemples:
      | largeur          | échelle |
      | 360 dp ou plus   | 3       |
      | moins de 360 dp  | 2       |

  Scénario: Limite — mouvement réduit
    Étant donné que le mouvement réduit est actif
    Quand l'Errante ou la Sentinelle esquive ou frappe
    Alors son mouvement est réduit comme aujourd'hui, avec les mêmes poses

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt un combat
    Alors l'héroïne et ses poses ne sont pas lues : elles sont décoratives
    Et la barre du héros est lue comme aujourd'hui
