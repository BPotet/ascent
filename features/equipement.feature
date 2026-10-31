# language: fr
Fonctionnalité: L'Équipement, rappel de ce que le joueur possède pendant l'ascension
  Le joueur retrouve son Équipement (ses bénédictions de départ et ses bienfaits, chacun avec son
  icône) au pied de la tour et depuis l'en-tête de chaque écran de l'ascension, combat compris ; en
  combat, ouvrir la feuille met le combat en pause, exactement comme « Pause » (#159, maquette
  validée `docs/mockups/153-boon-blessing-icons/`, écrans 4A à 5G).

  # Les écrans sont rendus par `TowerFootScreen` et `AscentScreen`, sur une ascension sauvegardée,
  # avec la simulation du canevas du combat et de `SpriteCanvas`. La reprise du combat est lue dans
  # la sauvegarde de la session. Les captures end-to-end : `e2e/flows/loadout.yaml`.

  Scénario: L'Équipement au pied de la tour pendant une ascension en cours
    Étant donné une ascension est en cours avec la bénédiction de départ Hâte (Rare)
    Et les bienfaits Écho parfait puis Givre persistant
    Quand le joueur ouvre le pied de la tour
    Alors le cadre de l'ascension montre, sous la jauge, la section « Équipement · 3 » et le lien « Voir le détail »
    Et la sous-section « Bénédictions de départ » montre la Hâte en pastille d'équipement
    Et la sous-section « Bienfaits » montre Écho parfait puis Givre persistant, dans l'ordre où ils ont été gagnés
    Et « Reprendre l'ascension » et « Abandonner l'ascension » restent affichés

  Scénario: Avant l'ascension, le pied de la tour ne change pas
    Étant donné aucune ascension n'est en cours
    Quand le joueur ouvre le pied de la tour
    Alors aucune section « Équipement » n'est affichée
    Et le compte « 3 bénédictions de départ » reste affiché comme aujourd'hui

  Scénario: La feuille de l'Équipement montre les effets
    Étant donné le pied de la tour montre l'Équipement d'une ascension en cours
    Quand le joueur touche « Voir le détail »
    Alors la feuille « Équipement » s'ouvre avec « Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension. »
    Et chaque bénédiction de départ, puis chaque bienfait, y figure avec son icône, son nom, sa rareté (« ◆◆ Rare ») et son effet
    Quand le joueur touche « Fermer » ou fait le geste retour
    Alors la feuille se ferme et le focus revient sur « Voir le détail »

  Scénario: Le bouton « Équipement » dans l'en-tête de tous les écrans de l'ascension
    Étant donné une ascension avec 3 bénédictions de départ et 5 bienfaits
    Quand l'écran affiché est le choix d'une bénédiction, le combat, le choix d'un bienfait, « Bienfait obtenu », l'objet trouvé ou le choix des sorties
    Alors l'en-tête montre, à côté de « Pause », le bouton « Équipement » avec le nombre 8
    Et le bouton fait 48 dp et se trouve en haut, loin des touches de combat
    Et le lecteur d'écran le lit « Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste »

  Scénario: En combat, ouvrir l'Équipement met le combat en pause
    Étant donné un combat est en cours
    Quand le joueur touche « Équipement » dans l'en-tête
    Alors le combat se met en pause, exactement comme avec « Pause »
    Et la feuille « Équipement » s'ouvre avec « Combat en pause » en tête
    Et le bouton est lu « … Ouvre la liste. Met le combat en pause »
    Quand le joueur ferme la feuille
    Alors « Reprise dans 3 » s'affiche
    Et l'action en cours reprend au début de sa préparation, avec le même tirage
    Et un impact déjà jugé reste acquis

  Scénario: Hors combat, ouvrir l'Équipement ne met rien en pause
    Étant donné l'écran « Choisis un bienfait » ou « Choisis ta sortie »
    Quand le joueur touche « Équipement » dans l'en-tête
    Alors la feuille « Équipement » s'ouvre, sans « Combat en pause »
    Et à sa fermeture, l'écran revient tel qu'il était, sans compte à rebours

  Scénario: Le nombre de l'Équipement augmente à chaque bienfait pris
    Étant donné l'en-tête montre « Équipement » avec le nombre 3
    Quand le joueur prend un bienfait
    Alors l'en-tête de l'écran suivant montre le nombre 4
    Et le bienfait apparaît en dernier dans la sous-section « Bienfaits » de la feuille et du pied de la tour

  Scénario: Limite : Équipement vide
    Étant donné une ascension sans bénédiction de départ (jauge Neutre) pendant le combat de l'étage 1
    Alors le bouton « Équipement » de l'en-tête montre le nombre 0 grisé, et reste utilisable
    Et il est lu « Équipement : vide. Ouvre la liste »
    Quand le joueur l'ouvre
    Alors la feuille montre « Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée. »
    Et « Aucun bienfait pour l'instant. Gagne un combat pour en choisir un. »
    Et au pied de la tour, la section « Équipement · 0 » montre « Aucune bénédiction de départ » et « Aucun bienfait », sans « Voir le détail »

  Scénario: Limite : le build le plus long
    Étant donné une ascension avec 3 bénédictions de départ et 5 bienfaits
    Quand le joueur ouvre le pied de la tour
    Alors le cadre de l'ascension défile, avec l'indication « Fais défiler »
    Et « Reprendre l'ascension » et « Abandonner l'ascension » restent en bas, à portée du pouce
    Quand le joueur ouvre la feuille « Équipement »
    Alors sa liste défile, avec l'indication « Fais défiler »

  Scénario: Accessibilité : l'icône et la couleur ne portent jamais seules le sens
    Étant donné la feuille ou la section « Équipement »
    Alors chaque icône est cachée au lecteur d'écran et toujours à côté de son nom écrit
    Et la rareté se lit au mot et aux losanges
    Et le nombre du bouton est caché au lecteur d'écran, qui lit la phrase
    Et à l'ouverture de la feuille, le focus va au titre « Équipement »
