# language: fr
Fonctionnalité: Le menu des pouvoirs au pied de la tour
  Story #270 (épique #269) : le joueur prépare les pouvoirs équipés de ses deux héros dans le menu
  des pouvoirs (`PowersMenu`), ouvert par la carte « Pouvoirs équipés » du pied de la tour. Le choix
  est enregistré dès « Valider » ; le Choix du héros ne fait plus que le résumer.

  # Les scénarios `@session` passent par une vraie session du camp et d'ascension sur un stockage en
  # mémoire. Les scénarios `@ui` passent en plus par les écrans (pied de la tour, menu des pouvoirs,
  # Choix du héros, arbre de pouvoirs).

  # --- La carte « Pouvoirs équipés » du pied de la tour (T1, T4 à T8) ---

  @ui
  Scénario: La carte montre ce que chaque héros emporte (T1)
    Étant donné aucune ascension n'est en cours
    Et la Sentinelle a pour pouvoirs équipés Rempart, Représailles et Tenir bon
    Et l'Errante a pour pouvoirs équipés Pas de l'ombre, Entaille et Brume
    Quand le joueur ouvre le pied de la tour
    Alors sous la jauge, la carte « Pouvoirs équipés » montre une ligne par héros, avec son portrait, les icônes de ses pouvoirs équipés dans l'ordre de l'arbre et « 3 sur 3 »
    Et la carte porte le lien « Changer »
    Quand le joueur touche la carte
    Alors le menu des pouvoirs s'ouvre

  @ui
  Scénario: La carte montre la présélection quand rien n'a été validé
    Étant donné la Sentinelle a 4 pouvoirs possédés et aucune mémoire des pouvoirs équipés
    Quand le joueur ouvre le pied de la tour
    Alors la ligne de la Sentinelle montre la présélection : le Rempart, puis les pouvoirs suivants dans l'ordre de l'arbre, 3 au plus

  @ui
  Scénario: Un pouvoir débloqué attend une place (T4)
    Étant donné les 3 places de l'Errante sont prises
    Et le joueur vient de débloquer Rafale au camp
    Quand il revient au pied de la tour
    Alors la carte dit en or que Rafale attend une place, avec « nouveau »
    Et le lecteur d'écran ajoute « Nouveau : Rafale attend une place »
    Quand le joueur ouvre le menu des pouvoirs puis revient au pied de la tour
    Alors la carte ne dit plus « nouveau »

  @ui
  Scénario: Pendant une ascension, la carte montre le héros parti (T6)
    Étant donné une ascension en cours avec la Sentinelle, Représailles attisé
    Quand le joueur ouvre le pied de la tour
    Alors la carte ne montre que la Sentinelle, ses pouvoirs fixés, un cadenas et le lien « Voir »
    Et Représailles garde sa bordure de braise

  @ui
  Scénario: Le chargement (T7)
    Étant donné le camp n'est pas encore lu
    Quand le joueur ouvre le pied de la tour
    Alors la carte est un bloc gris, comme la jauge
    Et « Commencer l'ascension » attend, comme aujourd'hui

  @ui
  Scénario: Première visite après la mise à jour (T8)
    Étant donné le joueur avait lancé sa dernière ascension avec l'Errante équipée de Entaille, Rafale et Brume
    Quand il ouvre le pied de la tour pour la première fois après la mise à jour
    Alors la carte porte « nouveau »
    Et la ligne de l'Errante montre Entaille, Rafale et Brume : son choix n'est pas perdu
    Quand il revient plus tard au pied de la tour
    Alors la carte ne porte plus « nouveau »

  # --- Le menu des pouvoirs (M1 à M12) ---

  @ui
  Scénario: Le menu présente les deux héros (M1)
    Étant donné l'Errante a 5 pouvoirs possédés, dont Pas de l'ombre, Entaille et Brume équipés
    Quand le joueur ouvre le menu des pouvoirs
    Alors l'écran est titré « Pouvoirs équipés », sous-titré « Pour ta prochaine ascension »
    Et les deux héros sont en onglets, chacun avec son compte « 3/3 »
    Et l'onglet de l'Errante liste ses 5 pouvoirs dans l'ordre de l'arbre, chacun avec son icône, son nom, son coût et son type
    Et toute la ligne d'un pouvoir coche ou décoche

  @ui
  Scénario: Changer de sélection puis valider (parcours A, T5)
    Étant donné l'Errante a pour pouvoirs équipés Pas de l'ombre, Entaille et Brume, et possède Rafale
    Quand le joueur ouvre le menu des pouvoirs, décoche Pas de l'ombre, coche Rafale et touche « Valider »
    Alors il revient au pied de la tour
    Et la ligne de l'Errante montre Entaille, Rafale et Brume, la case de Rafale bordée d'or
    Et le lecteur d'écran annonce « 3 pouvoirs équipés pour l'Errante : Entaille, Rafale, Brume. »
    Et le focus revient sur la carte

  @ui
  Scénario: Le choix est enregistré dès « Valider »
    Étant donné le joueur a équipé l'Errante de Entaille, Rafale et Brume et touché « Valider »
    Quand il ferme l'application puis la rouvre, sans avoir lancé d'ascension
    Alors le pied de la tour et le menu des pouvoirs montrent toujours Entaille, Rafale et Brume pour l'Errante
    Et au Choix du héros, l'Errante est présélectionnée avec Entaille, Rafale et Brume

  @ui
  Scénario: Le retour annule
    Étant donné le joueur a décoché Pas de l'ombre et coché Rafale dans le menu
    Quand il touche le retour sans « Valider »
    Alors il revient au pied de la tour
    Et les pouvoirs équipés de l'Errante n'ont pas changé

  @ui
  Scénario: Un seul « Valider » pour les deux héros
    Étant donné le joueur a changé la sélection de la Sentinelle puis celle de l'Errante, en passant d'un onglet à l'autre
    Quand il touche « Valider »
    Alors les deux sélections sont enregistrées

  @ui
  Scénario: Un 4e pouvoir est refusé (M2)
    Étant donné l'Errante a 3 pouvoirs cochés
    Quand le joueur touche la ligne de Rafale, non cochée
    Alors rien ne se coche et rien ne se décoche
    Et le menu dit « 3 sur 3 : retire d'abord un pouvoir pour équiper Rafale. »
    Et le téléphone vibre brièvement

  @ui
  Scénario: « Valider » impossible sans min(3, possédés) pouvoirs (M3)
    Étant donné l'Errante a 5 pouvoirs possédés
    Quand le joueur décoche Pas de l'ombre
    Alors l'onglet de l'Errante dit « 2/3 », en or
    Et le bouton dit « Choisis encore 1 pouvoir » et ne peut pas être touché

  @ui
  Scénario: « Valider » attend aussi l'autre héros
    Étant donné la sélection de l'Errante est complète
    Et celle de la Sentinelle ne compte que 2 pouvoirs sur 3
    Quand le joueur regarde l'onglet de l'Errante
    Alors le bouton dit qu'il faut encore choisir 1 pouvoir pour la Sentinelle et ne peut pas être touché

  @session
  Scénario: Le pouvoir de base se laisse de côté
    Étant donné l'Errante a 5 pouvoirs possédés
    Quand le joueur décoche Pas de l'ombre, coche Rafale et touche « Valider »
    Alors Pas de l'ombre n'est plus équipé et reste possédé

  @ui
  Scénario: 3 pouvoirs ou moins : rien à choisir (M4)
    Étant donné la Sentinelle n'a que Rempart et Représailles
    Quand le joueur ouvre son onglet
    Alors ses deux pouvoirs sont marqués « Équipé », en vert, sans case à cocher
    Et une ligne dit qu'ils sont équipés d'office et qu'à partir de 4, il choisit ses 3
    Et si l'Errante a aussi 3 pouvoirs ou moins, le menu propose « Le camp » au lieu de « Valider »

  @ui
  Scénario: Le pouvoir attisé et les Serments (M5)
    Étant donné Représailles, équipé, est attisé par un Serment tenu hier
    Et Tenir bon, équipé, a un Serment qui n'a pas été tenu hier
    Quand le joueur ouvre l'onglet de la Sentinelle
    Alors Représailles est bordé de braise, avec la flamme, « Attisé · 2 → 1 Élan » et la ligne de son Serment
    Et Tenir bon a une ligne neutre qui dit ce qu'il faut faire pour demain

  @ui
  Scénario: Un pouvoir sous Serment décoché n'est pas attisé (M6)
    Étant donné Représailles a un Serment tenu hier
    Quand le joueur décoche Représailles
    Alors Représailles n'est plus marqué « Attisé »
    Et sa ligne dit en bleu qu'il n'est pas attisé tant qu'il n'est pas équipé

  @ui
  Scénario: L'enregistrement échoue (M7)
    Étant donné l'enregistrement du choix va échouer
    Quand le joueur touche « Valider »
    Alors un bandeau dit « Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie. »
    Et le choix reste affiché tel quel
    Et le bouton devient « Réessayer »
    Et le focus va sur le bandeau
    Quand l'enregistrement réussit au toucher de « Réessayer »
    Alors le joueur revient au pied de la tour, la carte à jour

  @ui
  Scénario: Un pouvoir débloqué s'équipe seul s'il reste une place (M8)
    Étant donné la Sentinelle n'avait que Rempart et Représailles
    Et le joueur vient de débloquer Tenir bon au camp
    Quand il ouvre le menu des pouvoirs
    Alors Tenir bon est équipé, sa ligne bordée d'or avec « nouveau »
    Et un bandeau dit « Tenir bon s'est équipé tout seul : il restait une place. »

  @ui
  Scénario: Un pouvoir débloqué sans place attend le joueur (M9)
    Étant donné les 3 places de l'Errante sont prises
    Et le joueur vient de débloquer Rafale
    Quand il ouvre l'onglet de l'Errante
    Alors la ligne de Rafale porte « nouveau », non cochée
    Et un bandeau dit qu'il faut retirer un pouvoir pour lui faire une place
    Et aucun pouvoir équipé n'a changé

  @ui
  Scénario: Pendant une ascension, le menu est en lecture seule (M10)
    Étant donné une ascension en cours avec la Sentinelle
    Quand le joueur ouvre le menu des pouvoirs depuis la carte
    Alors le sous-titre dit « Ascension en cours »
    Et un bandeau dit que la Sentinelle garde ces pouvoirs jusqu'à la fin de l'ascension
    Et ses pouvoirs sont marqués « Fixé », sans case à cocher
    Et aucun pouvoir ne peut être coché ni décoché, dans aucun onglet

  @ui
  Scénario: Le chargement du menu (M11)
    Étant donné le camp n'est pas encore lu
    Quand le menu des pouvoirs s'ouvre
    Alors des blocs gris remplacent les lignes
    Et « Valider » attend

  @ui
  Scénario: Première ouverture du menu (M12)
    Étant donné le joueur n'a jamais ouvert le menu des pouvoirs
    Quand il l'ouvre
    Alors un bandeau dit que ses pouvoirs se préparent désormais ici, avant chaque ascension, et qu'ils sont gardés
    Et ce bandeau ne revient pas aux ouvertures suivantes

  # --- Le Choix du héros (H1 à H4, M13) ---

  @ui
  Scénario: Le Choix du héros résume les pouvoirs équipés (H1)
    Étant donné la Sentinelle a 3 pouvoirs possédés
    Quand le joueur ouvre le Choix du héros
    Alors la carte de la Sentinelle montre la rangée « Pouvoirs équipés · 3 sur 3 », en lecture seule
    Et il n'y a ni bouton « Changer les pouvoirs » ni panneau des pouvoirs équipés

  @ui
  Scénario: Le lien discret « Changer les pouvoirs » (H2, M13)
    Étant donné l'Errante a 4 pouvoirs possédés ou plus
    Quand le joueur choisit l'Errante au Choix du héros
    Alors un lien discret « Changer les pouvoirs » est proposé
    Quand il le touche
    Alors le menu des pouvoirs s'ouvre sur l'onglet de l'Errante, avec le retour « Retour au Choix du héros »
    Quand il change la sélection et touche « Valider »
    Alors il revient au Choix du héros, qui montre la nouvelle rangée

  @ui
  Scénario: Pas de lien avec 3 pouvoirs ou moins
    Étant donné la Sentinelle a 3 pouvoirs possédés ou moins
    Quand le joueur choisit la Sentinelle au Choix du héros
    Alors le lien « Changer les pouvoirs » n'est pas proposé

  @ui
  Scénario: Le pouvoir attisé au Choix du héros, inchangé (H3)
    Étant donné Représailles, équipé, est attisé
    Quand le joueur ouvre le Choix du héros
    Alors la case de Représailles est en braise, avec « 2 → 1 Élan » et la ligne du Serment, comme aujourd'hui

  @session
  Scénario: L'ascension part avec le choix validé
    Étant donné le joueur a validé Entaille, Rafale et Brume pour l'Errante dans le menu
    Quand il commence l'ascension et continue avec l'Errante
    Alors ses pouvoirs équipés pour l'ascension sont Entaille, Rafale et Brume
    Et ils ne changent plus jusqu'à la fin de l'ascension, pause et reprise comprises

  @ui
  Scénario: L'échec au lancement, inchangé (H4)
    Étant donné l'enregistrement de l'ascension échoue au lancement
    Quand le joueur continue avec l'Errante
    Alors le message « Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie. » s'affiche
    Et « Réessayer » relance, le choix gardé

  # --- Le Camp (D1, D2) ---

  @ui
  Scénario: Le bandeau de l'arbre envoie au menu (D1)
    Étant donné les 3 places de l'Errante sont prises
    Quand le joueur débloque Rafale dans son arbre de pouvoirs
    Alors le bandeau dit « Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour. »
    Et il porte le bouton « Choisir mes pouvoirs »
    Quand le joueur touche « Choisir mes pouvoirs »
    Alors le menu des pouvoirs s'ouvre sur l'onglet de l'Errante
    Et son retour ramène au pied de la tour

  @ui
  Scénario: La fiche d'un pouvoir débloqué non équipé (D2)
    Étant donné Rafale est débloqué mais pas équipé
    Quand le joueur ouvre sa fiche dans l'arbre
    Alors elle dit « Pas équipé : choisis-le au pied de la tour, dans « Pouvoirs équipés ». »
