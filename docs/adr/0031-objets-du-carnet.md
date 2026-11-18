# ADR 0031 — Les Objets du carnet de découvertes

- **Statut** : accepté
- **Date** : 18 novembre 2026
- **Décideur** : Architect (notes techniques de #284, D1 à D14), écrit par le dev
- **Contexte produit** : épique #278, story #284 « Les Objets du carnet : chaque objet trouvé se
  découvre », sur la story socle #282 (ADR 0030) ; décision du propriétaire du 18/11/2026 sur les
  descriptions d'objets

## Contexte

Le carnet de découvertes (ADR 0030) gagne un onglet **Objets** : une entrée par objet du jeu (11),
« ??? » jusqu'à ce que l'objet soit **découvert**, c'est-à-dire montré une première fois sur « Objet
trouvé », qu'il soit ensuite équipé ou laissé (décision du propriétaire du 12/11/2026). « Nouveau au
carnet » le dit à ce moment-là, une seule fois par objet. Les règles du Game Designer (O1 à O7, C3 à
C5, G1 à G6) demandent, comme pour les ennemis, un état monotone, jamais perdu, idempotent,
indépendant du jeu et enregistré au moment même.

La fiche d'un objet montre sa description. Le jeu n'en avait que pour 5 objets sur 11 : le
propriétaire a décidé le 18/11/2026 que les 11 descriptions sont dans cette story, les 6 manquantes
recopiées du Codex de l'Atelier (écart E1 des notes techniques).

## Décision

1. **Une règle pure dit quel objet est découvert** (D1, `domain/discoveryBook/itemDiscoveries.ts`).
   `foundItemDiscovery(before, after)` rend l'objet trouvé d'après quand il diffère de celui d'avant :
   c'est l'instant où il est montré. Seuls la fin d'un combat (butin d'un combat ordinaire, objet
   garanti d'une Élite) et l'ouverture du coffre scellé posent un objet trouvé ; le boss, le Feu de
   camp, l'annonce de la porte Élite, un coffre scellé laissé ou fermé faute de clé et l'achat d'un
   Déblocage ne découvrent donc rien. `resumeItemDiscoveries(ascent)` rend, à la reprise, l'objet
   trouvé en attente puis les objets portés, sans doublon.
2. **Un objet s'enregistre à côté d'un ennemi** (D2, `recordItemDiscoveries` dans `DiscoveryBook.ts`)
   avec les mêmes règles : il ne monte que d'inconnu à découvert, chaque montée le marque
   « nouveau », le même carnet est rendu quand rien ne monte. Un objet ne produit pas de `Discovery`
   (qui reste la montée d'un ennemi). Le format du carnet ne change pas (`DISCOVERY_BOOK_VERSION` 1,
   famille `items` déjà lue par #282), ni la sauvegarde de l'ascension (`SAVE_VERSION` 1).
3. **Un seul point d'enregistrement : `AscentSession.update()`** (D4). Tout changement de l'objet
   trouvé passe par `update()`, qui appelle `foundItemDiscovery(before, ascent)` et, s'il y a un
   objet, `DiscoveryBookSession.recordItems([item])` avant `save()`. `save()` écrit le carnet juste
   avant l'ascension, dans la même file (ADR 0030, § 6) : un objet montré puis une fermeture forcée
   le retrouvent découvert. À `load()`, une ascension en cours relue enregistre
   `resumeItemDiscoveries` ; elle s'écrit à la sauvegarde suivante. Un objet trouvé posé hors de
   `update()` échapperait au carnet : un commentaire le rappelle au point d'appel.
4. **« Nouveau au carnet » vit en mémoire** (D5). La session d'ascension garde l'objet trouvé dont
   l'enregistrement est monté à l'instant où il est devenu l'objet trouvé ; `foundItemIsNew()` le
   dit tant qu'il est l'objet trouvé. Remis à zéro à chaque nouvel objet trouvé, au lancement et au
   retour au pied de la tour, jamais rejoué après une fermeture (O6). Si le carnet n'est pas encore
   lu à cet instant, aucune montée n'est rendue : « Nouveau au carnet » ne s'affiche pas, l'objet
   est découvert quand même et porte « nouveau » dans le carnet (cas limite accepté).
5. **Le catalogue des Objets vient de `ITEMS`** (D6, `ITEM_CATALOG` dans
   `domain/discoveryBook/bookItems.ts`) : par emplacement, puis par rareté, puis dans l'ordre du
   jeu, les objets à débloquer marqués d'après `UNLOCKABLE_ITEMS`. Aucune donnée recopiée : un objet
   ajouté entre au carnet « ??? », sans « nouveau » ; un objet retiré en sort, son état gardé. La
   lecture (`bookItems`, D7) compte le total, chaque rareté et chaque emplacement ; les objets à
   débloquer comptent au total, achetés ou non.
6. **« Se débloque au camp » est un affichage** (D8, `itemEntryNote`). Le carnet ne lit jamais la
   clé du Camp : la vue du camp donne `boughtItems`, que la route du carnet passe à l'écran, `null`
   tant que le Camp n'est pas lu (une ligne inconnue ne montre alors que son emplacement).
7. **L'écran a deux onglets** (D9, D10, D11). « Bestiaire » et « Objets », en liste d'onglets « Le
   carnet », chacun avec son compteur et un point d'or quand l'autre a une entrée nouvelle ; le
   Bestiaire à chaque ouverture ; **seul l'onglet affiché est monté**. Le sous-titre compte les deux
   familles (« 18 découvertes sur 48 »). La liste (`BookItemsTab`) et la fiche (`ItemSheet`) sont
   des composants à part. La fiche se ferme par « Fermer », le retour Android, le voile ou un
   glissement vers le bas, par le `PanResponder` de React Native, sans dépendance nouvelle ; la
   règle `closesOnSwipe` (vers le bas, au-delà de 80 dp ou à plus de 0,5 dp/ms) est pure.
8. **« Nouveau au carnet » sur « Objet trouvé »** (D12). `FoundItemPanel` reçoit `newToBook` :
   l'étiquette d'or au-dessus de la ligne de l'objet, et « Nouveau au carnet. » inséré juste avant
   l'objet dans l'**annonce existante de son chemin** (`withNewToBook`). Les fonctions d'annonce
   `itemAnnouncement` et `chestAnnouncement` ne changent pas. Après le Coffre du butin ou l'objet
   garanti d'une Élite : « Coffre ouvert. Nouveau au carnet. Marteau, … » ; après le coffre scellé,
   dont l'annonce existante n'a pas « Coffre ouvert. » : « Nouveau au carnet. Marteau, … » (la note
   D12 citait « Coffre ouvert. » pour ce chemin ; l'annonce existante est gardée).
9. **Les 11 descriptions d'objets ont une seule source** (D14). `ITEM_DESCRIPTIONS`
   (`format/ascentText.ts`) devient `Readonly<Record<ItemKind, string>>` et `itemDescription` rend
   toujours un texte : un objet ajouté sans description ne compile pas. Ses 5 textes déjà dans le jeu
   ne changent pas ; les 6 autres viennent de `format/codex/itemDescriptions.ts`, un fichier de
   données seulement.

## Les 6 descriptions recopiées du Codex (D14)

Recopiées **telles quelles**, en lecture seule, du Codex de l'Atelier de l'ascension (collection
`codex`), comme les textes des ennemis (ADR 0010). Empreintes sha256 du JSON canonique
(`json.dumps(…, sort_keys=True, separators=(',', ':'), ensure_ascii=False)`, en UTF-8), celle du
document (`data`) et celle de la description. Lues par le PM le 18/11/2026, relues par le dev le
18/11/2026 : mêmes versions, mêmes empreintes.

| Objet | Document (version) | Empreinte du document | Empreinte de la description |
|---|---|---|---|
| Hache rouillée | `codex/axe` (v3) | `e150055f7854ed97a5e77821d929c2ee368c181115b669e6698e6a17fd158cbd` | `09670d570899add905006b4247ab2aff88eb1b9b0ad81d24cafab123038dbfef` |
| Cuir | `codex/leather` (v1) | `6370f9ac291e36e431a358a7e93ade50654b138e019b887497d2e91293f92328` | `178a9d6df221f6e67aafcc1cc553fd9a2a3898d3c9cf4ae0f3edda267a896d7a` |
| Mailles | `codex/chainmail` (v1) | `69c991d2321343cab3329102860300528ba61fec4feabef2806d2672af44fdee` | `8db04257c2320f9898de17dc5fe6e0f4efdc8db73b2b10107c87b9ad6261a0d5` |
| Bouclier du veilleur | `codex/watchmanShield` (v1) | `006c1dfc3208a99deeed0afefe6617117ee499e7285209e019c5f0b1d3770576` | `f628886ab7fbc40c1c8c6a75a4cc0e76bfef1b2a964446496d30d6d40cc80248` |
| Amulette de Hâte | `codex/hasteAmulet` (v1) | `22e496e51f71a19f697be94f1c08b539921bc2409fefec119f19597e28d56f31` | `f8ec2faa68594478dcdb7cfb9a8d39e772d6f43a6c63a5e8264f2890c74c9e3b` |
| Arbalète | `codex/nouvelleArme` (v8, `code` = `crossbow`) | `f3c54323c79b8c225e8b91c0ee3d9a6547cd51c617b7f41e046eaf9d572b7363` | `75168be44a2bb85e4a16c9c9d8c2247093f6a32ca0ed2b599a6ecef261dbe746` |

- **Règle d'arrêt** : une version de document différente de celle du tableau arrête la recopie, et
  le dev escalade au PM (ADR 0010). Toute retouche d'un texte passe par l'Atelier.
- **Fidélité** : `format/codex/itemDescriptions.test.ts` recalcule l'empreinte de chaque description
  et la compare à celle du tableau ; il vérifie aussi que les 11 objets ont une description et que
  les 5 textes déjà dans le jeu sont inchangés.
- **Conséquence sur « Objet trouvé »** : l'écran montre déjà la description d'un objet qui en a une
  (#129). Les 6 objets l'y montrent désormais aussi. C'est le comportement existant appliqué aux
  nouveaux textes, voulu ; ce n'est pas un écart à la maquette D3, qui ne montre que la ligne de
  l'objet.
- **Duplication** : `src/adapters/ui/format/codex/**` est exclu de la détection de duplication de
  Sonar (`sonar.cpd.exclusions`), comme `atelier/data/**` (ADR 0010) ; la couverture reste mesurée
  (`sonar.exclusions` ne change pas). La note sous « Seuils » de `docs/workflow.md` le dit. Le
  dossier `format/codex/` est partagé avec #283 (la page d'un ennemi), chaque story y ayant son
  fichier.

## Conséquences

- Aucune migration, aucun port ni adaptateur nouveau : le carnet reste une valeur du Stockage
  clé-valeur (ADR 0030) ; le Camp est lu par sa session existante.
- Le carnet ne change rien au jeu : à graine égale, les écritures de `ascent.current` sont les mêmes,
  carnet vide, plein ou absent (test d'`AscentSession`). L'écriture du carnet précède celle de
  l'ascension à la sauvegarde qui montre l'objet (test d'ordre des écritures).
- Un objet ajouté par une story à venir (#279) doit avoir sa description, son image, son nom, sa
  rareté et son effet (règle de contenu du carnet) : la compilation refuse un objet sans description.
- Le glissement vers le bas est le premier geste de ce genre dans l'app ; « Fermer » et le retour
  restent toujours là. Il est à vérifier sur l'APK de preview avec un texte agrandi (fiche longue).
