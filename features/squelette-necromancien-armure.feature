# language: fr
# Story #137 (épique #136), chemin B : les scénarios de la story, tels quels. Les poses, le reflet
# et les étoiles se vérifient sur les fonctions pures de la scène et sur les sprites ; « Objet
# trouvé », le combat et le lecteur d'écran à travers l'écran de l'ascension (`AscentScreen`).

Fonctionnalité: Le Squelette et le Nécromancien animés, et l'image de l'Armure de chevalier noir

  Contexte:
    Étant donné que l'image et l'animation complète du Squelette (skeleton) et du Nécromancien (necromancer) sont validées dans l'Atelier de l'ascension au 29/10/2026
    Et que l'image de l'Armure de chevalier noir (blackKnightArmor) est validée dans l'Atelier au 29/10/2026
    Et que l'animation complète et l'image sont recopiées telles quelles dans le code

  Scénario: Le Squelette et le Nécromancien en combat
    Étant donné une ascension en cours
    Quand le joueur entre dans un combat dont le groupe compte un Squelette et un Nécromancien
    Alors le Squelette s'affiche avec son image validée (40 × 48 pixels d'art), à 2 dp par pixel d'art
    Et le Nécromancien s'affiche avec son image validée (44 × 52 pixels d'art), à 2 dp par pixel d'art
    Et le Squelette n'est plus une silhouette provisoire
    Et le Nécromancien n'est plus dessiné avec son dessin d'avant

  Plan du Scénario: Chaque moment du combat joue les poses de l'animation complète
    Étant donné un Squelette ou un Nécromancien en combat
    Quand il <moment>
    Alors il joue les poses <poses> de son animation complète, à 12 images par seconde (83 ms par image)
    Et aucune pose n'est obtenue en déplaçant ou en étirant une autre

    Exemples:
      | moment                             | poses                                                 |
      | attend son tour                    | idle0, idle1                                          |
      | avance vers le héros puis revient  | step0, step1, step2                                   |
      | prépare un coup simple             | ant0, ant1, ant2, puis lunge, impact, rec0, rec1      |
      | est touché                         | idle0, idle1 : il garde sa pose, seul le chiffre des dégâts s'envole, comme aujourd'hui |
      | est étourdi                        | hurt, puis down, avec les étoiles sur sa tête         |
      | tombe                              | hurt, estompé et désaturé, comme aujourd'hui          |

  Scénario: Le Squelette se relève avec ses poses validées
    Étant donné un Squelette tombé qui ne s'est pas encore relevé dans ce combat
    Quand il se relève seul
    Alors l'annonce « Il se relève », le cliquetis d'os et l'étiquette Relevé restent ceux d'aujourd'hui
    Et il reprend les poses de repos de son animation complète

  Scénario: Le Nécromancien garde ou relève un allié
    Étant donné un Nécromancien en combat
    Quand son intention est Garde ou Relever
    Alors il affiche les poses d'aujourd'hui pour ce moment, prises dans son animation complète
    Et l'intention et son icône ne changent pas

  Scénario: Le reflet et les étoiles suivent la pose
    Étant donné un Squelette ou un Nécromancien en combat
    Quand le reflet de son coup s'allume, ou quand il est étourdi
    Alors le reflet part de son œil ou de la pointe de son arme, selon les ancrages de la pose affichée
    Et les étoiles tournent au-dessus de sa tête, selon l'ancrage de la pose affichée

  Scénario: L'image validée de l'Armure de chevalier noir sur « Objet trouvé »
    Étant donné un combat gagné
    Quand l'objet trouvé est l'Armure de chevalier noir
    Alors l'écran « Objet trouvé » montre son image validée (24 × 24 pixels d'art), à 3 dp par pixel d'art, soit 72 dp
    Et la silhouette provisoire de l'emplacement armure n'apparaît plus
    Et son nom, ses chiffres et son libellé « Lourde et lente. » ne changent pas

  Scénario: Limite — le Squelette, plus petit que la case du combat
    Étant donné un Squelette en combat
    Quand il s'affiche, dans n'importe quelle pose
    Alors sa pose est centrée en largeur et calée en bas dans la case de 44 × 52 pixels d'art, sans mise à l'échelle
    Et ses ancrages sont décalés d'autant

  Scénario: Limite — le Nécromancien n'a pas de coup imparable
    Étant donné un Nécromancien en combat
    Quand il prépare un coup
    Alors aucune pose rouge n'est jouée

  # Ajusté par #139 : Les Jumeaux et la Gardienne des ossuaires ont leur animation complète.
  Scénario: Limite — les entités hors de cette story
    Étant donné le Spectre, le Chevalier déchu, le Prieur sans visage, la Sentinelle ou l'Errante
    Quand il apparaît dans la tour
    Alors il garde son sprite actuel ou sa silhouette provisoire, comme aujourd'hui

  Scénario: Limite — jamais d'échelle fractionnaire
    Étant donné le Squelette, le Nécromancien ou l'Armure de chevalier noir affiché avec son image validée
    Quand il s'affiche
    Alors il est à 2 dp par pixel d'art en scène, 3 dp sur l'écran « Objet trouvé », jamais à une autre échelle

  Scénario: Limite — mouvement réduit
    Étant donné que le mouvement réduit est actif
    Quand le Squelette ou le Nécromancien prépare un coup
    Alors il parcourt seulement le quart du chemin, comme aujourd'hui, avec les mêmes durées
    Et le reflet reste affiché

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt un combat contre le Squelette ou le Nécromancien, ou l'écran « Objet trouvé » de l'Armure de chevalier noir
    Alors l'image et ses poses ne sont pas lues : elles sont décoratives
    Et le lecteur d'écran lit toujours le nom, les PV, la garde et l'intention de l'ennemi, ou le nom et les chiffres de l'objet
