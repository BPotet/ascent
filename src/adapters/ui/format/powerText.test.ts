// Les libellés des pouvoirs (#235) : noms, touches, types, effets, voies, états des nœuds de
// l'arbre, fiche et raisons d'indisponibilité en combat (maquette 232, sections 1, 3 et 7).
import {
  PATH_NAMES,
  POWER_BUTTON_NAMES,
  POWER_TIPS,
  TREE_POWER_NAMES,
  nodeLabel,
  nodeStateText,
  powerKeyLabel,
  powerKeyReason,
  powerPlace,
  powerType,
  powerTreeCardLabel,
  shardsText,
  unlockAnnouncement,
} from './powerText';

describe('the names of the powers (#235)', () => {
  it('names the 10 nodes of the trees, « Coup de bouclier » in full', () => {
    expect(TREE_POWER_NAMES).toEqual({
      bulwark: 'Rempart',
      shieldBash: 'Coup de bouclier',
      crushingBlow: 'Fracas',
      retaliation: 'Représailles',
      holdFast: 'Tenir bon',
      shadowStep: "Pas de l'ombre",
      rend: 'Entaille',
      flurry: 'Rafale',
      mist: 'Brume',
      ambush: 'Frappe furtive',
    });
  });

  it('writes the button names in 14 characters at most', () => {
    for (const name of Object.values(POWER_BUTTON_NAMES)) {
      expect(name.length).toBeLessThanOrEqual(14);
    }
    expect(POWER_BUTTON_NAMES.retaliation).toBe('Représailles');
  });

  it('names the paths', () => {
    expect(PATH_NAMES).toEqual({
      shield: 'Bouclier',
      watch: 'Veille',
      blades: 'Lames',
      shadow: 'Ombre',
    });
  });

  it('gives the type of each power', () => {
    expect(powerType('bulwark')).toBe('Action');
    expect(powerType('holdFast')).toBe('Action');
    expect(powerType('mist')).toBe('Instantané');
    expect(powerType('flurry')).toBe('Frappe');
  });

  it('says where a power sits in its tree', () => {
    expect(powerPlace('bulwark')).toBe('La Sentinelle · Pouvoir de base');
    expect(powerPlace('holdFast')).toBe('La Sentinelle · Voie Veille · Rang 2');
  });

  it('copies the short effect of the Codex for the long press', () => {
    expect(POWER_TIPS.mist).toMatch(/^Pouvoir instantané, 2 Élan, à charge\./u);
  });
});

describe('the nodes of the tree (#235)', () => {
  it('writes the state of each node', () => {
    expect(nodeStateText({ kind: 'base' }, 'bulwark')).toBe('Pouvoir de base');
    expect(nodeStateText({ kind: 'soon' }, 'shieldBash')).toBe('Bientôt');
    expect(nodeStateText({ kind: 'unlocked' }, 'retaliation')).toBe('Équipé');
    expect(nodeStateText({ kind: 'nextAscent' }, 'retaliation')).toBe('Dès ta prochaine ascension');
    expect(nodeStateText({ kind: 'locked', after: 'retaliation' }, 'holdFast')).toBe(
      'Après Représailles',
    );
    expect(nodeStateText({ kind: 'affordable' }, 'rend')).toBe('30 Éclats');
    expect(nodeStateText({ kind: 'missing', missing: 20 }, 'holdFast')).toBe('Il manque 20 Éclats');
  });

  it('reads a node to the screen reader (section 7)', () => {
    expect(nodeLabel('holdFast', { kind: 'missing', missing: 20 })).toBe(
      'Tenir bon, 3 Élan, Action, 60 Éclats, il manque 20 Éclats',
    );
    expect(nodeLabel('holdFast', { kind: 'locked', after: 'retaliation' })).toBe(
      "Tenir bon, 3 Élan, Action, verrouillé : débloque d'abord Représailles",
    );
    expect(nodeLabel('retaliation', { kind: 'affordable' })).toBe(
      'Représailles, 2 Élan, Instantané, à débloquer pour 30 Éclats',
    );
    expect(nodeLabel('shieldBash', { kind: 'soon' })).toBe(
      'Coup de bouclier, 2 Élan, Frappe, pas encore disponible',
    );
    expect(nodeLabel('bulwark', { kind: 'base' })).toBe(
      'Rempart, 1 Élan, Action, pouvoir de base, équipé',
    );
    expect(nodeLabel('mist', { kind: 'unlocked' })).toBe(
      'Brume, 2 Élan, Instantané, débloqué, équipé',
    );
  });

  it('counts Shards in the singular and the plural', () => {
    expect([shardsText(0), shardsText(1), shardsText(20)]).toEqual([
      '0 Éclat',
      '1 Éclat',
      '20 Éclats',
    ]);
  });

  it('announces an unlock politely', () => {
    expect(unlockAnnouncement('retaliation', 20)).toBe(
      'Représailles débloqué. Équipé dès ta prochaine ascension. 20 Éclats disponibles.',
    );
  });

  it('reads the card of a tree at the Camp', () => {
    expect(powerTreeCardLabel('sentinel', 2)).toBe(
      'Arbre de pouvoirs de la Sentinelle, 2 pouvoirs sur 5 débloqués',
    );
    expect(powerTreeCardLabel('wanderer', 1)).toBe(
      "Arbre de pouvoirs de l'Errante, 1 pouvoir sur 5 débloqué",
    );
  });
});

describe('the power keys of the battle (#235)', () => {
  it('writes the reason of an unavailable key', () => {
    expect(powerKeyReason({ availability: 'missing', missing: 1 })).toEqual([
      'Il manque',
      '1 Élan',
    ]);
    expect(powerKeyReason({ availability: 'active', missing: 0 })).toEqual(['Actif']);
    expect(powerKeyReason({ availability: 'instantUsed', missing: 0 })).toEqual([
      'Instantané',
      'déjà lancé',
    ]);
    expect(powerKeyReason({ availability: 'usedThisBattle', missing: 0 })).toEqual([
      'Utilisé',
      'ce combat',
    ]);
    expect(powerKeyReason({ availability: 'available', missing: 0 })).toEqual([]);
  });

  it('reads each key to the screen reader (section 7)', () => {
    const slot = { power: 'mist', cost: 2, instant: true } as const;
    expect(powerKeyLabel({ ...slot, availability: 'available', missing: 0 })).toBe(
      'Pouvoir : Brume, 2 Élan, instantané',
    );
    expect(powerKeyLabel({ ...slot, availability: 'missing', missing: 1 })).toBe(
      'Pouvoir : Brume, 2 Élan, instantané, indisponible : il manque 1 Élan',
    );
    expect(powerKeyLabel({ ...slot, availability: 'instantUsed', missing: 0 })).toBe(
      'Pouvoir : Brume, 2 Élan, instantané, indisponible : un pouvoir instantané a déjà été lancé dans cette phase',
    );
    expect(powerKeyLabel({ ...slot, availability: 'active', missing: 0 })).toBe(
      'Pouvoir : Brume, 2 Élan, instantané, actif',
    );
    expect(
      powerKeyLabel({ power: 'holdFast', cost: 3, availability: 'usedThisBattle', missing: 0 }),
    ).toBe('Pouvoir : Tenir bon, 3 Élan, indisponible : déjà utilisé dans ce combat');
  });
});
