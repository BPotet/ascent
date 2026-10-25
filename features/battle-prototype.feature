# language: fr
Fonctionnalité: Prototype jouable du combat
  Story #31 : la Sentinelle affronte une Goule et un Spectre ; le joueur lit leurs attaques à
  l'animation, puis pare ou esquive au bon moment.
  Adapté par #32 là où le combat complet change une valeur validée : PV ×2,5, le Nécromancien en
  troisième ennemi, la frappe en rythme au lieu de l'attaque de 500 ms, et les intentions montrées
  par leur catégorie seulement (C2.3).

  # Les scénarios sans tag passent par la session de combat (cas d'usage), avec l'horloge de
  # combat manuelle et une graine du combat fixée : leurs instants sont exacts à la milliseconde.
  # Les scénarios `@ui` passent par l'écran du combat d'essai, sur la même session ; le scénario
  # `@adr` lit l'ADR du moteur de combat.

  Contexte:
    Étant donné le combat d'essai : la Sentinelle (80 PV, Attaque 10, réduction des dégâts 10 %) contre la Goule (50 PV), le Spectre (35 PV) et le Nécromancien (45 PV)
    Et le décalage vaut 0 ms

  Scénario: Une manche se déroule dans l'ordre (C1, C12)
    Étant donné le début d'une manche
    Alors chaque ennemi debout affiche la catégorie de son intention, sans le type de coup ni les dégâts
    Quand la Sentinelle attaque la cible présélectionnée
    Alors la transition de phase vers la phase ennemie commence
    Et les ennemis debout attaquent ensuite un par un, de gauche à droite
    Et après une nouvelle transition de phase, la phase du héros suivante commence

  Scénario: La cible est présélectionnée et se change d'un toucher (C4)
    Étant donné la phase du héros du premier combat
    Alors l'ennemi le plus à gauche est la cible
    Quand le joueur touche le Spectre puis « Attaquer »
    Alors le Spectre perd 10 PV
    Et le Spectre reste la cible à la manche suivante

  @ui
  Scénario: Parade parfaite et contre-attaque (C7, C8)
    Étant donné la Goule lance un coup simple de 5 dégâts
    Quand le joueur touche « Parade » 50 ms avant l'impact
    Alors la Sentinelle ne perd aucun PV
    Et la Sentinelle contre-attaque la Goule, qui perd 6 PV (50 % de l'Attaque × 1,3, trait de la Sentinelle : 6,5 arrondi à l'inférieur)
    Et le jeu marque un arrêt sur image, un éclat, un son, une vibration et une légère secousse

  Scénario: Parade bonne (C7, C8)
    Étant donné la Goule lance un coup simple de 5 dégâts
    Quand le joueur touche « Parade » 120 ms après l'impact
    Alors la Sentinelle perd 1 PV (5 × 25 % × 0,9, arrondi à l'inférieur, minimum 1)
    Et il n'y a pas de contre-attaque

  Scénario: Esquive (C8)
    Étant donné la Goule lance un coup simple de 5 dégâts
    Quand le joueur touche « Esquive » 150 ms avant l'impact
    Alors la Sentinelle ne perd aucun PV
    Et il n'y a pas de contre-attaque

  Scénario: Aucun appui (C7, C8)
    Étant donné la Goule lance un coup simple de 5 dégâts
    Quand le joueur ne touche rien
    Alors la Sentinelle perd 4 PV (5 × 0,9, arrondi à l'inférieur) 160 ms après l'impact

  Scénario: Double frappe, chaque coup jugé séparément (C8, C10)
    Étant donné la Goule lance une double frappe de 3 + 3 dégâts, le 2e impact 420 ms après le 1er
    Quand le joueur pare parfaitement le 1er impact et ne touche rien au 2e
    Alors la Sentinelle ne perd aucun PV au 1er impact et perd 2 PV au 2e
    Et il n'y a pas de contre-attaque, car tous les coups n'ont pas été parés parfaitement

  @ui
  Scénario: Coup imparable signalé par le sceau rouge (C8)
    Étant donné le Spectre prépare un coup imparable de 9 dégâts (6 × 1,5)
    Alors le sceau rouge apparaît au-dessus de lui, avec sa forme et un libellé lu par le lecteur d'écran
    Quand le joueur touche « Parade » dans la fenêtre parfaite
    Alors la parade échoue, la Sentinelle perd 8 PV (9 × 0,9, arrondi à l'inférieur) et est déséquilibrée
    Et le message dit qu'un coup imparable s'esquive

  Scénario: Esquiver un coup imparable (C8)
    Étant donné le Spectre prépare un coup imparable de 9 dégâts
    Quand le joueur touche « Esquive » 100 ms avant l'impact
    Alors la Sentinelle ne perd aucun PV

  @ui
  Scénario: Un appui raté déséquilibre, marteler prolonge (C9)
    Étant donné la Goule prépare un coup simple
    Quand le joueur touche « Parade » 400 ms avant l'impact
    Alors la Sentinelle est déséquilibrée pendant 450 ms et les boutons s'affichent grisés et hachurés
    Quand le joueur touche à nouveau « Parade » 200 ms plus tard
    Alors l'appui est ignoré et le déséquilibre dure encore 450 ms à partir de cet appui
    Et l'impact qui tombe pendant le déséquilibre compte comme un coup raté

  @ui
  Scénario: Les boutons réagissent dès que le doigt touche
    Étant donné la phase ennemie
    Quand le doigt se pose sur « Parade »
    Alors l'appui est daté à l'instant du toucher, sans attendre que le doigt se lève

  Scénario: La préparation varie légèrement, de façon reproductible (C10)
    Étant donné un tirage fixé pour les tests
    Quand la Goule lance plusieurs coups simples
    Alors chaque préparation dure entre 880 ms et 1 320 ms (1 100 ms × 0,8 à 1,2)
    Et le même tirage donne les mêmes durées

  Scénario: Le coup trompeur feinte avant de frapper (C10)
    Étant donné le Spectre lance un coup trompeur
    Alors sa préparation contient une fausse amorce entre 35 % et 60 % de sa durée
    Et toucher « Parade » sur la fausse amorce est un appui raté

  Scénario: Transition de phase vers la phase ennemie (C12)
    Étant donné la Sentinelle vient d'attaquer et son attaque est entièrement résolue, animation comprise
    Alors une transition de phase de 800 ms commence
    Et l'annonce de phase « Phase ennemie » s'affiche pendant toute sa durée

  Scénario: Transition de phase vers la phase du héros (C12)
    Étant donné le dernier ennemi debout vient de porter un coup simple, sans appui du joueur
    Quand ce coup est résolu (impact + 160 ms) et la contre-attaque éventuelle terminée
    Alors une transition de phase de 800 ms commence
    Et l'annonce de phase « À toi » s'affiche pendant toute sa durée

  Scénario: Un appui pendant la transition de phase est ignoré, sans déséquilibre (C12)
    Étant donné une transition de phase vers la phase ennemie a commencé
    Quand le joueur touche « Parade » 0 ms, 300 ms puis 799 ms après son début
    Alors aucun de ces appuis n'a d'effet
    Et la Sentinelle n'est pas déséquilibrée
    Et aucun appui n'est mis en mémoire pour la phase ennemie

  Scénario: Un appui pendant la transition vers la phase du héros est ignoré (C12)
    Étant donné une transition de phase vers la phase du héros a commencé
    Quand le joueur touche « Attaquer » 200 ms après son début
    Alors la Sentinelle n'attaque pas
    Et elle attaque seulement si le joueur touche « Attaquer » de nouveau après la fin de la transition

  Scénario: Un doigt maintenu pendant la transition ne compte jamais (C12)
    Étant donné une transition de phase vers la phase ennemie a commencé
    Quand le doigt se pose sur « Parade » 600 ms après son début et reste posé jusqu'à 1 500 ms
    Alors ce toucher n'est jamais jugé, ni comme parade ni comme appui dans le vide
    Quand un nouveau toucher commence sur « Parade » 1 600 ms après le début de la transition
    Alors ce nouveau toucher est jugé

  Scénario: Le premier ennemi s'avance avant de préparer son coup (C12)
    Étant donné une transition de phase vers la phase ennemie de 800 ms
    Quand elle se termine
    Alors le premier ennemi debout s'avance pendant 400 ms
    Et sa préparation (C10) commence seulement ensuite
    Et son premier impact tombe au plus tôt 2 000 ms après la fin de l'attaque de la Sentinelle (800 + 400 + 800)

  Scénario: Un appui pendant l'avancée est dans le vide (C9, C12)
    Étant donné une transition de phase vers la phase ennemie a commencé
    Quand le joueur touche « Parade » 1 000 ms après son début, pendant l'avancée du premier ennemi
    Alors l'appui est dans le vide et la Sentinelle est déséquilibrée pendant 450 ms

  Scénario: Entre deux ennemis, seulement l'avancée (C12)
    Étant donné la Goule vient de porter son coup et le Spectre est encore debout
    Quand le coup de la Goule est résolu
    Alors il n'y a pas de transition de phase
    Et le Spectre s'avance pendant 400 ms avant de préparer son coup

  @ui
  Scénario: Le déséquilibre ne passe pas d'une phase à l'autre (C9, C12)
    Étant donné la Sentinelle est déséquilibrée depuis 100 ms quand le dernier coup ennemi est résolu
    Quand la transition de phase vers la phase du héros commence
    Alors le déséquilibre s'arrête
    Et les boutons ne sont plus hachurés

  @ui
  Scénario: L'annonce de phase se voit, s'entend et se sent (C12)
    Étant donné une transition de phase commence
    Alors une bannière « Phase ennemie » ou « À toi » s'affiche selon le sens
    Et un son propre à chaque sens est joué
    Et une vibration légère accompagne la phase ennemie seulement
    Et le lecteur d'écran annonce la phase qui arrive
    Et les boutons de la phase qui arrive s'affichent inactifs, sans hachures

  @ui
  Scénario: Annonce de phase avec mouvement réduit ou son coupé (C12)
    Étant donné le réglage « réduire les animations » du téléphone est actif
    Quand une transition de phase commence
    Alors la bannière apparaît sans glissement
    Étant donné le son du téléphone est coupé
    Quand une transition de phase vers la phase ennemie commence
    Alors la bannière et la vibration restent

  Scénario: Victoire du combat d'essai (C11)
    Étant donné la Goule, le Spectre et le Nécromancien sont à 0 PV
    Alors le combat est gagné et le joueur peut rejouer

  Scénario: Défaite du combat d'essai
    Étant donné la Sentinelle tombe à 0 PV
    Alors le combat est perdu et le joueur peut rejouer

  @ui
  Scénario: Mouvement réduit
    Étant donné le réglage « réduire les animations » du téléphone est actif
    Quand le joueur réussit une parade parfaite
    Alors il n'y a ni secousse ni éclat plein écran, mais la vibration et le son restent

  @ui
  Scénario: Une bulle d'aide, une seule fois (C12)
    Étant donné le joueur n'a jamais joué de combat
    Quand la première phase ennemie arrive
    Alors une bulle explique Parade et Esquive avant la transition de phase
    Et la transition de phase ne commence qu'à la fermeture de la bulle
    Et au combat suivant, la bulle n'apparaît plus

  @ui
  Scénario: Les valeurs de la transition se règlent pour l'essai (C12)
    Étant donné le build de preview du prototype
    Alors la durée de la transition de phase (800 ms par défaut) et celle de l'avancée (400 ms par défaut) se changent sans nouvelle version

  @adr
  # Vérifié sur l'ADR du moteur de combat : il consigne chaque point demandé. Les chiffres
  # du téléphone du propriétaire y sont reportés avant le passage au statut « accepté ».
  Scénario: Les conclusions du prototype sont consignées
    Étant donné le prototype joué sur le téléphone du propriétaire
    Alors une décision d'architecture (ADR) consigne : la précision mesurée des fenêtres de timing sur le téléphone, la fluidité des animations, la réactivité des boutons, les durées retenues pour la transition de phase et l'avancée, et la décision de poursuivre ou d'ajuster
