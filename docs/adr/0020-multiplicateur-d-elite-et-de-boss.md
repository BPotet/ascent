# ADR 0020 — Multiplicateur d'Élite et de boss

- **Statut** : accepté
- **Date** : 7 novembre 2026
- **Avenant** : 8 novembre 2026, la colonne PV et dégâts des Élites (#257), voir en fin de document
- **Décideur** : Architect (notes techniques de #244), écrit par le dev
- **Contexte produit** : épique #243, story #244 « Gardes plus solides, Élites et boss plus forts,
  soins resserrés et Élites variées » (lot 1 du rééquilibrage du palier 3)
- **Complète** : [ADR 0012](0012-paliers-et-total-d-eclats.md),
  [ADR 0016](0016-journal-des-combats.md) et [ADR 0018](0018-ennemis-maudits.md) (avenants du
  7 novembre 2026)

## Contexte

Le Sommet était devenu trop facile : les Élites et les boss gardaient les valeurs du Codex quel
que soit le palier, les gardes cédaient en une frappe parfaite renforcée, les soins de parade
s'additionnaient sans limite et la porte Élite pouvait rendre deux fois la même Élite. Le
propriétaire a validé le 07/11/2026 un lot de cinq règles : le multiplicateur d'Élite et de boss
(R1), le Brise-garde d'une frappe sans les bonus de frappe parfaite (G1), les gardes doublées des
ennemis ordinaires et la colonne garde (G2), le répit par palier (R3), le plafond de soin de parade
(R4) et l'Élite non répétée (R5). Il faut décider où vivent ces règles et comment relire les
sauvegardes d'avant, sans migration.

## Décision

1. **Le multiplicateur est une règle du palier, par rôle** : `TIERS` (ADR 0012) porte, à côté du
   multiplicateur des combats ordinaires (`multiplier`), un multiplicateur d'Élite
   (`eliteMultiplier`) et un de boss (`bossMultiplier`), de même forme (`TierMultiplier` :
   `hpPercent` pour les PV et les dégâts, `guardPercent` pour la colonne garde) ;
   `EliteBossMultiplier` en est l'alias du glossaire. `encounterMultiplier(tier, kind)` est la
   seule lecture de la table. Le Codex ne change pas pour les Élites et les boss.
2. **Le moteur du combat ne change pas** : `startBattle({ tierMultiplier })` multiplie déjà les PV
   max et la garde max de départ, et `startRound` les dégâts de chaque coup. Le champ sauvegardé
   `Battle.tierMultiplier` garde son nom et devient « le multiplicateur des ennemis du combat » :
   de palier pour un combat ordinaire, d'Élite et de boss sinon. Les invoqués gardent
   `summonMultiplier`, celui du palier.
3. **G1 vit dans `strikeBlow`** : il prend le jugement et les bonus de frappe parfaite ; les PV
   prennent le multiplicateur de frappe avec les bonus, la garde le prend sans (1,5, 1,2 ou 1,0),
   chacun en un seul arrondi. Toute frappe en rythme y passe ; la contre-attaque et la Riposte du
   Rempart gardent leur calcul.
4. **Les gardes doublées (G2) sont recopiées de l'Atelier**, jamais calculées : aucun facteur × 2
   dans le jeu (ADR 0010).
5. **Les nouveaux états sont des champs facultatifs, sans migration** (`SAVE_VERSION` 1) :
   `Battle.respitePercent` (R3 ; absent, 10 %), `HeroState.parryHealed` (R4 ; absent, 0) et
   `Ascent.lastElite` (R5 ; absente, la porte Élite tire comme avant). Un combat d'Élite ou de boss
   sauvegardé avant #244 n'a pas de `tierMultiplier` : ses ennemis gardent leurs valeurs
   enregistrées et ses coups leurs dégâts d'avant.

## Conséquences

- Les 200 ascensions rejouées du palier 1 changent par leurs gardes (colonne garde, G2) et par les
  72 marches qui franchissent une 2e porte Élite (R5) ; leurs graines ne changent jamais.
- Une 2e porte Élite d'un palier ne consomme plus de tirage : ce qui suit sur le flux de
  l'ascension change pour ces ascensions-là. C'est voulu.
- L'onglet Équilibrage de l'Atelier ne mesure pas ces règles (hors périmètre).
- Rien ne quitte le téléphone.

## Avenant du 8 novembre 2026 — la colonne PV et dégâts des Élites (#257, ADR 0023)

- Décision du propriétaire du 08/11/2026 : avec l'**Élite escortée** (ADR 0023), la colonne PV et
  dégâts de `eliteMultiplier` passe à **80 / 80 / 88 %** aux paliers 1, 2 et 3 (100 / 120 / 135 %
  avant). La colonne garde (125 / 140 / 150 %) et `bossMultiplier` ne changent pas. Le palier 1
  est touché : Chevalier déchu et Jumeaux à 160 PV.
- `encounterMultiplier` garde sa signature. Une nouvelle lecture, `encounterMultipliers(tier,
  encounter)`, rend les multiplicateurs d'un combat d'étage (`tierMultiplier`, `summonMultiplier`
  et, pour une Élite escortée, `escortMultiplier`) ; la session et l'aide des marches figées du
  palier 1 l'appellent toutes les deux.
- Un combat d'Élite sauvegardé avant #257 garde son `tierMultiplier` enregistré (100 / 120 / 135 %) :
  la reprise ne relit jamais `TIERS`. Une rencontre d'Élite tirée avant #257 mais pas encore
  commencée prend les nouvelles valeurs.
- Les 200 ascensions rejouées du palier 1 changent par les PV et les dégâts de leurs Élites
  (228 segments `elite[...]` sur 140 marches), jamais par leurs tirages ni leurs graines.
