# language: fr
# Story #73 (épique #71) : les scénarios de la story, tels quels, à travers les écrans (@ui).

Fonctionnalité: La Semaine, le Mois et les panneaux d'habitude en pixel art

  Contexte:
    Étant donné nous sommes le mercredi 21 octobre
    Et le joueur a 5 habitudes

  # --- Identité pixel art ---

  @ui
  Scénario: L'identité pixel art habille ces écrans
    Quand le joueur ouvre la Vue Semaine, la Vue Mois, le Détail du jour ou un panneau d'habitude
    Alors l'écran s'affiche dans l'identité pixel art : palette d'art, cadres crantés, boutons, cases et icônes en pixels
    Et les titres et chiffres de jeu sont dans la police pixel, à 18 px au moins
    Et les noms d'habitude, libellés de champ, messages et erreurs sont dans la police de texte

  @ui
  Scénario: Le texte suit la taille de texte du téléphone (limite)
    Étant donné la taille du texte du téléphone est réglée à 200 %
    Quand le joueur ouvre la Vue Semaine ou un panneau d'habitude
    Alors tous les textes grossissent et un titre en police pixel passe à la ligne au lieu d'être coupé

  # --- Vue Semaine ---

  @ui
  Scénario: La semaine en cours
    Quand le joueur ouvre la Vue Semaine
    Alors chaque habitude a une carte avec ses 7 cases et la puce de progression « 2/3 cette semaine »
    Et chaque case montre son état du suivi par un signe en plus de la couleur : coche (fait), croix (pas fait), point, tiret
    Et la case d'aujourd'hui a le cadre d'or « à faire »
    Et une case corrigée porte la marque « corrigé », visible sans la couleur
    Et chaque case touchable fait 48 × 48 dp
    Et le lecteur d'écran lit la même annonce qu'avant cette story

  @ui
  Scénario: Correction qui atteint l'objectif
    Étant donné « Courir 5 km » a 2 « fait » cette semaine pour un objectif de la semaine de 3
    Quand le joueur corrige mercredi de « Courir 5 km » à « fait »
    Alors la case joue le même retour que dans la Vue Journée : coche, étincelle, vibration, « +XP » qui s'envole
    Et la puce passe à l'or « 3/3 · Objectif atteint », avec le message et la prime d'objectif
    Et le lecteur d'écran annonce le gain et l'objectif atteint

  @ui
  Scénario: Erreur d'enregistrement d'une correction
    Étant donné l'enregistrement d'une correction échoue
    Quand le joueur corrige une case
    Alors la case et l'expérience reviennent comme avant
    Et le message « La correction n’a pas été enregistrée. » propose « Réessayer »

  @ui
  Scénario: Chargement de la Vue Semaine
    Quand la Vue Semaine charge
    Alors un squelette au pixel d'art réserve la place des cartes et des cases

  @ui
  Scénario: Vue Semaine vide
    Étant donné le joueur n'a aucune habitude
    Quand il ouvre la Vue Semaine
    Alors le personnage, le message et « Ajouter une habitude » s'affichent

  # --- Vue Mois et Détail du jour ---

  @ui
  Scénario: Le mois en cours
    Quand le joueur ouvre la Vue Mois
    Alors chaque jour suivi montre le compteur « habitudes faites / habitudes attendues » et un point de 2 pixels d'art par habitude attendue
    Et un jour où toutes les habitudes attendues sont faites a un fond vert et un signe qui ne dépend pas de la couleur
    Et aujourd'hui a le cadre d'or, un jour corrigé porte la marque « corrigé »
    Et chaque jour touchable fait au moins 48 dp de côté

  @ui
  Scénario: Objectifs par semaine
    Quand le joueur fait défiler la Vue Mois sous la grille
    Alors chaque ligne des objectifs par semaine s'affiche en pixel art, avec le drapeau d'or et ses mots quand tous les objectifs sont atteints
    Et toucher une ligne ouvre toujours la Vue Semaine sur cette semaine

  @ui
  Scénario: Détail du jour
    Quand le joueur touche le dimanche 18 dans la Vue Mois
    Alors le Détail du jour s'ouvre en panneau, avec les lignes de la Journée en pixel art
    Et une correction d'un tap joue le même retour de jeu que dans la Vue Semaine

  @ui
  Scénario: Erreur de lecture de la Vue Mois
    Étant donné le mois ne peut pas être lu
    Quand le joueur ouvre la Vue Mois
    Alors l'emblème d'alerte, le message en police de texte et « Réessayer » s'affichent

  # --- Panneaux d'habitude ---

  @ui
  Scénario: Nouvelle habitude, valeurs par défaut
    Quand le joueur ouvre le panneau « Nouvelle habitude »
    Alors le champ du nom est vide et prêt à la saisie
    Et la difficulté Moyenne et l'objectif hebdomadaire 7 sont déjà choisis
    Et le choix actif se reconnaît par un cadre d'or, une coche et un texte en gras, pas seulement par la couleur

  @ui
  Scénario: Nouvelle habitude créée
    Quand le joueur saisit « Méditer 10 minutes », choisit Facile et 3, puis « Créer l'habitude »
    Alors il revient sur la Vue Journée, la ligne créée a un cadre d'or
    Et le message « Habitude créée » s'affiche

  @ui
  Scénario: Nom en doublon (erreur)
    Étant donné l'habitude « Courir 5 km » existe
    Quand le joueur saisit « courir 5 km » dans le panneau « Nouvelle habitude »
    Alors le champ a un cadre rouge, une icône et le message d'erreur actuel
    Et le bouton « Créer l'habitude » reste indisponible, hachuré

  @ui
  Scénario: Erreur d'enregistrement d'une nouvelle habitude
    Étant donné l'enregistrement d'une habitude échoue
    Quand le joueur touche « Créer l'habitude »
    Alors la saisie et les réglages sont conservés et le joueur peut réessayer

  @ui
  Scénario: Modifier l'habitude
    Quand le joueur ouvre « Modifier l'habitude » depuis « ⋯ » dans la Vue Journée ou depuis le nom dans la Vue Semaine
    Alors le nom et les réglages sont préremplis, « Enregistrer » est indisponible tant que rien ne change
    Et « Supprimer l'habitude » reste visible
    Quand le joueur passe de Moyenne à Difficile
    Alors le message d'information actuel, en police de texte, dit ce qui change
    Quand il touche « Enregistrer »
    Alors « Habitude modifiée · +20 XP » s'affiche, avec la pastille de l'en-tête

  @ui
  Scénario: Confirmation de suppression
    Quand le joueur touche « Supprimer l'habitude »
    Alors un dialogue en cadre relevé annonce l'expérience retirée, comme aujourd'hui
    Et « Supprimer » est en rouge d'erreur avec son libellé, « Annuler » à gauche
    Quand le joueur touche « Annuler »
    Alors rien n'est supprimé

  # --- Mouvement réduit et suivi ---

  @ui
  Scénario: Mouvement réduit
    Étant donné le réglage « mouvement réduit » du téléphone est activé
    Quand le joueur corrige une case qui atteint l'objectif de la semaine
    Alors aucun envol, étincelle ni rebond ne s'affiche, les états finaux s'affichent tout de suite
    Et les vibrations et les annonces au lecteur d'écran restent
    Et les squelettes de chargement ne clignotent pas

  @ui
  Scénario: Le fonctionnement du suivi ne change pas
    Quand le joueur corrige, crée, modifie ou supprime une habitude
    Alors l'expérience, les corrections, les objectifs et les compteurs suivent exactement les règles actuelles
