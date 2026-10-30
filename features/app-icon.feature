# language: fr
Fonctionnalité: Icône de l'application et écran de démarrage
  Story #166 : la tour sous la nuit (proposition A) sur l'écran d'accueil du téléphone, à l'écran
  de démarrage et en favicon. Les six images sont tirées de la grille figée par
  `scripts/app-icon/generate.mjs`, agrandies au plus proche voisin, sans lissage (ADR 0011).

  # Les étapes lancent le vrai script, dans un dossier temporaire, puis relisent les PNG avec leur
  # propre décodeur (`features/support/decodePng.ts`) et la grille avec leur propre lecteur : l'oracle
  # ne dépend pas du code testé.

  Contexte:
    Étant donné la grille figée de la proposition A, validée par le propriétaire le 30/10/2026
    Et le tableau « Pour la recopie » de la maquette docs/mockups/160-app-icon/index.html

  Scénario: Les six images existent aux bonnes tailles
    Quand le script de génération de l'icône de l'application est lancé
    Alors les fichiers suivants existent, en PNG, aux tailles suivantes :
      | Fichier                            | Grille                     | Facteur                 | Taille      |
      | assets/icon.png                    | Fond + avant-plan, 54 × 54 | ×28, recadrée au centre | 1024 × 1024 |
      | assets/android-icon-foreground.png | Avant-plan, 54 × 54        | ×8                      | 432 × 432   |
      | assets/android-icon-background.png | Fond, 54 × 54              | ×8                      | 432 × 432   |
      | assets/android-icon-monochrome.png | Monochrome, 54 × 54        | ×8                      | 432 × 432   |
      | assets/favicon.png                 | Petit format, 16 × 16      | ×3                      | 48 × 48     |
      | assets/splash-icon.png             | Démarrage, 54 × 54         | ×16                     | 864 × 864   |

  Scénario: Chaque pixel est identique à la grille, sans lissage
    Étant donné une image générée et sa grille de pixels d'art
    Quand on compare chaque pixel du PNG au pixel d'art qui le couvre (agrandissement au plus proche voisin)
    Alors la couleur et l'opacité sont exactement celles de la palette d'art de la grille
    Et un « . » de la grille donne un pixel entièrement transparent
    Et aucun pixel ne porte de couleur intermédiaire (aucun lissage, aucune demi-transparence non prévue par la grille)

  Scénario: L'icône complète est opaque et recadrée au centre
    Étant donné le fond puis l'avant-plan superposés, agrandis ×28 en 1512 × 1512
    Quand l'image est recadrée au centre en 1024 × 1024
    Alors assets/icon.png correspond pixel pour pixel à ce recadrage
    Et aucun de ses pixels n'est transparent

  Scénario: La génération est reproductible
    Étant donné les six images déjà générées et committées
    Quand le script de génération est relancé depuis la grille figée
    Alors les six fichiers produits sont identiques, octet pour octet, à ceux committés

  Scénario: Une grille invalide est refusée
    Étant donné une grille dont une rangée n'a pas la bonne largeur, ou qui utilise un caractère absent de la palette d'art
    Quand le script de génération est lancé
    Alors il s'arrête en erreur en nommant le calque et la rangée fautifs
    Et aucune image existante n'est remplacée
