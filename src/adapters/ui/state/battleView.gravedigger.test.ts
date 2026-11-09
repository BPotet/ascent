// Ce que l'écran montre du Fossoyeur (#258, maquette 245, F1 à F6) : la disposition (`n1` seul,
// `el3` dès qu'un Squelette est entré), la marque de signature lue dans le domaine, la case en
// pointillé du Squelette exhumé dans l'aperçu de la frise, et la plaque lue « Élite ».
import { encounterMultipliers } from '../../../domain/ascent/tiers';
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import { actionTrackView, battleView } from './battleView';

const STUN = { heroAction: 99, actionLost: false };

function gravedigger(round = 1): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: ['gravedigger'],
    ...encounterMultipliers(1, { kind: 'elite', enemies: ['gravedigger'] }),
  });
  return { ...battle, round };
}

/** Le Fossoyeur et son Squelette exhumé, debout ou non, à la place 1. */
function withSkeleton(battle: Battle, change: Partial<EnemyState> = {}): Battle {
  const { battle: skeletons } = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['skeleton'],
  });
  const skeleton: EnemyState = {
    ...skeletons.enemies[0]!,
    summoned: true,
    exhumed: true,
    raisedRound: battle.round,
    ...change,
  };
  return { ...battle, enemies: [...battle.enemies, skeleton] };
}

const withDigger = (battle: Battle, change: Partial<EnemyState>): Battle => ({
  ...battle,
  enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
});

describe('the layout of the Gravedigger (#258, D7)', () => {
  it('keeps one column while he is alone (F1, F2, F4)', () => {
    expect(battleView(gravedigger())).toMatchObject({ columns: 1, leadLayout: false });
  });

  it('leads on three columns once a Skeleton has entered (F3, F5, F6)', () => {
    const view = battleView(withSkeleton(gravedigger(2)));

    expect(view).toMatchObject({ columns: 3, leadLayout: true });
    expect(view.enemies).toHaveLength(2);
    expect(battleView(withSkeleton(gravedigger(4), { hp: 0 }))).toMatchObject({
      columns: 3,
      leadLayout: true,
    });
  });

  it('never crowns the Gravedigger: the Elite crown stays for the escorted Elite', () => {
    const [digger, skeleton] = battleView(withSkeleton(gravedigger(2))).enemies;

    expect(digger).not.toHaveProperty('elite');
    expect(skeleton).not.toHaveProperty('escort');
  });
});

describe('the signature mark of the Gravedigger (#258, D8)', () => {
  const signatureOf = (battle: Battle) => battleView(battle).enemies[0]!.signature;

  it('says the next even round, with the shovel (F1)', () => {
    expect(signatureOf(gravedigger(1))).toEqual({
      variant: 'exhume',
      glyph: 'shovel8',
      text: 'Exhume · manche 2',
      speech: 'exhume un Squelette à la manche 2',
      off: false,
      now: false,
    });
  });

  it('says « Exhume maintenant », emphasized, while the intent waits (F2)', () => {
    const now = withDigger(gravedigger(2), { intent: { category: 'exhume', slot: 1 } });

    expect(signatureOf(now)).toMatchObject({
      glyph: 'shovel8',
      text: 'Exhume maintenant',
      now: true,
      off: false,
    });
  });

  it('greys « Pas d’exhumation » out with the cracked shovel when the guard broke (F4)', () => {
    const lost = withDigger(gravedigger(2), {
      intent: { category: 'exhume', slot: 1 },
      stun: STUN,
    });

    expect(signatureOf(lost)).toMatchObject({
      glyph: 'crack8',
      text: 'Pas d’exhumation',
      off: true,
    });
  });

  it('greys « Squelette debout » out with the bone while his Skeleton stands (F5)', () => {
    expect(signatureOf(withSkeleton(gravedigger(4)))).toMatchObject({
      glyph: 'bone8',
      text: 'Squelette debout',
      off: true,
      now: false,
    });
  });

  it('has no mark for an enemy without a signature, nor for the Gravedigger fallen', () => {
    const view = battleView(withSkeleton(gravedigger(2)));

    expect(view.enemies[1]).not.toHaveProperty('signature');
    expect(battleView(withDigger(gravedigger(2), { hp: 0 })).enemies[0]).not.toHaveProperty(
      'signature',
    );
  });

  it('reads the plate as an Elite, with the mark before the intent (F2)', () => {
    const now = withDigger(gravedigger(2), {
      intent: { category: 'exhume', slot: 1 },
      hp: 108,
      guard: 36,
    });

    expect(battleView(now).enemies[0]!.label).toBe(
      'Fossoyeur, Élite, cible, 108 PV sur 120, garde 36 sur 50, exhume un Squelette cette manche ; brise sa garde avant son tour pour l’en empêcher, intention : exhumer',
    );
  });
});

describe('the dotted entry of the exhumed Skeleton in the action track (#258, F3, F5)', () => {
  it('dots the exhumed Skeleton in the preview of the next round, only it', () => {
    const battle = withSkeleton(gravedigger(2));
    const { next } = actionTrackView(battle);

    expect(next.find((entry) => entry.actor === 1)).toMatchObject({
      fighter: 'skeleton',
      exhumed: true,
    });
    expect(next.find((entry) => entry.actor === 0)).not.toHaveProperty('exhumed');
  });

  it('never dots a summoned enemy that was not exhumed (#172 does not change)', () => {
    const exhumedToo = withSkeleton(gravedigger(2));
    const { exhumed: _, ...summoned } = exhumedToo.enemies[1]!;
    const battle = { ...exhumedToo, enemies: [exhumedToo.enemies[0]!, summoned] };
    const { next } = actionTrackView(battle);

    expect(next.find((entry) => entry.actor === 1)).not.toHaveProperty('exhumed');
  });
});

describe('the line above the buttons with the Gravedigger (#258, F2, F5)', () => {
  it('says how to prevent the exhumation while the Gravedigger is the target (F2)', () => {
    const now = withDigger(gravedigger(2), { intent: { category: 'exhume', slot: 1 } });

    expect(battleView(now).line).toEqual({
      before: 'Cible : ',
      strong: 'Fossoyeur',
      after: ' · brise sa garde pour empêcher l’exhumation',
    });
  });

  it('says that the Gravedigger does not exhume while his Skeleton stands (F5)', () => {
    const standing = { ...withSkeleton(gravedigger(4)), target: 1 };

    expect(battleView(standing).line).toEqual({
      before: 'Cible : ',
      strong: 'Squelette',
      after: ' · le Fossoyeur n’exhume pas',
    });
  });

  it('says nothing more before an even round', () => {
    expect(battleView(gravedigger(1)).line).toEqual({
      before: 'Cible : ',
      strong: 'Fossoyeur',
      after: '',
    });
  });
});
