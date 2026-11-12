// Ce que l'écran montre des Catacombes (#268, maquette 246, C1, C3, C5, C6, C7) : la marque de
// l'Aura du Porte-cierge et sa lueur, le « +20 % » des alliés qui la reçoivent, la ligne du pouce,
// et la place des Rats de crypte dite au lecteur d'écran. Tout est lu dans le domaine.
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { battleView } from './battleView';

const STUN = { heroAction: 1, actionLost: false };

function line(
  enemies: readonly EnemyKind[],
  change: (enemy: EnemyState, index: number) => Partial<EnemyState> = () => ({}),
  battle: Partial<Battle> = {},
): Battle {
  const { battle: started } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies });
  return {
    ...started,
    ...battle,
    enemies: started.enemies.map((enemy, index) => ({ ...enemy, ...change(enemy, index) })),
  };
}

const CANDLE_LINE: readonly EnemyKind[] = ['ghoul', 'candleBearer', 'cryptRat'];

describe('the Aura mark of the Candle bearer (#268, C1, C3, C5)', () => {
  it('says « Aura +20 % » in lemon light, read with his plate', () => {
    const view = battleView(line(CANDLE_LINE)).enemies[1]!;

    expect(view.signature).toEqual({
      variant: 'aura',
      glyph: 'candle8',
      text: 'Aura +20 %',
      speech: 'aura : ses alliés font 20 % de dégâts en plus tant qu’il vit',
      off: false,
      now: false,
    });
    expect(view.auraGlow).toBe('lit');
    expect(view.label).toContain(', aura : ses alliés font 20 % de dégâts en plus tant qu’il vit,');
    expect(view).not.toHaveProperty('auraBoost');
  });

  it('keeps his mark and his glow lit while he is stunned (AU5)', () => {
    const view = battleView(line(CANDLE_LINE, (_, i) => (i === 1 ? { stun: STUN, guard: 0 } : {})))
      .enemies[1]!;

    expect(view.signature).toMatchObject({ text: 'Aura +20 %', off: false });
    expect(view.auraGlow).toBe('lit');
  });

  it('greys his mark « Aura · seul » and pales his glow when he stands alone, the reserve empty', () => {
    const alone = line(CANDLE_LINE, (_, i) => (i === 1 ? {} : { hp: 0 }));
    const view = battleView(alone).enemies[1]!;

    expect(view.signature).toMatchObject({ text: 'Aura · seul', off: true });
    expect(view.signature?.speech).toBe('aura : aucun allié debout');
    expect(view.auraGlow).toBe('out');
  });

  it('is not alone while an enemy waits in the reserve', () => {
    const waiting = line(['ghoul', 'candleBearer', 'cryptRat', 'ghoul'], (_, i) =>
      i === 1 ? {} : { hp: 0 },
    );

    expect(battleView(waiting).enemies[1]!.signature).toMatchObject({ off: false });
  });

  it('pales his glow at his fall, without a mark', () => {
    const view = battleView(line(CANDLE_LINE, (_, i) => (i === 1 ? { hp: 0 } : {}))).enemies[1]!;

    expect(view.auraGlow).toBe('out');
    expect(view).not.toHaveProperty('signature');
  });
});

describe('the « +20 % » of the allies under the Aura (#268, C1, C3, C6)', () => {
  it('marks every other enemy standing, and reads it after the name', () => {
    const { enemies } = battleView(line(CANDLE_LINE));

    expect(enemies.map((enemy) => enemy.auraBoost === true)).toEqual([true, false, true]);
    expect(enemies[0]!.label).toMatch(
      /^Goule, cible, aura du Porte-cierge, \+20 % de dégâts, 50 PV/u,
    );
    expect(enemies[2]!.label).toMatch(/^Rat de crypte, aura du Porte-cierge, \+20 % de dégâts, /u);
  });

  it('stays while the Candle bearer is stunned (AU5)', () => {
    const { enemies } = battleView(line(CANDLE_LINE, (_, i) => (i === 1 ? { stun: STUN } : {})));

    expect(enemies[0]!.auraBoost).toBe(true);
  });

  it('is gone at his fall, and never on a fallen ally', () => {
    const fallen = battleView(line(CANDLE_LINE, (_, i) => (i === 1 ? { hp: 0 } : {})));
    const ghoulDown = battleView(line(CANDLE_LINE, (_, i) => (i === 0 ? { hp: 0 } : {})));

    expect(fallen.enemies.some((enemy) => enemy.auraBoost === true)).toBe(false);
    expect(fallen.enemies[0]!.label).not.toContain('aura');
    expect(ghoulDown.enemies[0]!.auraBoost).toBeUndefined();
  });

  it('is on nobody while the Candle bearer waits in the reserve (AU6)', () => {
    const { enemies } = battleView(line(['ghoul', 'ghoul', 'ghoul', 'candleBearer']));

    expect(enemies.some((enemy) => enemy.auraBoost === true)).toBe(false);
  });
});

describe('the thumb line on the Candle bearer (#268, C1, C3, C5)', () => {
  const lineOf = (battle: Battle) => battleView({ ...battle, target: 1 }).line;

  it('says that his allies strike +20 %', () => {
    expect(lineOf(line(CANDLE_LINE))).toEqual({
      before: 'Cible : ',
      strong: 'Porte-cierge',
      after: ' · ses alliés font +20 % de dégâts',
    });
  });

  it('says that his Aura still burns while he is stunned', () => {
    expect(lineOf(line(CANDLE_LINE, (_, i) => (i === 1 ? { stun: STUN } : {})))?.after).toBe(
      ' · étourdi, son aura brûle encore · ×1,5',
    );
  });

  it('says that his Aura serves nobody when he stands alone', () => {
    expect(lineOf(line(CANDLE_LINE, (_, i) => (i === 1 ? {} : { hp: 0 })))?.after).toBe(
      ' · son aura ne sert à personne',
    );
  });
});

describe('the Crypt rats in the front line (#268, C7)', () => {
  const RATS: readonly EnemyKind[] = ['cryptRat', 'cryptRat', 'cryptRat'];

  it('reads their place to tell them apart: on the left, in the centre, on the right', () => {
    const { enemies } = battleView(line(RATS));

    expect(enemies.map((enemy) => enemy.label.split(', ').slice(0, 2).join(', '))).toEqual([
      'Rat de crypte, à gauche',
      'Rat de crypte, au centre',
      'Rat de crypte, à droite',
    ]);
    expect(enemies[0]!.label).toMatch(
      /^Rat de crypte, à gauche, cible, 12 PV sur 12, garde 14 sur 14/u,
    );
  });

  it('says on the left and on the right for two rats, and no place for a lone rat', () => {
    const two = battleView(line(['cryptRat', 'ghoul', 'cryptRat'])).enemies;
    const lone = battleView(line(['cryptRat', 'ghoul'])).enemies;

    expect(two[0]!.label).toMatch(/^Rat de crypte, à gauche, /u);
    expect(two[2]!.label).toMatch(/^Rat de crypte, à droite, /u);
    expect(lone[0]!.label).toMatch(/^Rat de crypte, cible, /u);
  });

  it('never reads the place of another enemy, even in numbers (decision of the orchestrator)', () => {
    const { enemies } = battleView(line(['ghoul', 'ghoul', 'ghoul']));

    expect(enemies[1]!.label).toMatch(/^Goule, 50 PV/u);
  });

  it('gives a rat neither a signature mark nor a glow (D7)', () => {
    const { enemies } = battleView(line(RATS));

    for (const enemy of enemies) {
      expect(enemy).not.toHaveProperty('signature');
      expect(enemy).not.toHaveProperty('auraGlow');
    }
  });

  it('makes a rat swarm while the Swarm adds to its blows, and stop when it bites alone', () => {
    const swarm = battleView(line(RATS, (_, i) => (i === 2 ? { stun: STUN } : {}))).enemies;
    const alone = battleView(line(RATS, (_, i) => (i === 0 ? {} : { hp: 0 }))).enemies;

    expect(swarm.map((enemy) => enemy.swarming === true)).toEqual([true, true, true]);
    expect(alone[0]).not.toHaveProperty('swarming');
  });
});
