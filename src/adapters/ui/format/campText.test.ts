// Les textes du camp (#40), tirés de la maquette `docs/mockups/40-camp/` et du glossaire.
import {
  ALL_UNLOCKED_BAND,
  KEEPER_LINES,
  NEXT_ASCENT_STAMP,
  SHEET_ERROR,
  UNLOCKED_STAMP,
  availableShardsText,
  buyLabel,
  cardLabel,
  confirmText,
  keeperLine,
  keeperRule,
  missingLabel,
  missingText,
  purseLabel,
  runBand,
  sheetLine,
  sheetTitle,
  unlockCard,
  unlockedAnnouncement,
  unlockedToast,
} from './campText';

describe('the texts of the camp (#40)', () => {
  it('counts the Available shards', () => {
    expect(availableShardsText(62)).toBe('62 Éclats disponibles');
    expect(availableShardsText(1)).toBe('1 Éclat disponible');
    expect(availableShardsText(0)).toBe('0 Éclat disponible');
    expect(purseLabel(62, 82)).toBe('62 Éclats disponibles : 82 gagnés, 20 dépensés');
  });

  it('gives the line of the Flame Keeper: first visit, usual, after a purchase, during an ascent, all done', () => {
    const base = { firstVisit: false, allUnlocked: false, ascentInProgress: false, bought: false };

    expect(keeperLine({ ...base, firstVisit: true })).toBe(KEEPER_LINES.first);
    expect(keeperLine(base)).toBe('Ce que tu prends ici, tu le trouveras là-haut.');
    expect(keeperLine({ ...base, ascentInProgress: true })).toBe(KEEPER_LINES.run);
    expect(keeperLine({ ...base, ascentInProgress: true, bought: true })).toBe(
      "Ton ascension n'est pas finie. Ce que tu prends ici t'attendra à la prochaine.",
    );
    expect(keeperLine({ ...base, bought: true })).toBe("Ce qui brûle ici t'attend là-haut.");
    expect(keeperLine({ ...base, ascentInProgress: true, allUnlocked: true })).toBe(
      KEEPER_LINES.done,
    );
    expect(keeperLine({ ...base, bought: true, allUnlocked: true })).toBe(
      "Tout ce que j'avais brûle déjà dans la tour. Garde tes Éclats.",
    );
    expect(keeperRule(true)).toMatch(/^Les Éclats se gagnent en battant une Élite \(2\)/);
    expect(keeperRule(false)).toBe(
      'Un déblocage est pour toujours : il rejoint la tour dès ta prochaine ascension.',
    );
  });

  it('reminds the ascent in progress, and says when all is unlocked', () => {
    expect(runBand({ tier: 1, floor: 3 })).toBe(
      "Ascension en cours · Palier 1, étage 3. Ce que tu débloques maintenant n'entre pas dans cette ascension.",
    );
    expect(ALL_UNLOCKED_BAND).toBe('Tous les déblocages du Gardien sont dans la tour.');
  });

  it('describes each card: name, type and rarity, effect, and when it appears', () => {
    expect(unlockCard('huntingSpear')).toMatchObject({
      name: 'Épieu de chasse',
      tag: '◆ Arme · Commun',
      effect: 'Attaque +10 % · Initiative 0',
      note: null,
      rarity: 'common',
    });
    expect(unlockCard('watchBell')).toMatchObject({
      tag: '◆◆ Accessoire · Rare',
      effect: 'Contre-attaque ×1,3 · Initiative 0',
    });
    expect(unlockCard('emberHeart')).toMatchObject({
      name: 'Cœur de braise',
      tag: '◆◆◆ Braise · Épique',
      effect: 'Chaque garde que tu brises : +1 Élan et 5 PV rendus.',
      note: 'Bienfait. Proposé après une Élite (10 %), une fois par ascension.',
    });
    expect(unlockCard('flamberge')).toMatchObject({
      tag: '◆◆◆ Arme · Épique',
      effect: 'Attaque +10 % · Frappe parfaite +0,3 · Initiative 0',
      note: 'Seulement sur une Élite.',
    });
  });

  it('reads a card in one go: name, rarity, effect, state', () => {
    const bell = unlockCard('watchBell');

    expect(cardLabel(bell, { kind: 'affordable' }, 40)).toBe(
      'Clochette du guet, accessoire, Rare. Contre-attaque ×1,3, Initiative 0. 40 Éclats.',
    );
    expect(cardLabel(unlockCard('emberHeart'), { kind: 'unlocked' }, 80)).toBe(
      'Cœur de braise, bienfait, Épique. Chaque garde que tu brises : +1 Élan et 5 PV rendus. Bienfait. Proposé après une Élite (10 %), une fois par ascension. Déjà dans la tour.',
    );
    expect(cardLabel(bell, { kind: 'nextAscent' }, 40)).toMatch(/ Dès ta prochaine ascension\.$/);
    expect(cardLabel(bell, { kind: 'missing', missing: 2 }, 40)).toMatch(/ Il manque 2 Éclats\.$/);
    expect([UNLOCKED_STAMP, NEXT_ASCENT_STAMP]).toEqual([
      'Déjà dans la tour',
      'Dès ta prochaine ascension',
    ]);
  });

  it('labels the buttons with the price and, when off, why', () => {
    expect(buyLabel(unlockCard('watchBell'), 40)).toBe('Débloquer Clochette du guet, 40 Éclats');
    expect(missingLabel(unlockCard('flamberge'), 80, 18)).toBe(
      'Flamberge, 80 Éclats, il manque 18 Éclats.',
    );
    expect(missingText(18)).toBe('Il manque 18 Éclats');
    expect(missingText(1)).toBe('Il manque 1 Éclat');
  });

  it('writes the confirmation sheet, with and without an ascent in progress', () => {
    expect(sheetTitle('huntingSpear')).toBe("Débloquer l'Épieu de chasse ?");
    expect(sheetTitle('watchBell')).toBe('Débloquer la Clochette du guet ?');
    expect(sheetTitle('emberHeart')).toBe('Débloquer le Cœur de braise ?');
    expect(confirmText(40)).toBe('Débloquer pour 40 Éclats');
    expect(sheetLine(false)).toBe('Il rejoint la tour dès ta prochaine ascension, pour toujours.');
    expect(sheetLine(true)).toBe("Dès ta prochaine ascension. L'ascension en cours ne change pas.");
    expect(SHEET_ERROR).toBe("Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts.");
  });

  it('tells and announces the unlock', () => {
    expect(unlockedToast('watchBell', false)).toBe('La Clochette du guet est dans la tour.');
    expect(unlockedToast('huntingSpear', false)).toBe("L'Épieu de chasse est dans la tour.");
    expect(unlockedToast('watchBell', true)).toBe(
      "La Clochette du guet t'attend à ta prochaine ascension.",
    );
    expect(unlockedAnnouncement('watchBell', 22, false)).toBe(
      'Déblocage réussi : Clochette du guet. 22 Éclats disponibles.',
    );
    expect(unlockedAnnouncement('watchBell', 22, true)).toBe(
      'Déblocage réussi : Clochette du guet. Dès ta prochaine ascension. 22 Éclats disponibles.',
    );
  });
});
