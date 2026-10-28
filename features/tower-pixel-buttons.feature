# language: fr
Fonctionnalité: Les boutons de l'onglet Tour en pixel art
  Tous les boutons de l'onglet Tour sont des boutons pixel, en combat comme hors combat, et la porte
  Élite annonce son objet Rare garanti, pas l'Élite tirée derrière elle (#120).

  # Story en mode prototype. Seuls les scénarios du combat sont exécutés ici : `ActionPad`,
  # `EnemyColumn` et `BattleHintBubble` sont du code définitif, qui garde toutes ses barrières
  # (décision de l'Architect sur #120). Ils sont rendus seuls, comme dans `battleComponents.test.tsx`.
  # Les scénarios des écrans de la tour (B1 à B14, porte Élite, bienfait, état appuyé d'un bouton
  # hors combat, mouvement réduit et texte agrandi) restent dans la story comme spécification ; la
  # porte Élite est vérifiée par `AscentScreen.test.tsx`, l'Élite tirée derrière elle par
  # `Ascent.fate.test.ts` et `items.test.ts`.

  Scénario: Les touches de combat (C1, C3, C4)
    Étant donné un combat de la tour
    Quand c'est la phase du héros
    Alors « Pouvoir » et « Attaquer » ont l'habillage du bouton pixel, 112 dp de haut
    Quand c'est la frappe en rythme
    Alors « Frapper » a l'habillage du bouton pixel, sur toute la largeur, avec la même barre et le même trait
    Quand c'est la phase ennemie
    Alors « Esquive » à gauche et « Parade » à droite ont l'habillage du bouton pixel, 112 dp de haut, sur une grille 1 / 1,45, à la même place
    Et chaque touche réagit dès que le doigt se pose

  # La partie combat de « L'état appuyé d'un bouton pixel » et de « mouvement réduit » : un décalage
  # fixe, sans animation. La vibration et le son viennent de la session de combat, inchangée.
  Scénario: L'état appuyé d'une touche de combat
    Étant donné la phase ennemie d'un combat de la tour
    Quand le joueur pose le doigt sur « Parade »
    Alors la touche descend de 2 dp et son arête s'inverse, sans animation
    Et l'appui est daté à l'instant où le doigt se pose, comme aujourd'hui
    Quand il lève le doigt
    Alors la touche remonte

  Scénario: Le choix de la cible (C2)
    Étant donné la phase du héros
    Quand le joueur touche la colonne d'un ennemi
    Alors sa plaque en cadre cranté prend un double cadre d'or, une flèche au-dessus de l'intention et son nom en gras
    Et toute la colonne reste touchable

  Scénario: La bulle d'aide du combat (C8)
    Étant donné une bulle d'aide du combat affichée
    Quand elle apparaît
    Alors elle est en cadre cranté clair
    Et elle se ferme au toucher, comme aujourd'hui

  Scénario: Limite — temps mort de la transition de phase (C5)
    Étant donné une transition de phase en cours
    Quand le pavé de combat s'affiche
    Alors les touches sont estompées, sans hachures, avec le cadenas et « Attends » en cadre cranté
    Et un appui pendant ce temps est ignoré sans déséquilibre, comme aujourd'hui

  Scénario: Limite — déséquilibre (C6)
    Étant donné un appui raté
    Quand le joueur est déséquilibré
    Alors les touches sont grisées et hachurées, avec « Déséquilibré » en cadre cranté
    Et elles restent actives, comme aujourd'hui

  Scénario: Limite — pouvoir indisponible (C7)
    Étant donné un pouvoir qui coûte plus d'Élan que le héros n'en a
    Quand la phase du héros s'affiche
    Alors « Pouvoir » est hachuré, écrit l'Élan qui manque (« Il manque 1 Élan ») et est annoncé indisponible

  # La partie combat de « Limite — accessibilité inchangée ».
  Scénario: Limite — accessibilité inchangée au combat
    Étant donné que le lecteur d'écran est actif
    Quand le joueur parcourt le combat de la tour
    Alors les rôles et les libellés lus sont ceux d'aujourd'hui (« Attaquer, cible : Villageois fou », « Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan »)
    Et aucun état n'est signalé par la couleur seule
