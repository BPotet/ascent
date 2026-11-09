// Les Épines et le Sanctuaire dans l'état d'affichage (#259, maquette 245, M2, M3, M7, B2, B3) : la
// piqûre attend la fin de la frappe, puis 300 ms, à part des autres chiffres ; l'étincelle d'acier
// de chaque coup amorti ; les éclats d'acier de la cassure d'un ennemi sous Sanctuaire.
import { THORNS_AFTER_STRIKE_MS } from '../../../application/useCases/battleFeedback';
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { INITIAL_DISPLAY, displayOf, heroHpShown } from './useBattleDisplay';

function battleOf(kinds: readonly EnemyKind[]): Battle {
  return startBattle({ seed: 1, defenseHint: false, at: 0, enemies: kinds }).battle;
}

const MOTHER = battleOf(['brambleMother', 'ashBramble']);
const BEADLE = battleOf(['beadle', 'bellNovice']);

/** Le combat en pleine frappe : un coup reste à résoudre (une Rafale). */
const striking = (battle: Battle): Battle => ({
  ...battle,
  phase: {
    kind: 'heroStrike',
    enemy: 0,
    since: 1_000,
    impactAt: 1_700,
    press: null,
    resolved: false,
    until: 2_200,
    hit: 2,
  },
});

/** Le combat à la fin de la frappe : son dernier coup est résolu. */
const struck = (battle: Battle): Battle => ({
  ...battle,
  phase: {
    kind: 'heroStrike',
    enemy: 0,
    since: 1_000,
    impactAt: 1_700,
    press: null,
    resolved: true,
    until: 2_200,
  },
});

function snapshot(events: readonly BattleEvent[], battle: Battle): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const resolved = (
  at: number,
  change: Partial<Extract<BattleEvent, { type: 'strikeResolved' }>> = {},
) =>
  ({
    type: 'strikeResolved',
    at,
    enemy: 0,
    judgement: null,
    delta: null,
    damage: 6,
    guardDamage: 5,
    ...change,
  }) as const satisfies BattleEvent;

const pricked = (at: number, loss = 2, heroHp = 57): BattleEvent => ({
  type: 'thornsPricked',
  at,
  enemy: 0,
  loss,
  heroHp,
});

describe('the prick of the Thorns in the display state (#259, M2, M3, M7)', () => {
  it('starts without a prick', () => {
    expect(INITIAL_DISPLAY.thorns).toBeNull();
    expect(INITIAL_DISPLAY.heldThorns).toBeNull();
  });

  it('shows the « −2 » 300 ms after a strike of one hit, apart from the number on her', () => {
    const shown = displayOf(
      INITIAL_DISPLAY,
      snapshot([resolved(1_700), pricked(1_700)], struck(MOTHER)),
      false,
    );

    expect(shown.thorns).toEqual({
      key: 1,
      at: 1_700,
      loss: 2,
      heroHp: 57,
      delayMs: THORNS_AFTER_STRIKE_MS,
      // Sur l'horloge de la scène : la fin de la frappe (l'instant du combat publié), puis 300 ms.
      from: MOTHER.now + THORNS_AFTER_STRIKE_MS,
    });
    expect(shown.float?.float).toMatchObject({ at: 0, text: '−6' });
    expect(shown.heroFloat).toBeNull();
  });

  it('holds the prick of a Flurry until its last hit, then shows it once, 300 ms later', () => {
    const first = displayOf(
      INITIAL_DISPLAY,
      snapshot([resolved(1_700, { hit: 1 }), pricked(1_700)], striking(MOTHER)),
      false,
    );

    expect(first.thorns).toBeNull();
    expect(first.heldThorns).toEqual({ at: 1_700, loss: 2, heroHp: 57 });

    const second = displayOf(
      first,
      snapshot([resolved(2_000, { hit: 2 })], striking(MOTHER)),
      false,
    );
    expect(second.thorns).toBeNull();

    const last = displayOf(second, snapshot([resolved(2_600, { hit: 4 })], struck(MOTHER)), false);
    expect(last.thorns).toEqual({
      key: 1,
      at: 1_700,
      loss: 2,
      heroHp: 57,
      delayMs: THORNS_AFTER_STRIKE_MS,
      // Sur l'horloge de la scène : la fin de la frappe (l'instant du combat publié), puis 300 ms.
      from: MOTHER.now + THORNS_AFTER_STRIKE_MS,
    });
    expect(last.heldThorns).toBeNull();
  });

  it('shows nothing when the Thorns take nothing, at 1 HP', () => {
    const shown = displayOf(
      INITIAL_DISPLAY,
      snapshot([pricked(1_700, 0, 1)], struck(MOTHER)),
      false,
    );

    expect(shown.thorns).toBeNull();
    expect(shown.heldThorns).toBeNull();
  });

  it('keeps the HP bar of the hero up until the « −2 », then lowers it with it', () => {
    const hero = { hp: 57 };
    const held = displayOf(INITIAL_DISPLAY, snapshot([pricked(1_700)], striking(MOTHER)), false);

    expect(heroHpShown(hero.hp, held, false)).toBe(59);
    const shown = displayOf(held, snapshot([], struck(MOTHER)), false);
    expect(heroHpShown(hero.hp, shown, false)).toBe(59);
    expect(heroHpShown(hero.hp, shown, true)).toBe(57);
    expect(heroHpShown(hero.hp, INITIAL_DISPLAY, false)).toBe(57);
  });
});

describe('the Sanctuary in the display state (#259, B2, B3)', () => {
  it('starts without a spark nor shards', () => {
    expect(INITIAL_DISPLAY.sanctuary).toEqual({ spark: null, broken: null });
  });

  it('strikes a steel spark on the Beadle at each blow it reduced', () => {
    const shown = displayOf(
      INITIAL_DISPLAY,
      snapshot([resolved(1_700, { sanctuary: true })], struck(BEADLE)),
      false,
    );

    expect(shown.sanctuary.spark).toEqual({ at: 1_700, enemy: 0 });
    expect(shown.float?.float).toMatchObject({ text: '−6', half: true });
  });

  it('strikes no spark on a blow it did not reduce', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([resolved(1_700)], struck(BEADLE)), false);

    expect(shown.sanctuary.spark).toBeNull();
  });

  it('bursts steel shards at the guard break of the Beadle, never of another enemy', () => {
    const broken = (enemy: number): BattleEvent => ({
      type: 'guardBroken',
      at: 1_700,
      enemy,
      by: 'strike',
    });

    expect(
      displayOf(INITIAL_DISPLAY, snapshot([broken(0)], struck(BEADLE)), false).sanctuary.broken,
    ).toEqual({ at: 1_700, enemy: 0 });
    expect(
      displayOf(INITIAL_DISPLAY, snapshot([broken(1)], struck(BEADLE)), false).sanctuary.broken,
    ).toBeNull();
  });
});
