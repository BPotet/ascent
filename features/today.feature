# language: fr
Fonctionnalité: Connaître aujourd'hui selon le téléphone
  Pour rattacher chaque suivi au bon jour, l'application prend la date
  du calendrier local du téléphone au moment de l'action.

  Scénario: Aujourd'hui est la date locale du téléphone
    Étant donné que le téléphone indique le 14 octobre 2026 à 23:59
    Quand l'application demande quel jour on est
    Alors elle obtient le mercredi 14 octobre 2026

  Scénario: Le jour change à minuit, heure du téléphone
    Étant donné que le téléphone indique le 15 octobre 2026 à 00:00
    Quand l'application demande quel jour on est
    Alors elle obtient le jeudi 15 octobre 2026
