# language: fr
Fonctionnalité: Coffre scellé, clés et Fortune
  Story #226 (épique #208) : la faveur et la bénédiction Fortune donnent des clés (`Key`), qui
  ouvrent le coffre scellé (`SealedChest`) qui suit chaque Élite gagnée. Le coffre a son propre
  tirage : l'ouvrir ou le laisser ne change aucun autre tirage de l'ascension.

  # Les scénarios `@domain` éprouvent les règles du domaine (clés, Fortune, contenu, tirages). Les
  # scénarios `@session` passent par une vraie session d'ascension sur un stockage en mémoire. Les
  # scénarios `@ui` passent en plus par les écrans (pied de la tour, ascension, Équipement).

  @domain
  Scénario: Les clés de la faveur (K1)
    Étant donné une jauge de +1
    Quand le joueur commence une ascension sans bénédiction Fortune
    Alors le héros a 1 clé
    Et avec une jauge de +2, il a 1 clé
    Et avec une jauge de 0, −1 ou −2, il n'a aucune clé

  @ui
  Scénario: Les clés annoncées au pied de la tour (K1)
    Étant donné une jauge de +2
    Quand le joueur ouvre le pied de la tour
    Alors les effets de la jauge comptent « 1 clé »
    Et avec une jauge de 0, ils ne parlent d'aucune clé

  @domain
  Scénario: La famille Fortune dans l'offre de bénédictions (F1)
    Étant donné le joueur a fait une habitude hier
    Quand il choisit sa bénédiction de départ
    Alors les 3 familles proposées sont distinctes, tirées parmi Vigueur, Élan, Tranchant, Protection, Hâte et Fortune
    Et Bourse n'est jamais proposée

  @domain
  Scénario: Fortune ajoute des clés au choix de la bénédiction (K2, F2, F3)
    Étant donné une jauge de +2
    Quand le joueur choisit une bénédiction Fortune Épique au début de l'ascension
    Alors le héros a 4 clés (1 de la faveur + 3 de Fortune)
    Et une Fortune Commune en aurait ajouté 1, une Fortune Rare 2

  @domain
  Scénario: Fortune sans faveur (F2, F4)
    Étant donné une jauge de 0
    Quand le joueur choisit une bénédiction Fortune Rare
    Alors le héros a 2 clés
    Et la chance d'objet, la rareté des objets, les Éclats, les déblocages et le camp ne changent pas

  @ui
  Scénario: La porte Élite annonce le coffre scellé (CH3)
    Quand une porte Élite est proposée
    Alors elle annonce l'objet Rare garanti et le coffre scellé
    Et à −2, la porte « Élite maudite » les annonce aussi

  @ui
  Scénario: Le coffre scellé après l'objet garanti de l'Élite (CH2)
    Étant donné le héros a 1 clé et vient de battre une Élite
    Quand le joueur a équipé ou laissé l'objet Rare garanti
    Alors un coffre scellé apparaît, avec « Ouvrir · 1 clé » et « Laisser »
    Et l'offre de bienfaits ne vient qu'après lui

  @ui
  Scénario: Ouvrir le coffre scellé (CH4, CH8)
    Étant donné le héros a 2 clés devant un coffre scellé
    Quand le joueur touche « Ouvrir · 1 clé »
    Alors il reste 1 clé au héros
    Et l'objet du coffre est révélé et comparé à celui que porte le héros
    Et le joueur peut l'équiper ou le laisser, comme tout objet

  @ui
  Scénario: Laisser le coffre scellé fermé, sans confirmation (CH4)
    Étant donné le héros a 1 clé devant un coffre scellé
    Et l'écran dit « Laissé fermé, il ne revient pas. » avant le choix
    Quand le joueur touche « Laisser »
    Alors aucune confirmation n'est demandée
    Et il a toujours 1 clé
    Et le coffre est perdu, et l'offre de bienfaits s'affiche, avec un bandeau qui dit que ses clés sont gardées

  @ui
  Scénario: Sans clé, rien n'est perdu (CH5)
    Étant donné le héros n'a aucune clé et vient de battre une Élite
    Quand le coffre scellé apparaît
    Alors il reste fermé et le bouton « Aucune clé » est indisponible et dit qu'il faut une clé
    Quand le joueur touche « Continuer »
    Alors l'Or, l'objet garanti et l'offre de bienfaits de cette Élite sont ceux qu'il aurait eus sans coffre scellé

  @domain
  Scénario: Le contenu du coffre scellé (CH6)
    Étant donné un objet Épique débloqué que le héros ne porte pas
    Quand un coffre scellé est ouvert et que son tirage de rareté est sous 20 %
    Alors il contient un objet Épique
    Et sinon, il contient un objet Rare
    Et une jauge de +2 ou de −2 ne change jamais ces 20 %

  @domain
  Scénario: Plus aucun Rare libre (CH6, CH7)
    Étant donné le héros porte, ou vient de recevoir de cette Élite, tous les objets Rares
    Et aucun objet Épique n'est libre
    Quand le coffre scellé est ouvert
    Alors il contient un objet Commun

  @domain
  Scénario: Jamais un objet porté, jamais celui de l'Élite (CH7)
    Étant donné l'Élite vient de donner le Marteau
    Quand le coffre scellé de cette Élite est ouvert
    Alors il ne contient ni le Marteau, ni un objet que le héros porte

  @domain
  Scénario: Jamais de coffre scellé ailleurs qu'après une Élite (CH2)
    Quand le héros gagne un combat ordinaire, bat le boss ou passe au Feu de camp
    Alors aucun coffre scellé n'apparaît

  @domain
  Scénario: Ouvrir ou laisser ne change aucun autre tirage (CH9)
    Étant donné deux ascensions de même graine, aux mêmes choix, sauf au coffre scellé d'une Élite
    Quand le joueur l'ouvre dans l'une et le laisse dans l'autre
    Alors les portes, l'Or, les objets trouvés et les offres de bienfaits qui suivent sont les mêmes

  @domain
  Scénario: Même graine, même coffre (CH9)
    Étant donné deux ascensions de même graine, aux mêmes choix
    Quand le joueur ouvre le même coffre scellé dans chacune
    Alors il contient le même objet

  @domain
  Scénario: Sans clé ni Fortune, l'ascension de la v0.4.0 (CH9)
    Étant donné une jauge de 0, sans bénédiction de départ
    Quand le joueur gravit la tour avec une graine donnée
    Alors les portes, l'Or, les objets trouvés et les offres de bienfaits sont ceux de la v0.4.0 pour cette graine

  @session
  Scénario: Une reprise ne refait jamais le tirage (CH10)
    Étant donné le joueur a ouvert un coffre scellé et voit l'objet révélé
    Quand il ferme l'application et reprend l'ascension
    Alors il retrouve le même objet, et le même nombre de clés
    Et un coffre scellé encore fermé à la fermeture est toujours en attente à la reprise

  @session
  Scénario: Les clés traversent les paliers et les reprises (K4)
    Étant donné une ascension lancée hier avec une jauge de +1, où il reste 1 clé
    Et la jauge d'aujourd'hui vaut −2
    Quand le joueur reprend l'ascension et passe au palier suivant
    Alors le héros a toujours 1 clé

  @domain
  Scénario: Les clés sont perdues à la fin de l'ascension (K4)
    Étant donné le héros a encore 3 clés
    Quand l'ascension se termine, par une chute, un abandon ou le Sommet
    Alors la prochaine ascension n'en reçoit que selon sa propre jauge et sa bénédiction Fortune

  @ui
  Scénario: Les clés dans l'en-tête de l'ascension
    Étant donné le héros a 2 clés
    Alors l'en-tête de l'ascension montre « 2 clés » à côté de l'Or
    Et sans clé, l'en-tête n'en parle pas

  @ui
  Scénario: Les clés dans la section « Réserves » de l'Équipement
    Étant donné une ascension lancée à une jauge de 0 avec une bénédiction Fortune Rare
    Quand le joueur ouvre la feuille de l'Équipement
    Alors elle commence par la section « Réserves », avec l'Or et « 2 clés »
    Et il n'y a pas de section « Faveur de l'ascension »
    Et avec une jauge de +1, la section « Faveur de l'ascension » suit les Réserves, avec ses relances, sans ligne de clés

  @session
  Scénario: Le journal d'ascension note les clés et les coffres scellés
    Étant donné une ascension lancée avec 1 clé, où un coffre scellé a été ouvert et un autre est resté fermé faute de clé
    Alors le journal d'ascension note la clé reçue au lancement
    Et pour chaque coffre scellé, son issue : ouvert avec son objet, laissé, ou fermé faute de clé
    Et il ne contient aucune donnée des habitudes
