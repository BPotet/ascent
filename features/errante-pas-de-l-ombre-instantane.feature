# language: fr
# Story #173 (épique #170), chemin B : les scénarios de la story, tels quels. Ils passent par
# l'écran de combat (`BattleScreen`), sur une vraie session de combat, l'horloge de combat manuelle
# et des coups fixés, et par le Choix du héros pour les valeurs de l'Errante. Skia est simulé sous
# Jest : l'ombre et la pose se vérifient sur ce que l'écran passe à la scène. Depuis #271, le pouvoir
# se lance par sa ligne dans la liste des pouvoirs, qu'ouvre la touche « Pouvoirs ».

Fonctionnalité: Le pouvoir instantané de l'Errante

  Scénario: Les nouvelles valeurs de l'Errante
    Quand le joueur choisit l'Errante
    Alors elle a 55 PV
    Et Pas de l'ombre coûte 3 Élan
    Et le texte du pouvoir est celui du Codex

  Scénario: La ligne de Pas de l'ombre dit que le pouvoir est instantané
    Étant donné l'Errante en phase du héros avec 3 Élan
    Alors la ligne de Pas de l'ombre dit « Pas de l'ombre » et, en dessous, « 3 Élan · Instantané »
    Et la mention « Instantané » est toujours là, à chaque combat
    Et le Rempart de la Sentinelle n'a jamais cette mention

  Scénario: Lancer Pas de l'ombre puis attaquer dans la même phase
    Étant donné l'Errante en phase du héros avec 3 Élan
    Quand le joueur lance Pas de l'ombre
    Alors Pas de l'ombre est actif et l'Errante a 0 Élan
    Et la ligne de Pas de l'ombre passe à « ✓ Actif »
    Et la phase du héros continue : ni transition de phase, ni annonce de phase
    Et le joueur peut viser un ennemi et attaquer
    Et l'attaque rapporte son +1 Élan, comme d'habitude
    Et la transition de phase n'a lieu qu'après l'attaque

  Scénario: Pas de l'ombre actif se voit sous les PV
    Étant donné que le joueur vient de lancer Pas de l'ombre
    Alors l'étiquette « Pas de l'ombre » s'affiche sous les PV de l'Errante, comme celle du Rempart
    Et elle reste visible en phase ennemie, jusqu'à l'emploi du pouvoir ou la fin du combat

  Scénario: Le son du lancer
    Quand le joueur lance Pas de l'ombre
    Alors le son du Rempart se joue, comme aujourd'hui
    Et ni le son ni la vibration de l'annonce de phase

  Scénario: L'effet de Pas de l'ombre ne change pas
    Étant donné Pas de l'ombre actif
    Quand l'Errante esquive dans la fenêtre tous les impacts d'un coup
    Alors elle contre-attaque (6 PV, garde 5, ×1,5 sur un ennemi étourdi)
    Et Pas de l'ombre n'est plus actif et son étiquette disparaît

  Scénario: Limite — pas assez d'Élan
    Étant donné l'Errante en phase du héros avec 2 Élan
    Alors Pas de l'ombre est visible mais indisponible, et dit « Il manque 1 Élan »

  Scénario: Limite — une seule fois tant qu'il est actif
    Étant donné Pas de l'ombre déjà actif et l'Errante avec 3 Élan
    Alors la ligne de Pas de l'ombre dit « ✓ Actif » et Pas de l'ombre est indisponible jusqu'à son emploi ou la fin du combat

  Scénario: Limite — jamais en phase ennemie
    Étant donné une phase ennemie
    Alors Pas de l'ombre ne peut pas être lancé

  Scénario: Limite — la Sentinelle ne change pas
    Étant donné la Sentinelle en phase du héros avec 1 Élan
    Quand le joueur lance le Rempart
    Alors le Rempart prend son action, comme aujourd'hui

  Scénario: Limite — lecteur d'écran
    Étant donné que le lecteur d'écran est actif
    Quand le joueur lance Pas de l'ombre
    Alors il entend « Pas de l'ombre actif. Toujours à toi : vise et attaque. »
    Et le focus passe à Attaquer
    Et la ligne de Pas de l'ombre se lit « Pouvoir : Pas de l'ombre, 3 Élan, instantané » (« …, actif » une fois lancé ; « …, indisponible : il manque 1 Élan »)
