# language: fr
# Story #139 (épique #136), chemin B : les scénarios de la story, tels quels. Les poses, les poses
# d'un coup, le rouge, la portée, l'élévation, le reflet et les étoiles se vérifient sur les
# fonctions pures de la scène et sur les sprites ; la place des grandes entités sur la géométrie de
# la scène ; le sceau, le combat et le lecteur d'écran à travers la colonne de l'ennemi et l'écran
# de l'ascension (`AscentScreen`) ; la phase 2 de la Gardienne sur un combat réel (`Battle`).

Fonctionnalité: Les Jumeaux et la Gardienne des ossuaires animés, avec les poses d'un coup

  Contexte:
    Étant donné que l'image et l'animation complète des Jumeaux (twins) et de la Gardienne des ossuaires (ossuaryWarden) sont validées dans l'Atelier de l'ascension au 29/10/2026
    Et que l'animation complète, palette rouge et poses d'un coup comprises, est recopiée telle quelle dans le code

  Plan du Scénario: Chacun en combat avec son image validée
    Étant donné une ascension en cours
    Quand le joueur entre dans un <combat> contre <entité>
    Alors <entité> s'affiche en entier avec son image validée (<taille> pixels d'art), à 2 dp par pixel d'art, pieds sur son socle
    Et <entité> n'est plus dessiné avec <dessin d'avant>

    Exemples:
      | combat          | entité                       | taille  | dessin d'avant                    |
      | combat d'Élite  | Les Jumeaux                  | 54 × 54 | la silhouette provisoire          |
      | combat de boss  | la Gardienne des ossuaires   | 52 × 62 | le dessin du Nécromancien         |

  Plan du Scénario: Chaque moment du combat joue les poses de l'animation complète
    Étant donné Les Jumeaux ou la Gardienne des ossuaires en combat
    Quand il <moment>
    Alors il joue les poses <poses> de son animation complète, à 12 images par seconde (83 ms par image)
    Et aucune pose n'est obtenue en déplaçant ou en étirant une autre

    Exemples:
      | moment                                         | poses                                                 |
      | attend son tour                                | idle0, idle1                                          |
      | avance vers le héros puis revient              | step0, step1, step2                                   |
      | prépare un coup sans poses d'un coup           | celles de son animation complète, comme les ennemis de #119 |
      | est touché                                     | idle0, idle1 : il garde sa pose, seul le chiffre des dégâts s'envole, comme aujourd'hui |
      | est étourdi                                    | hurt, puis down, avec les étoiles sur sa tête         |
      | tombe                                          | hurt, estompé et désaturé, comme aujourd'hui          |

  Plan du Scénario: Un coup avec ses poses d'un coup
    Étant donné <entité> en combat
    Quand il prépare <coup>
    Alors les poses <poses du coup> sont celles de ses poses d'un coup pour <coup>, avec leurs ancrages
    Et ses autres poses de ce coup viennent de son animation complète
    Et les durées de préparation et les fenêtres de parade et d'esquive sont celles d'aujourd'hui

    Exemples:
      | entité                       | coup                                          | poses du coup                               |
      | Les Jumeaux                  | le Carreau d'arbalète (coup simple)            | ant0, ant1, ant2, lunge, impact, rec0       |
      | Les Jumeaux                  | l'Onde de choc (coup retardé imparable)        | ant0, ant1, ant2, hes, lunge, impact        |
      | la Gardienne des ossuaires   | Deux tibias (double frappe, phase 2)           | ant0, ant1, ant2, lunge, impact, rec0       |
      | la Gardienne des ossuaires   | Mise en ossuaire (coup imparable, phase 2)     | ant0, ant1, ant2, lunge, impact, rec0       |

  Scénario: Le Carreau d'arbalète part de loin
    Étant donné Les Jumeaux en combat
    Quand ils tirent le Carreau d'arbalète
    Alors leur ruée ne parcourt que la moitié du chemin vers le héros (portée 0,5 de l'Atelier)
    Et l'arbalète est visible sur les poses du coup

  Scénario: Les Jumeaux sautent pour l'Onde de choc
    Étant donné Les Jumeaux en combat
    Quand ils préparent l'Onde de choc
    Alors chaque pose du coup est élevée de l'élévation donnée par l'Atelier (ant0 0, ant1 6, ant2 14, hes 15, lunge 5, impact 0 pixels d'art)
    Et leurs poses du coup s'affichent dans leur palette rouge, avec le sceau qui pulse pendant toute la préparation, hésitation comprise, comme aujourd'hui

  Scénario: La Gardienne change de phase
    Étant donné un combat contre la Gardienne des ossuaires
    Quand ses PV passent à 150 ou moins
    Alors le changement de phase se joue comme aujourd'hui
    Et ses coups de phase 2, Deux tibias et Mise en ossuaire, jouent leurs poses d'un coup
    Et Mise en ossuaire s'affiche dans sa palette rouge

  Scénario: Le reflet et les étoiles suivent la pose
    Étant donné Les Jumeaux ou la Gardienne des ossuaires en combat
    Quand le reflet de son coup s'allume, ou quand il est étourdi
    Alors le reflet part de son œil ou de ses 2 pointes, selon les ancrages de la pose affichée, poses d'un coup comprises
    Et les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée

  Scénario: Limite — les entités sans poses d'un coup
    Étant donné la Goule, le Villageois fou, le Spectre, le Chevalier déchu ou le Prieur sans visage en combat
    Quand il prépare n'importe quel coup
    Alors il joue les poses de son animation complète, comme avant cette story

  Scénario: Limite — jamais d'échelle fractionnaire
    Étant donné Les Jumeaux ou la Gardienne des ossuaires avec son image validée
    Quand il s'affiche, dans n'importe quelle pose, élevé ou non, rouge ou non
    Alors il est à 2 dp par pixel d'art, jamais à une autre échelle, et l'élévation tombe sur un pixel d'art entier

  Scénario: Limite — mouvement réduit
    Étant donné que le mouvement réduit est actif
    Quand Les Jumeaux ou la Gardienne des ossuaires prépare un coup
    Alors il parcourt seulement le quart de sa portée, comme aujourd'hui, avec les mêmes durées
    Et les poses du coup, le reflet, la palette rouge et le sceau restent affichés

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt un combat contre Les Jumeaux ou la Gardienne des ossuaires
    Alors l'image et ses poses ne sont pas lues : elles sont décoratives
    Et le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention, et annonce le type de coup au début de la préparation comme aujourd'hui
