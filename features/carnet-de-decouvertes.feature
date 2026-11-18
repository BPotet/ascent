# language: fr
Fonctionnalité: Le carnet de découvertes et son Bestiaire
  Story #282 (épique #278), story socle : le carnet de découvertes, ouvert depuis le Pied de la tour,
  dont le Bestiaire montre, palier par palier, chaque ennemi du jeu (Élites et boss compris) en
  « ??? », rencontré ou vaincu, et se remplit tout seul pendant les ascensions (ADR 0030).

  # Les scénarios `@domain` éprouvent les règles du domaine (les découvertes d'une mise à jour du
  # combat, le carnet, le Bestiaire et son catalogue) ; les scénarios `@session` passent par une
  # vraie session d'ascension et une vraie session du carnet sur un Stockage clé-valeur en mémoire
  # (« fermeture forcée » : de nouvelles sessions sur le même stockage) ; les scénarios `@ui` passent
  # aussi par les vrais écrans (le Pied de la tour, le carnet, l'ascension, le camp, le combat).

  # --- Accès ---

  @ui
  Scénario: La touche « Le carnet » est au Pied de la tour, à côté du camp
    Étant donné le Pied de la tour, sans ascension en cours
    Alors une touche « Le carnet » est sur la même ligne que « Le camp », sous « Commencer l'ascension »
    Quand le joueur touche « Le carnet »
    Alors le carnet s'ouvre sur le Bestiaire

  @ui
  Scénario: Le carnet s'ouvre aussi pendant une ascension en pause
    Étant donné une ascension en pause, au Pied de la tour
    Alors « Le carnet » est sur la même ligne que « Le camp », sous « Reprendre l'ascension »
    Quand le joueur ouvre le carnet puis en sort
    Alors il revient au Pied de la tour et l'ascension est inchangée

  @ui
  Scénario: Le carnet ne s'ouvre que depuis le Pied de la tour
    Étant donné le Camp, l'écran de combat ou un écran de l'ascension
    Alors aucun lien n'y ouvre le carnet

  # --- Démarrage ---

  @ui
  Scénario: Le carnet démarre vide à la mise à jour
    Étant donné un joueur qui a déjà fait des ascensions avant la mise à jour
    Et aucune ascension en cours
    Quand il ouvre le carnet pour la première fois
    Alors toutes les entrées du Bestiaire sont « ??? »
    Et le bandeau de première utilisation explique comment le carnet se remplit
    Et les ascensions passées ne sont pas relues

  @session
  Scénario: L'ascension en cours à la mise à jour est prise en compte à sa reprise
    Étant donné un combat en cours à la mise à jour, une Goule à 0 PV et un Spectre debout en première ligne, un Nécromancien en réserve
    Quand le combat reprend
    Alors la Goule est vaincue, le Spectre est rencontré et le Nécromancien reste « ??? »

  # --- Rencontré ---

  @domain
  Scénario: Les ennemis de la première ligne sont rencontrés au début du combat
    Étant donné un carnet vide et un groupe Goule, Goule, Spectre avec un Nécromancien en réserve
    Quand le combat commence
    Alors la Goule et le Spectre sont rencontrés, en une seule entrée chacun
    Et le Nécromancien reste « ??? »

  @domain
  Scénario: Un ennemi de la réserve resté en réserve n'est pas rencontré
    Étant donné le combat précédent
    Quand le héros tombe avant tout Renfort
    Alors le Nécromancien reste « ??? »

  @domain
  Scénario: Un Renfort, un Invoqué ou un Squelette exhumé est rencontré à son entrée
    Étant donné un combat en cours
    Quand un ennemi entre par un Renfort, par une Invocation ou par une Exhumation
    Alors il est rencontré
    Et un Squelette exhumé par le Fossoyeur compte au palier 1, une Phalénide invoquée au palier 2

  @domain
  Scénario: Une Invocation annoncée qui n'entre jamais ne rend personne rencontré
    Étant donné la Reine des phalènes en phase 2, son Invocation annoncée
    Quand la Reine tombe avant l'entrée des Phalénides
    Alors la Reine est vaincue et la Phalénide ne change pas d'état

  @session
  Scénario: Une porte ne rend personne rencontré
    Étant donné une porte Combat ou Élite proposée
    Alors aucun ennemi n'est rencontré avant le début de son combat

  # --- Vaincu ---

  @domain
  Scénario: Un ennemi tombé pour de bon est vaincu, même si le héros tombe ensuite
    Étant donné un combat avec deux Goules et un Spectre
    Quand une Goule tombe, puis le héros tombe
    Alors la Goule est vaincue et le Spectre est rencontré

  @domain
  Scénario: Un ennemi qui se relève seul n'est vaincu qu'à sa chute pour de bon
    Étant donné un Squelette en première ligne
    Quand il tombe et se relève seul
    Alors il est rencontré, pas vaincu
    Quand il retombe pour de bon
    Alors il est vaincu

  @domain
  Scénario: Un ennemi relevé par un allié est vaincu dès sa première chute
    Étant donné une Goule tombée puis relevée par le Nécromancien
    Quand le héros tombe
    Alors la Goule est vaincue

  @domain
  Scénario: Les Invoqués qui tombent avec celui qui les a appelés sont vaincus
    Étant donné deux Phalénides invoquées, entrées en première ligne
    Quand la Reine des phalènes tombe et qu'elles tombent avec elle
    Alors la Reine et la Phalénide sont vaincues

  @domain
  Scénario: Une Élite escortée est vaincue à sa chute, même si l'escorte gagne
    Étant donné une Élite escortée au palier 2, l'Épouvantail et un Embrasé
    Quand l'Épouvantail tombe pour de bon, puis le héros tombe
    Alors l'Épouvantail est vaincu et l'Embrasé est rencontré

  @domain
  Scénario: Un ennemi maudit a la même entrée que l'ennemi ordinaire
    Étant donné un Embrasé maudit
    Quand il tombe pour de bon
    Alors l'entrée de l'Embrasé est vaincue, sans entrée « maudit » à part

  @session
  Scénario: Un boss quitté en phase 2 reste rencontré
    Étant donné un boss en phase 2
    Quand le héros tombe, ou que le joueur abandonne l'ascension
    Alors le boss est rencontré, pas vaincu

  @session
  Scénario: Après une victoire, tout ennemi entré est vaincu
    Étant donné un combat ordinaire gagné
    Alors chaque ennemi entré dans ce combat est vaincu et aucun n'est seulement rencontré

  # --- Règles générales ---

  @domain
  Scénario: Un état ne descend jamais
    Étant donné une Goule vaincue
    Quand une Goule est rencontrée dans un autre combat, puis le héros tombe
    Alors la Goule reste vaincue, sans marque « nouveau »

  @session
  Scénario: Une découverte n'est jamais perdue
    Étant donné une Goule vaincue pendant un combat
    Quand l'app est fermée de force avant la fin du combat, puis rouverte
    Alors la Goule est vaincue
    Et une chute, un abandon ou une mise à jour de l'app ne l'efface pas non plus

  @session
  Scénario: Une même découverte enregistrée deux fois ne compte qu'une fois
    Étant donné une Goule vaincue dans un combat mis en pause
    Quand le combat reprend et que la Goule est relue à 0 PV
    Alors la Goule a un seul état et une seule marque « nouveau »

  @session
  Scénario: Le carnet ne change rien au jeu
    Étant donné deux ascensions jouées avec la même graine, l'une avec un carnet vide, l'autre avec un carnet plein
    Alors les tirages, les combats et le butin sont identiques
    Et aucune découverte ne rapporte d'Éclat, d'Or, d'Xp ou de déblocage

  # --- Bestiaire et compteurs ---

  @ui
  Scénario: Le Bestiaire montre un palier à la fois
    Étant donné le carnet ouvert
    Alors le Bestiaire est au palier de l'ascension en cours ou de la dernière ascension, au palier 1 s'il n'y en a pas
    Et une puce par palier donne ses pages remplies : « Palier 1 · 9/12 »
    Et le palier montre ses sections Ennemis, Élites et Boss, chacune avec son compte

  @domain
  Scénario: Les compteurs comptent les ennemis vaincus
    Étant donné 9 ennemis du palier 1 vaincus et 2 rencontrés, sur 12 entrées
    Alors le palier 1 compte 9 pages remplies
    Et les 2 rencontrés ne comptent pas dans le compte
    Et le total du Bestiaire compte les ennemis vaincus de tous les paliers

  @domain
  Scénario: Le carnet compte exactement les ennemis du jeu
    Étant donné la version installée, avec les 6 ennemis de #246
    Alors le Bestiaire compte 37 entrées : 12 au palier 1, 12 au palier 2, 13 au palier 3
    Et chaque ennemi du jeu y est une seule fois : 22 ennemis, 9 Élites, 6 boss

  @domain
  Scénario: Un ennemi ajouté par une mise à jour arrive en « ??? », sans « nouveau »
    # Joué sur un catalogue du Bestiaire fictif : le vrai contenu contient déjà tous les ennemis
    Étant donné un catalogue du Bestiaire fictif dont le palier 2 compte 10 entrées
    Et un carnet dont les 10 entrées du palier 2 sont vaincues
    Quand une mise à jour ajoute deux ennemis au palier 2 de ce catalogue
    Alors ils sont « ??? », sans marque « nouveau »
    Et le palier 2 n'est plus complet : 10/12

  @domain
  Scénario: Un ennemi retiré du jeu disparaît du carnet sans perdre son état
    Étant donné un ennemi vaincu qui est retiré du jeu par une mise à jour
    Alors son entrée n'est plus montrée ni comptée
    Et s'il revient dans le jeu, il est de nouveau vaincu

  @ui
  Scénario: Une entrée « ??? » n'est pas un bouton
    Étant donné une entrée « ??? »
    Alors elle ne se touche pas et le lecteur d'écran la lit « Élite inconnue, Palier 2 »

  @ui
  Scénario: Un palier complet le dit
    Étant donné tous les ennemis du palier 1 vaincus
    Alors la puce et le cadre du palier passent à l'or avec « Toutes les pages du palier sont remplies. »
    Et rien n'est gagné

  # --- Nouveau ---

  @ui
  Scénario: Une entrée qui monte est marquée nouvelle jusqu'à la sortie du carnet
    Étant donné l'Embrasé vaincu et la Phalénide rencontrée depuis la dernière sortie du carnet
    Alors la touche « Le carnet » porte le compteur 2
    Quand le joueur ouvre le carnet
    Alors l'Embrasé et la Phalénide portent « nouveau » et la puce du palier 2 son losange d'or
    Quand il sort du carnet
    Alors les marques « nouveau » sont effacées et la touche « Le carnet » n'a plus de compteur

  @session
  Scénario: Une entrée montée deux fois sans ouverture du carnet ne compte qu'une fois
    Étant donné un Spectre rencontré dans un combat perdu, puis vaincu dans l'ascension suivante
    Quand le joueur ouvre le carnet
    Alors le Spectre porte une seule marque « nouveau » et compte 1 au compteur

  @ui
  Scénario: Sans nouveauté, pas de compteur
    Étant donné aucune entrée nouvelle
    Alors la touche « Le carnet » n'a pas de compteur et le lecteur d'écran la lit « Le carnet, bouton »

  # --- Ligne du carnet après un combat ---

  @ui
  Scénario: Une page remplie pendant un combat gagné est annoncée après le combat
    Étant donné un Embrasé jamais vaincu
    Quand le joueur gagne le combat où l'Embrasé tombe
    Alors l'écran qui suit le combat montre, sous « Étage franchi », la ligne « Nouvelle page : Embrasé »
    Et le lecteur d'écran l'annonce poliment
    Et rien ne s'affiche pendant les manches

  @ui
  Scénario: Plusieurs pages remplies pendant un combat
    Étant donné quatre ennemis jamais vaincus qui tombent dans un même combat gagné
    Alors une seule ligne donne leur nombre puis les noms dans l'ordre de leur chute
    Et au-delà de 3 noms, elle finit par « … et n autres »

  @session
  Scénario: Un ennemi déjà vaincu n'est jamais annoncé
    Étant donné une Goule déjà vaincue
    Quand le joueur gagne un combat où seules des Goules tombent
    Alors aucune ligne du carnet ne s'affiche

  # --- États de l'écran ---

  @ui
  Scénario: Le carnet ne peut pas être lu
    Étant donné une lecture du carnet qui échoue
    Alors l'écran dit « Le carnet n'a pas pu s'ouvrir. Tes découvertes ne sont pas perdues. » et propose de réessayer
    Et aucune découverte n'est effacée

  @ui
  Scénario: Texte agrandi
    Étant donné la police du système agrandie
    Alors la grille du Bestiaire passe à 2 colonnes, sans défilement horizontal à 360 dp
