// Les libellés des pouvoirs (#235) : noms, touches, types, effets, voies, états des nœuds de
// l'arbre, fiche et raisons d'indisponibilité en combat (maquette 232, sections 1, 3 et 7).
import {
  PATH_NAMES,
  POWER_BUTTON_NAMES,
  POWER_TIPS,
  TREE_POWER_NAMES,
  basePowerBand,
  noFreeSlotBand,
  nodeLabel,
  nodeStateText,
  powerKeyLabel,
  powerKeyReason,
  powerPlace,
  powerType,
  powerTreeCardLabel,
  shardsText,
  unlockAnnouncement,
  unlockedBand,
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

  it("writes « Coup d'écu » on the combat key of Shield Bash only (#236)", () => {
    expect(POWER_BUTTON_NAMES).toMatchObject({
      shieldBash: "Coup d'écu",
      crushingBlow: 'Fracas',
      flurry: 'Rafale',
      ambush: 'Frappe furtive',
    });
    expect(Object.values(TREE_POWER_NAMES)).not.toContain("Coup d'écu");
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
    expect(powerType('shieldBash')).toBe('Frappe');
  });

  it('says where a power sits in its tree', () => {
    expect(powerPlace('bulwark')).toBe('La Sentinelle · Pouvoir de base');
    expect(powerPlace('holdFast')).toBe('La Sentinelle · Voie Veille · Rang 2');
  });

  it('copies the short effect of the Codex for the long press', () => {
    expect(POWER_TIPS.mist).toMatch(/^Pouvoir instantané, 2 Élan, à charge\./u);
    expect(POWER_TIPS.shieldBash).toBe(
      "Frappe de pouvoir, 2 Élan : une frappe en rythme d'un coup sur la cible, à 50 % de son Attaque en PV et 200 % de son Brise-garde. Compte comme son action, sans le +1 Élan d'une attaque.",
    );
    expect(POWER_TIPS.ambush).toMatch(
      /^Frappe de pouvoir, 3 Élan : une frappe en rythme de 2 coups/u,
    );
  });
});

describe('the nodes of the tree (#235)', () => {
  it('writes the state of each node', () => {
    expect(nodeStateText({ kind: 'base' }, 'bulwark')).toBe('Pouvoir de base');
    expect(nodeStateText({ kind: 'unlocked' }, 'retaliation')).toBe('Équipé');
    expect(nodeStateText({ kind: 'unlocked' }, 'flurry', false)).toBe('Débloqué');
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
    expect(nodeLabel('shieldBash', { kind: 'affordable' })).toBe(
      'Coup de bouclier, 2 Élan, Frappe, à débloquer pour 30 Éclats',
    );
    expect(nodeLabel('flurry', { kind: 'unlocked' }, false)).toBe(
      'Rafale, 2 Élan, Frappe, débloqué, pas équipé',
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

  it('says when an unlocked power finds no free slot (#236, D2)', () => {
    expect(noFreeSlotBand('flurry')).toBe(
      'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour.',
    );
    expect(unlockAnnouncement('flurry', 15, false)).toBe(
      'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour. 15 Éclats disponibles.',
    );
  });

  it('says in the sheet whether an owned power is equipped (#236, F5)', () => {
    expect(unlockedBand(true)).toBe('Débloqué. Équipé à ta prochaine ascension.');
    expect(unlockedBand(false)).toBe(
      'Débloqué. Pas équipé : choisis-le au pied de la tour, dans « Pouvoirs équipés ».',
    );
    expect(basePowerBand('bulwark')).toBe(
      'Pouvoir de base de la Sentinelle : toujours à toi. Équipé.',
    );
    expect(basePowerBand('shadowStep', false)).toBe(
      "Pouvoir de base de l'Errante : toujours à toi.",
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

  it("reads « Coup de bouclier » in full on the key of « Coup d'écu » (#236, K14)", () => {
    expect(
      powerKeyLabel({ power: 'shieldBash', cost: 2, availability: 'available', missing: 0 }),
    ).toBe('Pouvoir : Coup de bouclier, 2 Élan');
    expect(powerKeyLabel({ power: 'ambush', cost: 3, availability: 'missing', missing: 1 })).toBe(
      'Pouvoir : Frappe furtive, 3 Élan, indisponible : il manque 1 Élan',
    );
  });
});
