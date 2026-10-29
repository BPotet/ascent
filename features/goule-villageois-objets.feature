# language: fr
# Story #119 (épique #118), chemin B : les scénarios de la story, tels quels. Les poses, le reflet
# et les étoiles se vérifient sur les fonctions pures de la scène et sur les sprites ; « Objet
# trouvé », le combat et le lecteur d'écran à travers l'écran de l'ascension (`AscentScreen`) ;
# les marques de la scène (cible, estompe) sur la scène dessinée avec Skia.

Fonctionnalité: La Goule et le Villageois fou animés, et les images validées des objets

  Contexte:
    Étant donné que l'image et l'animation complète de la Goule (ghoul) et du Villageois fou (madVillager) sont validées dans l'Atelier de l'ascension au 29/10/2026
    Et que l'image de la Hache rouillée, des Mailles, du Cuir, du Marteau, du Bouclier du veilleur, de l'Amulette de Hâte et de l'Arbalète est validée dans l'Atelier au 29/10/2026
    Et que l'animation complète et les images sont recopiées telles quelles dans le code

  Scénario: La Goule et le Villageois fou en combat
    Étant donné une ascension en cours
    Quand le joueur entre dans un combat dont le groupe compte une Goule et un Villageois fou
    Alors la Goule s'affiche avec son image validée (44 × 52 pixels d'art), à 2 dp par pixel d'art
    Et le Villageois fou s'affiche avec son image validée (40 × 50 pixels d'art), à 2 dp par pixel d'art
    Et le Villageois fou n'est plus dessiné comme une Goule

  Scénario: La Goule validée remplace l'ancien dessin de la Goule
    Étant donné un combat où apparaît une Goule
    Quand le combat s'affiche
    Alors la Goule joue les poses de son animation complète validée
    Et la Goule n'est plus dessinée nulle part avec son ancien dessin

  Plan du Scénario: Chaque moment du combat joue les poses de l'animation complète
    Étant donné une Goule ou un Villageois fou en combat
    Quand il <moment>
    Alors il joue les poses <poses> de son animation complète, à 12 images par seconde (83 ms par image)
    Et aucune pose n'est obtenue en déplaçant ou en étirant une autre

    Exemples:
      | moment                                | poses                                                  |
      | attend son tour                        | idle0, idle1                                           |
      | avance vers le héros puis revient      | step0, step1, step2                                    |
      | prépare un coup simple                 | ant0, ant1, ant2, puis lunge, impact, rec0, rec1       |
      | prépare un coup retardé                | ant0, ant1, ant2, hes, puis lunge, impact, rec0, rec1  |
      | fait une fausse amorce                 | feint0, feint1                                         |
      | est touché                             | idle0, idle1 : il garde sa pose, seul le chiffre des dégâts s'envole, comme aujourd'hui |
      | est étourdi                            | hurt, puis down, avec les étoiles sur sa tête          |
      | tombe                                  | hurt, estompé et désaturé, comme aujourd'hui           |

  Scénario: Le Villageois fou prépare sa Fourche
    Étant donné un combat contre un Villageois fou
    Quand il prépare la Fourche
    Alors il joue les poses d'anticipation de son animation complète, avec le reflet et le son d'aujourd'hui
    Et la Fourche fait saigner comme aujourd'hui (2 PV pendant 3 manches)

  Scénario: Le reflet et les étoiles suivent la pose
    Étant donné une Goule ou un Villageois fou en combat
    Quand le reflet de son coup s'allume, ou quand il est étourdi
    Alors le reflet part de son œil ou de la pointe de son arme, selon les ancrages de la pose affichée
    Et les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée

  Scénario: Les états qui ne sont pas des poses
    Étant donné une Goule ou un Villageois fou en combat
    Quand il est visé, estompé (ennemi non actif) ou tombé
    Alors la pose affichée est marquée comme aujourd'hui : la cible, l'estompe, ou l'estompe désaturée d'un ennemi tombé
    Et aucun éclair blanc ni effacement ne s'ajoute

  Scénario: Ni liseré ni traînée sur les poses recopiées
    Étant donné une Goule ou un Villageois fou en combat
    Quand il prépare un coup ou avance vers le héros
    Alors chaque pose s'affiche telle que validée dans l'Atelier, pixel pour pixel
    Et elle ne s'entoure d'aucun liseré d'or et ne laisse aucune traînée
    Et les ennemis sans animation complète validée gardent leur liseré et leur traînée d'aujourd'hui

  Plan du Scénario: L'image validée d'un objet sur « Objet trouvé »
    Étant donné un combat gagné
    Quand l'objet trouvé est <objet>
    Alors l'écran « Objet trouvé » montre l'image validée de <objet> (24 × 24 pixels d'art), à 3 dp par pixel d'art, soit 72 dp
    Et la silhouette provisoire de son emplacement n'apparaît plus
    Et le nom, les chiffres et le texte de l'objet ne changent pas

    Exemples:
      | objet                |
      | Hache rouillée       |
      | Mailles              |
      | Cuir                 |
      | Marteau              |
      | Bouclier du veilleur |
      | Amulette de Hâte     |
      | Arbalète             |

  Scénario: Limite — un ennemi sans animation complète validée
    Étant donné un ennemi, une Élite ou un boss dont l'animation complète n'est pas validée (Les Jumeaux, la Gardienne des ossuaires)
    Quand il apparaît dans la tour
    Alors il garde son sprite actuel ou sa silhouette provisoire
    Et Les Jumeaux gardent leur silhouette tirée de l'ancien dessin de la Goule
    Et son nom et ses chiffres restent affichés

  # Adapté par #140
  Scénario: Limite — les héros
    Étant donné une ascension avec la Sentinelle ou l'Errante
    Quand le combat s'affiche
    Alors le héros s'affiche dans sa case de 36 × 44 pixels d'art, avec son animation complète (#140)

  Scénario: Limite — jamais d'échelle fractionnaire
    Étant donné la Goule, le Villageois fou ou un objet affiché avec son image validée
    Quand il s'affiche, dans n'importe quelle pose
    Alors il est à 2 dp par pixel d'art en scène, 3 dp sur l'écran « Objet trouvé »
    Et il n'est jamais mis à une autre échelle

  Scénario: Limite — mouvement réduit
    Étant donné que le mouvement réduit est actif
    Quand la Goule ou le Villageois fou prépare un coup
    Alors il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées
    Et le reflet reste affiché

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt un combat contre la Goule ou le Villageois fou, ou l'écran « Objet trouvé »
    Alors l'image et ses poses ne sont pas lues : elles sont décoratives
    Et le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention de l'ennemi, ou le nom et les chiffres de l'objet
