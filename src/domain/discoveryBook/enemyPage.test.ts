// La page d'un ennemi (#283, B18, B20 à B22) : ce qu'elle montre selon l'état de l'entrée, ses
// mécaniques tirées de la fiche, et ses coups, sans aucun chiffre de jeu.
import { ENEMIES, type EnemyKind, type EnemyProfile } from '../battle/combatants';
import { BESTIARY_CATALOG, catalogKinds, type BestiaryCatalog } from './bestiary';
import { EMPTY_DISCOVERY_BOOK, markPageSeen, type DiscoveryBook } from './DiscoveryBook';
import { PAGE_MECHANICS, enemyPage, pageMechanics, type PageMechanic } from './enemyPage';

const book = (enemies: DiscoveryBook['enemies']): DiscoveryBook => ({
  ...EMPTY_DISCOVERY_BOOK,
  enemies,
});

const defeated = (kind: EnemyKind) => {
  const page = enemyPage(book({ [kind]: { state: 'defeated' } }), kind);
  if (page?.state !== 'defeated') throw new Error(`No filled page for ${kind}`);
  return page;
};

describe('the page of an enemy (#283)', () => {
  it('does not open for an unknown entry, nor for a code name out of the catalog (B20, C5)', () => {
    expect(enemyPage(EMPTY_DISCOVERY_BOOK, 'ghoul')).toBeNull();
    expect(enemyPage(book({ retired: { state: 'defeated' } }), 'retired')).toBeNull();
    const withoutGhoul: BestiaryCatalog = {
      ...BESTIARY_CATALOG,
      1: {
        ...BESTIARY_CATALOG[1],
        enemies: BESTIARY_CATALOG[1].enemies.filter((k) => k !== 'ghoul'),
      },
    };
    expect(enemyPage(book({ ghoul: { state: 'defeated' } }), 'ghoul', withoutGhoul)).toBeNull();
  });

  it('shows only the name, the category and the tier of an encountered enemy: the hidden page', () => {
    expect(enemyPage(book({ brambleMother: { state: 'encountered' } }), 'brambleMother')).toEqual({
      kind: 'brambleMother',
      tier: 2,
      category: 'elite',
      state: 'encountered',
    });
  });

  it('takes the tier and the category from the catalog (B14, B15)', () => {
    expect(defeated('skeleton')).toMatchObject({ tier: 1, category: 'enemy' });
    expect(defeated('mothkin')).toMatchObject({ tier: 2, category: 'enemy' });
    expect(defeated('gravedigger')).toMatchObject({ tier: 1, category: 'elite' });
    expect(defeated('hourRinger')).toMatchObject({ tier: 3, category: 'boss' });
  });

  it('fills the page of a defeated enemy: its mechanics and its moves, in one phase', () => {
    expect(defeated('gravedigger')).toEqual({
      kind: 'gravedigger',
      tier: 1,
      category: 'elite',
      state: 'defeated',
      firstFill: true,
      mechanics: ['exhume'],
      phases: [
        {
          moves: [
            { attack: 'basic', bleed: false, burn: null, charge: false },
            { attack: 'double', bleed: false, burn: null, charge: false },
            { attack: 'perilous', bleed: false, burn: null, charge: false },
          ],
        },
      ],
    });
  });

  it('says the Bleeding, the Burn and the Charge of a move, and never a game number (B21)', () => {
    expect(defeated('brambleBurner').phases[0]!.moves).toEqual([
      { attack: 'basic', bleed: false, burn: 2, charge: false },
      { attack: 'double', bleed: true, burn: null, charge: false },
      { attack: 'delayedPerilous', bleed: false, burn: null, charge: false },
    ]);
    expect(defeated('bronzeRam').phases[0]!.moves[1]).toEqual({
      attack: 'delayed',
      bleed: false,
      burn: null,
      charge: true,
    });
    catalogKinds(BESTIARY_CATALOG).forEach((kind) => {
      defeated(kind).phases.forEach(({ moves }) =>
        moves.forEach((move) =>
          expect(Object.keys(move).sort()).toEqual(['attack', 'bleed', 'burn', 'charge']),
        ),
      );
    });
  });

  it('gives a boss two phases: its moves, then only what phase 2 adds', () => {
    expect(defeated('mothQueen').phases.map(({ moves }) => moves.map((m) => m.attack))).toEqual([
      ['feint', 'double'],
      ['perilous'],
    ]);
  });

  it('plays « Page remplie » until the page is seen filled, then never again (B18)', () => {
    const filled = book({ burningHusk: { state: 'defeated', isNew: true } });
    expect(enemyPage(filled, 'burningHusk')).toMatchObject({ firstFill: true });
    const seen = markPageSeen(filled, 'burningHusk');
    expect(enemyPage(seen, 'burningHusk')).toMatchObject({ firstFill: false });
  });
});

describe('the mechanics of an enemy (B22)', () => {
  it.each<[EnemyKind, PageMechanic[]]>([
    ['ghoul', []],
    ['skeleton', ['selfRevive']],
    ['ashBramble', ['selfRevive']],
    ['necromancer', ['support']],
    ['matinsRinger', ['support']],
    ['gravedigger', ['exhume']],
    ['mothQueen', ['summon', 'phaseShift']],
    ['brambleMother', ['thorns']],
    ['beadle', ['sanctuary']],
    ['candleBearer', ['aura']],
    ['cryptRat', ['swarm']],
    ['emberPod', ['emberBurst']],
    ['thievingMoth', ['momentumTheft']],
    ['bronzeRam', ['charge']],
    ['bellClapper', ['sweep']],
    ['hourRinger', ['phaseShift']],
  ])('are those of the sheet of %s, and only them', (kind, mechanics) => {
    expect(pageMechanics(ENEMIES[kind])).toEqual(mechanics);
  });

  it('come in a fixed order', () => {
    const everything: EnemyProfile = {
      ...ENEMIES.ghoul,
      moves: [
        { attack: 'sweep', damage: 1 },
        { attack: 'basic', damage: 1, charge: true },
      ],
      supports: true,
      phaseShiftPercent: 50,
      phase2Summon: { enemy: 'mothkin', count: 2 },
      selfRevive: { times: 1, hpPercent: 50 },
      exhume: { enemy: 'skeleton', rounds: 'even', maxStanding: 1 },
      thorns: { damage: 2 },
      sanctuary: { damagePercent: 50 },
      emberBurst: { stacks: 2 },
      momentumTheft: { amount: 1 },
      aura: { damagePercent: 20 },
      swarm: { damagePerAlly: 2 },
    };
    expect(pageMechanics(everything)).toEqual(PAGE_MECHANICS);
    expect(PAGE_MECHANICS).toEqual([
      'selfRevive',
      'support',
      'exhume',
      'summon',
      'thorns',
      'sanctuary',
      'aura',
      'swarm',
      'emberBurst',
      'momentumTheft',
      'charge',
      'sweep',
      'phaseShift',
    ]);
  });
});
