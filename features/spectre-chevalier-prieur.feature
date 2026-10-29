# language: fr
# Story #138 (épique #136), chemin B : les scénarios de la story, tels quels. Les poses, le rouge,
# le reflet et les étoiles se vérifient sur les fonctions pures de la scène et sur les sprites ; la
# place des grandes entités sur la géométrie de la scène ; le sceau, le combat et le lecteur
# d'écran à travers la colonne de l'ennemi et l'écran de l'ascension (`AscentScreen`).

Fonctionnalité: Le Spectre, le Chevalier déchu et le Prieur sans visage animés

  Contexte:
    Étant donné que l'image et l'animation complète du Spectre (specter), du Chevalier déchu (fallenKnight) et du Prieur sans visage (facelessPrior) sont validées dans l'Atelier de l'ascension au 29/10/2026
    Et que l'animation complète, palette rouge comprise, est recopiée telle quelle dans le code

  Plan du Scénario: Chacun en combat avec son image validée
    Étant donné une ascension en cours
    Quand le joueur entre dans un <combat> contre <entité>
    Alors <entité> s'affiche avec son image validée (<taille> pixels d'art), à 2 dp par pixel d'art
    Et il n'est plus dessiné avec <dessin d'avant>

    Exemples:
      | combat          | entité                | taille  | dessin d'avant                   |
      | combat ordinaire | le Spectre           | 44 × 52 | le dessin du Spectre de #81      |
      | combat d'Élite  | le Chevalier déchu    | 44 × 54 | l'ancien dessin de la Goule      |
      | combat de boss  | le Prieur sans visage | 52 × 62 | le dessin du Spectre             |

  Plan du Scénario: Chaque moment du combat joue les poses de l'animation complète
    Étant donné le Spectre, le Chevalier déchu ou le Prieur sans visage en combat
    Quand il <moment>
    Alors il joue les poses <poses> de son animation complète, à 12 images par seconde (83 ms par image)
    Et aucune pose n'est obtenue en déplaçant ou en étirant une autre

    Exemples:
      | moment                             | poses                                                 |
      | attend son tour                    | idle0, idle1                                          |
      | avance vers le héros puis revient  | step0, step1, step2                                   |
      | prépare un coup simple ou une double frappe | ant0, ant1, ant2, puis lunge, impact, rec0, rec1 |
      | prépare un coup retardé            | ant0, ant1, ant2, hes, puis lunge, impact, rec0, rec1 |
      | fait une fausse amorce             | feint0, feint1                                        |
      | est touché                         | idle0, idle1 : il garde sa pose, seul le chiffre des dégâts s'envole, comme aujourd'hui |
      | est étourdi                        | hurt, puis down, avec les étoiles sur sa tête         |
      | tombe                              | hurt, estompé et désaturé, comme aujourd'hui          |

  Plan du Scénario: Le coup imparable se lit en rouge sur le dessin validé
    Étant donné <entité> en combat
    Quand il prépare <coup>, un coup imparable
    Alors ses poses d'attaque s'affichent dans sa palette rouge validée, pose pour pose, aux mêmes moments qu'aujourd'hui
    Et le sceau pulse au-dessus de lui comme aujourd'hui
    Et ses autres coups gardent sa palette normale

    Exemples:
      | entité                             | coup               |
      | le Spectre                         | Étreinte glacée    |
      | le Chevalier déchu                 | Charge de la porte |
      | le Prieur sans visage, en phase 2  | Absolution         |

  Scénario: Le Prieur sans visage change de phase
    Étant donné un combat contre le Prieur sans visage
    Quand ses PV passent à 150 ou moins
    Alors le changement de phase se joue comme aujourd'hui
    Et il garde son animation complète, avec ses poses rouges pour son coup imparable de phase 2

  Scénario: Le reflet et les étoiles suivent la pose
    Étant donné le Spectre, le Chevalier déchu ou le Prieur sans visage en combat
    Quand le reflet de son coup s'allume, ou quand il est étourdi
    Alors le reflet part de son œil ou de ses 2 pointes, selon les ancrages de la pose affichée
    Et les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée

  Scénario: Limite — une entité plus grande que 44 × 52 pixels d'art
    Étant donné le Chevalier déchu (44 × 54) ou le Prieur sans visage (52 × 62) en combat
    Quand il s'affiche, dans n'importe quelle pose
    Alors il s'affiche en entier, à sa taille, à 2 dp par pixel d'art, sans être rogné ni réduit
    Et ses pieds reposent sur son socle, comme ceux des autres ennemis
    Et la Goule, le Villageois fou et les entités de 44 × 52 ou moins gardent leur place d'aujourd'hui

  # Ajusté par #139 : Les Jumeaux et la Gardienne des ossuaires ont leur animation complète.
  # Retirée par #139 : l'étape « les ennemis encore dessinés gardent leurs poses rouges, leur
  # liseré et leur traînée d'aujourd'hui ». Plus aucun ennemi n'est dessiné par le code.
  Scénario: Limite — les entités hors de cette story
    Étant donné le Squelette, le Nécromancien, la Sentinelle ou l'Errante
    Quand il apparaît dans la tour
    Alors il garde son sprite actuel ou sa silhouette provisoire, comme aujourd'hui

  Scénario: Limite — jamais d'échelle fractionnaire
    Étant donné le Spectre, le Chevalier déchu ou le Prieur sans visage avec son image validée
    Quand il s'affiche, dans n'importe quelle pose, rouge ou non
    Alors il est à 2 dp par pixel d'art, jamais à une autre échelle

  Scénario: Limite — mouvement réduit
    Étant donné que le mouvement réduit est actif
    Quand le Spectre, le Chevalier déchu ou le Prieur sans visage prépare un coup, imparable ou non
    Alors il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées
    Et le reflet, la palette rouge et le sceau restent affichés

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt un combat contre le Spectre, le Chevalier déchu ou le Prieur sans visage
    Alors l'image, ses poses et sa palette rouge ne sont pas lues : elles sont décoratives
    Et le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention, et annonce le type de coup au début de la préparation comme aujourd'hui
