# ADR 0032 — La page d'un ennemi

- **Statut** : accepté
- **Date** : 18 novembre 2026
- **Décideur** : Architect (notes techniques de #283, D1 à D13), écrit par le dev
- **Contexte produit** : épique #278, story #283 « La page d'un ennemi : sa silhouette quand il est
  rencontré, son histoire et ses coups quand il est vaincu » ; s'appuie sur le carnet de la story
  socle #282 ([ADR 0030](0030-carnet-de-decouvertes.md))

## Contexte

Depuis le Bestiaire, le joueur ouvre la page d'un ennemi : sa silhouette, son nom, sa catégorie et
son palier quand il est seulement rencontré ; son image, son histoire, ses mécaniques et ses coups,
dits en mots de joueur, une fois vaincu, avec la page qui se colore la première fois. Les règles du
Game Designer (B18, B20 à B22) et les décisions du propriétaire du 12/11/2026 demandent : aucun
chiffre de jeu sur la page, les mécaniques montrées seulement une fois l'ennemi vaincu, le mot
« ennemi » partout, et « Page remplie » une seule fois par ennemi, avec les garanties du carnet.

## Décision

1. **Le domaine décide de ce qui se montre** (D1, `domain/discoveryBook/enemyPage.ts`). `enemyPage`
   rend `null` pour une entrée inconnue ou absente du catalogue (l'entrée ne s'ouvre pas), une page
   cachée sans contenu pour un ennemi rencontré, et une page remplie pour un vaincu : ses mécaniques
   et ses coups, par phase pour un boss (la phase 2 ne donne que les coups qu'elle ajoute). Un coup
   de la page (`PageMove`) n'a que son type, son Saignement, ses charges de Brûlure et sa Charge :
   aucun champ de dégâts, de poids ni de durée, B21 est garantie par le type. Le palier et la
   catégorie viennent du catalogue.
2. **Les mécaniques viennent de la fiche** (D2, `pageMechanics`), dans un ordre fixe : Se relève
   seul, Soutien, Exhumer, Invocation, Épines, Sanctuaire, Aura, Nuée (« Meute »), Éclatement
   (« Braises »), Vol d'Élan, Charge, Balayage, Changement de phase. L'état maudit est un état du
   combat, absent du profil : il ne peut pas apparaître. Le contenu ne fait que les dire en mots ; un
   test exige que les mécaniques du contenu soient exactement celles du domaine, pour chaque ennemi.
3. **Les libellés du combat sont ceux du combat** (D3, D4) : « Aura +20 % », « Braises 2 », « Vole
   l'Élan », « Charge » et « Balayage » viennent de `signatureText(…).text`, jamais de sa phrase au
   lecteur d'écran, qui donne des nombres ; « Brûlure ×N » de `burnChipText` ; le type de coup de
   `ATTACK_NAMES`. « Épines » et « Sanctuaire » s'écrivent sans leur nombre de combat.
4. **La marque « page vue remplie »** (D6, `BestiaryRecord.pageSeen?: true`), propre au Bestiaire :
   - posée par `markPageSeen` sur une entrée vaincue seulement, à la première ouverture de sa page
     remplie, par la file d'écriture de la session (`DiscoveryBookSession.markPageSeen`) ; une page
     cachée ne marque rien ;
   - `firstFill` vaut « vaincu et pas encore vu » ; l'écran le lit à l'ouverture (initialiseur de
     `useState`) puis marque dans un effet idempotent, ce qui ne rejoue rien en double effet ;
   - à la fusion, à état égal, la marque est l'union des deux enregistrements (R2), quel que soit
     celui que `higher` garde (#293 : le stocké) ; la règle de « nouveau » ne change pas ;
   - à la lecture, `pageSeen: true` est lu sur une entrée vaincue, ignoré sur une rencontrée, et
     toute autre valeur rend le carnet illisible ; un objet ne la lit ni ne la porte. Les fonctions
     génériques `readRecords`, `higher` et `mergeRecords`, partagées avec les Objets, ne changent
     pas : la marque est lue et fusionnée à côté, pour le Bestiaire seul.
   - même clé `discoveryBook`, version 1 : aucune migration, aucune nouvelle clé.
5. **Pas de son** (D5). La maquette 278 (F5) annonce « le petit son de page (celui de « Valider ») »,
   mais ni les Notes UX ni le Gherkin validés ne le demandent, et l'app n'a que les sons du combat
   (port `BattleSound`). C'est un écart assumé de la maquette : si le propriétaire veut ce son, c'est
   une story à part, avec un port de sons d'interface.
6. **L'animation « Page remplie »** (D7) : les couleurs de l'image de combat remplacent la
   silhouette de bas en haut, en 4 pas de 120 ms (480 ms), puis « Page remplie » s'affiche et une
   région polie annonce « Page remplie : <nom>. » ; en mouvement réduit, un fondu de 480 ms en 4 pas,
   sans glisser. Les minuteurs sont dans l'adaptateur.
7. **Les images** (D8), sans image nouvelle ni Skia : l'image de combat est la pose `idle0` de
   l'animation complète (`battleImage`, celle de la phase 1 pour un boss), sur une bande du fond de
   son palier, dessinées par `AssetRows` ; la page cachée montre sa silhouette (`battleSilhouette`),
   de phase 1 quelle que soit la phase où le boss a été vu ; le portrait de phase 2 vient de
   `PHASE_2_PORTRAITS`, seulement s'il y existe.
8. **Ouvrir une page n'est pas sortir du carnet** (D9). Le carnet efface les marques « nouveau » quand
   il perd le focus ; une page poussée le lui fait perdre. L'entrée ouverte est retenue dans une
   **ref**, posée avant la navigation (la perte du focus peut arriver avant le rendu suivant) : une
   perte du focus qui vient d'une ouverture n'efface rien. Le retour, le geste retour hors d'une page
   et le démontage effacent toujours.
9. **Retour au même endroit** (D10). Le carnet reste monté sous la page (pile native) : le palier
   choisi et le défilement sont gardés sans rien stocker. Quand il reprend le focus, le lecteur
   d'écran revient sur la case de l'entrée ouverte (`AccessibilityInfo.sendAccessibilityEvent`,
   `focus`), puis la ref est remise à zéro, pour que la sortie suivante efface bien les marques. Une
   case vaincue ou rencontrée est un bouton lu « Embrasé, vaincu, nouveau. Ouvrir sa page » ; « ??? »
   n'est jamais une cible.
10. **Le contenu recopié n'est pas mesuré en duplication** (D11). Les textes des 37 pages sont
    recopiés du Codex de l'Atelier dans `src/adapters/ui/format/codex/enemyPages.ts`, fiche par
    fiche, avec la version et la sha256 de chaque fiche ; les phrases des mécaniques, de la maquette
    278 corrigée par le GD. Les descriptions du Codex répètent volontairement des phrases (« Le reflet
    se dédouble : deux impacts, deux parades. ») : `src/adapters/ui/format/codex/**` rejoint
    `sonar.cpd.exclusions`, comme `atelier/data` (ADR 0010). Ce dossier ne contient que des données,
    sans fonction ; la logique (`enemyPageText.ts`, `pageMechanics`) reste mesurée. Le seuil de 3 %
    ne change pas et la couverture reste mesurée ; la note sous « Seuils » de `docs/workflow.md` le
    dit. Les tests de contenu (alignement sur `ENEMIES`, B21, mécaniques égales à celles du domaine)
    sont le filet de sécurité de ces données.
11. **La route** (D12, `src/app/bestiary/[kind].tsx`) : poussée par le carnet ; hors du build de
    preview, elle ramène à l'accueil (ADR 0030, D11) ; si `page(kind)` est `null` (carnet pas lu,
    entrée inconnue, nom de code hors du jeu), elle revient en arrière, ou au carnet quand rien n'est
    dessous (`canGoBack`, sinon `/book`), comme le carnet revient au pied de la tour.

## Conséquences

- Aucun port nouveau, aucune migration ; deux méthodes de plus sur `DiscoveryBookSession` (`page`,
  `markPageSeen`), sans changement de `DiscoveryBookView` ni de `current()`.
- Textes écrits pour cette story, le Codex n'étant pas modifié, relus et corrigés par le GD le
  18/11/2026 (bug #299) : l'Invocation de la Reine des phalènes (« Quand ses PV descendent à la
  moitié, elle appelle deux Phalénides à ses côtés. Elles retombent en cendre avec elle. »), et
  Frôlement (Phalène voleuse) sans son chiffre (« … Chaque impact qui le touche, même sur une bonne
  parade, lui vole un peu de son Élan. » au lieu de « lui vole 1 Élan »), avec la phrase de son Vol
  d'Élan (« Chaque impact qui te touche, bonne parade comprise, te vole un peu de ton Élan. Une
  parade parfaite ou une esquive le protège. »).
- Le Codex du jour n'a ni nom ni description pour le coup du Nécromancien : la page reprend le nom
  de la révision du 26/10/2026 (« Bâton des veilles »), copié dans la maquette 278 ; sa description,
  qui parlait d'un coup lent, a été relue et corrigée par le GD le 18/11/2026 (bug #299) : « Il lève
  son bâton et l'abat d'un coup sec, comme on frappe à une porte. Un reflet blanc, un seul impact. »
- Risques acceptés : une écriture de la marque en échec puis l'app fermée rejoue « Page remplie » une
  fois (la même garantie que le carnet, ADR 0030, D7) ; un ennemi qui entre dans le jeu après cette
  story écrit sa page dans sa propre story (règle de contenu du carnet).
