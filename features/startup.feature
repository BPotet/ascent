# language: fr
Fonctionnalité: Démarrage de l'application
  Au démarrage, l'application ouvre sa base locale et la met au dernier schéma
  avant d'afficher l'écran d'accueil. Si la base locale ne peut pas être ouverte,
  rien n'est effacé et le joueur peut réessayer.

  Scénario: L'application ouvre sa base locale et affiche l'écran d'accueil
    Étant donné que la base locale peut être ouverte
    Quand l'application démarre
    Alors l'écran d'accueil s'affiche
    Et la base locale est au dernier schéma

  Scénario: La base locale ne peut pas être ouverte
    Étant donné que la base locale ne peut pas être ouverte
    Quand l'application démarre
    Alors un écran d'erreur propose « Réessayer »
    Quand la base locale redevient disponible et que le joueur touche « Réessayer »
    Alors l'écran d'accueil s'affiche
