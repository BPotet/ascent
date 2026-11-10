// Les libellés des pouvoirs (#235) : noms, types, effets, voies, états des nœuds de l'arbre, fiche
// et états de la liste des pouvoirs en combat (maquette 232, sections 1, 3 et 7 ; #271).
import {
  PATH_NAMES,
  POWER_TIPS,
  TREE_POWER_NAMES,
  basePowerBand,
  noFreeSlotBand,
  nodeLabel,
  nodeStateText,
  powerKeyLabel,
  powerStateText,
  powersKeyLabel,
  readyCountText,
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
      'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au Choix du héros.',
    );
    expect(unlockAnnouncement('flurry', 15, false)).toBe(
      'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au Choix du héros. 15 Éclats disponibles.',
    );
  });

  it('says in the sheet whether an owned power is equipped (#236, F5)', () => {
    expect(unlockedBand(true)).toBe('Débloqué. Équipé à ta prochaine ascension.');
    expect(unlockedBand(false)).toBe('Débloqué. Pas équipé : choisis-le au Choix du héros.');
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

describe('the power list of the battle (#235, #271)', () => {
  it('words the state of each row on one line (KB2, KB3, KB7, KB10)', () => {
    expect(powerStateText({ availability: 'available', missing: 0 })).toBe('Prêt');
    expect(powerStateText({ availability: 'missing', missing: 1 })).toBe('Il manque 1 Élan');
    expect(powerStateText({ availability: 'missing', missing: 2 })).toBe('Il manque 2 Élan');
    expect(powerStateText({ availability: 'active', missing: 0 })).toBe('Actif');
    expect(powerStateText({ availability: 'instantUsed', missing: 0 })).toBe(
      'Instantané déjà lancé',
    );
    expect(powerStateText({ availability: 'usedThisBattle', missing: 0 })).toBe(
      'Utilisé ce combat',
    );
  });

  it('counts the ready powers on « Pouvoirs », plural above 1 (KB1, KB6)', () => {
    expect(readyCountText(3, 3)).toBe('3 prêts sur 3');
    expect(readyCountText(2, 3)).toBe('2 prêts sur 3');
    expect(readyCountText(1, 3)).toBe('1 prêt sur 3');
    expect(readyCountText(0, 3)).toBe('0 prêt sur 3');
    expect(readyCountText(1, 1)).toBe('1 prêt sur 1');
    expect(readyCountText(0, 1)).toBe('0 prêt sur 1');
  });

  it('reads « Pouvoirs » as a menu, its state given by the platform (KB1)', () => {
    expect(powersKeyLabel(3, 3)).toBe('Pouvoirs, 3 prêts sur 3, menu');
    expect(powersKeyLabel(1, 3)).toBe('Pouvoirs, 1 prêt sur 3, menu');
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

  it('reads a kindled instant power at its kindled cost (KB4)', () => {
    expect(
      powerKeyLabel({
        power: 'retaliation',
        cost: 1,
        baseCost: 2,
        kindled: true,
        instant: true,
        availability: 'available',
        missing: 0,
      }),
    ).toBe('Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané');
  });

  it('reads « Coup de bouclier » in full (#236, K14)', () => {
    expect(
      powerKeyLabel({ power: 'shieldBash', cost: 2, availability: 'available', missing: 0 }),
    ).toBe('Pouvoir : Coup de bouclier, 2 Élan');
    expect(powerKeyLabel({ power: 'ambush', cost: 3, availability: 'missing', missing: 1 })).toBe(
      'Pouvoir : Frappe furtive, 3 Élan, indisponible : il manque 1 Élan',
    );
  });
});
