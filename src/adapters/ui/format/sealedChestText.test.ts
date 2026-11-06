import {
  FROM_SEALED_CHEST,
  LEAVE_FOR_GOOD,
  NOTHING_LOST,
  NO_KEY,
  NO_KEY_LABEL,
  OPENS_WITH_A_KEY,
  SEALED_CHEST_CONTENT,
  SEALED_CHEST_OPENING,
  SEALED_CHEST_SOURCE,
  SEALED_CHEST_TITLE,
  keysEntryAnnouncement,
  keysEntryLines,
  keysEntryTitle,
  keysEntryUse,
  keysText,
  openLabel,
  sealedLeftAnnouncement,
  sealedLeftBand,
  sealedOpenedAnnouncement,
} from './sealedChestText';

describe('the texts of the sealed chest (#226, maquette 208)', () => {
  it('counts the keys, in the singular and the plural', () => {
    expect([1, 2, 4].map(keysText)).toEqual(['1 clé', '2 clés', '4 clés']);
  });

  it('writes the screen of the sealed chest, with and without key (S2, S7)', () => {
    expect(SEALED_CHEST_TITLE).toBe('Coffre scellé');
    expect(SEALED_CHEST_SOURCE).toBe("Après l'Élite");
    expect(SEALED_CHEST_CONTENT).toBe(
      "Il s'ouvre avec une clé. Dedans : un objet Rare, parfois Épique.",
    );
    expect(LEAVE_FOR_GOOD).toBe('Laissé fermé, il ne revient pas.');
    expect(OPENS_WITH_A_KEY).toBe("Il s'ouvre avec une clé.");
    expect(NO_KEY).toBe('Aucune clé');
    expect(NO_KEY_LABEL).toBe('Aucune clé : il faut une clé pour ouvrir ce coffre');
    expect(NOTHING_LOST).toBe("Pas de clé : rien n'est perdu.");
  });

  it('reads « Ouvrir » with the keys left', () => {
    expect(openLabel(2)).toBe("Ouvrir avec une clé, il t'en reste 2");
    expect(openLabel(1)).toBe("Ouvrir avec une clé, il t'en reste 1");
  });

  it('announces the opening, with the keys left (S3)', () => {
    expect(SEALED_CHEST_OPENING).toBe("Le coffre s'ouvre…");
    expect(sealedOpenedAnnouncement(1)).toBe('Coffre scellé ouvert. Il te reste 1 clé.');
    expect(sealedOpenedAnnouncement(3)).toBe('Coffre scellé ouvert. Il te reste 3 clés.');
    expect(sealedOpenedAnnouncement(0)).toBe("Coffre scellé ouvert. Tu n'as plus de clé.");
    expect(FROM_SEALED_CHEST).toBe('Du coffre scellé');
  });

  it('confirms the keys kept after « Laisser » (S8)', () => {
    expect(sealedLeftBand(2)).toBe('Coffre scellé laissé fermé. Tu gardes tes 2 clés.');
    expect(sealedLeftBand(1)).toBe('Coffre scellé laissé fermé. Tu gardes ta clé.');
    expect(sealedLeftAnnouncement(2)).toBe('Coffre scellé laissé. Tu gardes 2 clés.');
    expect(sealedLeftAnnouncement(1)).toBe('Coffre scellé laissé. Tu gardes 1 clé.');
  });

  it('tells the keys at the entry into the tower, one line per source (F4, F5)', () => {
    expect(keysEntryTitle(3)).toBe('+3 clés');
    expect(keysEntryTitle(1)).toBe('+1 clé');
    expect(keysEntryLines({ favor: 1, fortune: 2 }, 'rare')).toEqual([
      { count: '1', source: 'de la faveur' },
      { count: '2', source: 'de Fortune', rarity: '◆◆ Rare' },
    ]);
    expect(keysEntryLines({ favor: 1, fortune: 0 }, null)).toEqual([
      { count: '1', source: 'de la faveur' },
    ]);
    expect(keysEntryLines({ favor: 0, fortune: 3 }, 'epic')).toEqual([
      { count: '3', source: 'de Fortune', rarity: '◆◆◆ Épique' },
    ]);
    expect(keysEntryUse(3)).toBe("Elles ouvrent le coffre scellé d'une Élite.");
    expect(keysEntryUse(1)).toBe("Elle ouvre le coffre scellé d'une Élite.");
    expect(keysEntryAnnouncement({ favor: 1, fortune: 2 })).toBe(
      "+3 clés : 1 de la faveur, 2 de Fortune. Elles ouvrent le coffre scellé d'une Élite.",
    );
    expect(keysEntryAnnouncement({ favor: 1, fortune: 0 })).toBe(
      "+1 clé : 1 de la faveur. Elle ouvre le coffre scellé d'une Élite.",
    );
  });
});
