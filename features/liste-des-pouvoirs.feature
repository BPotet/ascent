# language: fr
# Story #271 (épique #269) : les scénarios de la story, tels quels. Ils passent par l'écran de combat
# (`BattleScreen`), sur une vraie session de combat et l'horloge de combat manuelle ; Skia est
# simulé sous Jest. Les mots exacts que TalkBack lit (« replié, bouton », « menu, 3 éléments »)
# viennent de la plateforme : les étapes vérifient le rôle, le libellé et l'état, la phrase entière
# se vérifie sur l'APK.

Fonctionnalité: La liste des pouvoirs en combat

  Scénario: Deux touches en phase du héros (KB1)
    Étant donné l'Errante a 5 Élan et Pas de l'ombre, Entaille et Rafale comme pouvoirs équipés
    Quand c'est la phase du héros
    Alors la zone d'action n'a que deux touches : « Pouvoirs » à gauche et « Attaquer » à droite, la plus large
    Et « Pouvoirs » dit « 3 prêts sur 3 », sans icône de pouvoir
    Et le lecteur d'écran dit « Pouvoirs, 3 prêts sur 3, menu, replié, bouton »

  Scénario: Ouvrir la liste des pouvoirs (KB2)
    Étant donné c'est la phase du héros
    Quand le joueur touche « Pouvoirs »
    Alors la liste des pouvoirs monte au-dessus de la touche et le combat se voile
    Et elle a une ligne par pouvoir équipé, dans l'ordre de l'arbre
    Et chaque ligne montre l'icône, le nom en entier, le coût et le type du pouvoir, ses losanges d'Élan et son état en mot, ici « Prêt »
    Et le lecteur d'écran dit « Pouvoirs équipés, menu, 3 éléments » et le focus va sur la première ligne

  Scénario: Fermer la liste sans rien lancer
    Étant donné la liste des pouvoirs est ouverte
    Quand le joueur touche hors de la liste, retouche « Pouvoirs » ou fait le geste retour
    Alors la liste se ferme
    Et aucun pouvoir n'est lancé et l'Élan ne change pas
    Et le focus revient sur « Pouvoirs »

  Scénario: Un pouvoir trop cher (KB3)
    Étant donné l'Errante a 1 Élan
    Quand le joueur ouvre la liste des pouvoirs
    Alors Entaille dit « Prêt »
    Et Pas de l'ombre dit « Il manque 2 Élan » et Rafale « Il manque 1 Élan », hachurés, leurs losanges vides
    Quand le joueur touche la ligne de Rafale
    Alors rien n'est lancé et la liste reste ouverte

  Scénario: Un pouvoir attisé (KB4)
    Étant donné Représailles est attisé
    Quand le joueur ouvre la liste des pouvoirs
    Alors la ligne de Représailles est bordée de braise, avec la flamme, « Attisé · 2 → 1 Élan » et un seul losange couleur braise
    Et le lecteur d'écran dit « Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané »

  Scénario: Lancer un pouvoir instantané (KB5, KB6)
    Étant donné l'Errante a 5 Élan et la liste des pouvoirs ouverte
    Quand le joueur touche la ligne d'Entaille puis relâche le doigt dessus
    Alors Entaille est lancée et coûte son Élan
    Et la liste se ferme d'elle-même
    Et le mot de scène « Entaille » s'affiche et la zone d'action dit « Toujours à toi : attaque. »
    Et « Pouvoirs » dit « 1 prêt sur 3 »
    Et le focus va sur « Attaquer »

  Scénario: Relâcher hors de la ligne ne lance rien
    Étant donné la liste des pouvoirs est ouverte
    Quand le joueur touche la ligne d'Entaille puis relâche le doigt hors de la ligne
    Alors Entaille n'est pas lancée

  Scénario: Rouvrir la liste après un instantané (KB7)
    Étant donné l'Errante vient de lancer Entaille, instantané, dans cette phase du héros
    Quand le joueur rouvre la liste des pouvoirs
    Alors Entaille dit « Actif »
    Et Pas de l'ombre dit « Instantané déjà lancé »
    Et Rafale, une frappe de pouvoir, dit « Prêt »

  Scénario: Lancer une frappe de pouvoir (KB8, KB9)
    Étant donné l'Errante a 3 Élan et la liste des pouvoirs ouverte
    Quand le joueur touche la ligne de Rafale puis relâche le doigt dessus
    Alors la liste se ferme
    Et « Frapper » prend toute la rangée, avec ses 4 repères et « Rafale · 4 coups », comme aujourd'hui
    Et les touches « Pouvoirs » et « Attaquer » reviennent après le dernier coup

  Scénario: Pouvoir actif et pouvoir déjà utilisé (KB10)
    Étant donné le Rempart de la Sentinelle est actif et Tenir bon a été utilisé dans ce combat
    Quand le joueur ouvre la liste des pouvoirs
    Alors le Rempart dit « Actif », avec la coche d'or
    Et Tenir bon dit « Utilisé ce combat »
    Et l'étiquette du Rempart reste sous les PV, liste ouverte ou fermée

  Scénario: Lire l'effet d'un pouvoir sans le lancer (KB11)
    Étant donné la liste des pouvoirs est ouverte
    Quand le joueur maintient la ligne d'Entaille 400 ms
    Alors la bulle de l'effet d'Entaille s'ouvre au-dessus de la liste
    Quand il relâche le doigt
    Alors rien n'est lancé et la liste reste ouverte
    Et le lecteur d'écran propose l'action « Voir l'effet » sur chaque ligne

  Scénario: La transition de phase ferme la liste
    Étant donné la liste des pouvoirs est ouverte
    Quand la transition de phase commence
    Alors la liste se ferme d'elle-même, sans rien lancer

  Scénario: La phase ennemie, inchangée (KB12)
    Étant donné c'est la phase ennemie
    Alors la zone d'action montre Esquive et Parade, exactement comme aujourd'hui, à la place de « Pouvoirs » et « Attaquer »
    Et les charges actives restent visibles sous les PV

  Scénario: Aucun pouvoir prêt
    Étant donné aucun pouvoir équipé de l'Errante n'est prêt
    Alors « Pouvoirs » dit « 0 prêt sur 3 » et peut toujours être touché
    Quand le joueur touche « Pouvoirs »
    Alors la liste s'ouvre et chaque ligne dit en mot pourquoi son pouvoir est indisponible

  Scénario: Un seul pouvoir équipé
    Étant donné une ascension où la Sentinelle n'a que le Rempart comme pouvoir équipé
    Quand c'est la phase du héros
    Alors « Pouvoirs » dit « 1 prêt sur 1 »
    Et la liste des pouvoirs n'a qu'une ligne

  Scénario: Mouvement réduit
    Étant donné le mouvement réduit est actif
    Quand le joueur ouvre la liste des pouvoirs puis touche une ligne
    Alors la liste apparaît en fondu au lieu de monter
    Et la ligne touchée s'enfonce sans rebond et la flamme ne vacille pas
    Et les durées ne changent pas

  Scénario: La bulle des pouvoirs parle de la liste
    Étant donné c'est le premier combat avec 2 pouvoirs équipés ou plus
    Quand la bulle d'aide « Tes pouvoirs » s'ouvre
    Alors son texte parle de la touche « Pouvoirs » et des lignes de la liste, et plus des touches de pouvoir
