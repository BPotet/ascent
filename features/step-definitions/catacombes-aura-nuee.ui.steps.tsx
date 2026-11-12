/**
 * « Les Catacombes, l'Aura et la Nuée » (#268) par l'interface : un combat du palier 1 joué par le
 * domaine, puis ce que l'écran en montre et en dit : la vue du combat (`battleView`), l'état
 * d'affichage (`displayOf`), les annonces au lecteur d'écran (`announcementsFor`), la marque de
 * signature (`SignatureMark`) et le « +20 % » des alliés (`AuraBoostChip`).
 */
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { StyleSheet } from 'react-native';

import { AuraBoostChip } from '../../src/adapters/ui/battle/CatacombsEffects';
import { SignatureMark } from '../../src/adapters/ui/battle/SignatureMark';
import { announcementsFor } from '../../src/adapters/ui/format/battleText';
import { battleView } from '../../src/adapters/ui/state/battleView';
import {
  INITIAL_DISPLAY,
  displayOf,
  type BattleDisplay,
} from '../../src/adapters/ui/state/useBattleDisplay';
import { battleColors } from '../../src/adapters/ui/theme/battleColors';
import {
  advance,
  heroAction,
  nextDeadline,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import {
  STUNNED,
  lineBattle,
  untilBlow,
  withAttack,
  type StartedBlow,
} from '../../src/domain/battle/testing/lineBlows';

interface World {
  battle: Battle;
  blow: StartedBlow;
  played: BattleUpdate;
  display: BattleDisplay;
}

let world = {} as World;

const hiddenToo = { includeHiddenElements: true } as const;
/** Les apostrophes droites du scénario et les apostrophes typographiques de l'écran se valent. */
const plain = (text: string) => text.replaceAll('’', "'");

/** Ce que l'écran tire d'une mise à jour : son état d'affichage. */
const displayed = ({ battle, events }: BattleUpdate): BattleDisplay =>
  displayOf(INITIAL_DISPLAY, { battle, events, heroHint: false, powersHint: false }, false);

const announced = ({ battle, events }: BattleUpdate) => announcementsFor(events, battle).map(plain);

/** Joue le coup commencé jusqu'à son premier impact subi : la mise à jour qui le juge. */
function untilImpact(initial: Battle): BattleUpdate {
  let battle = initial;
  for (let guard = 0; guard < 50; guard += 1) {
    const deadline = nextDeadline(battle)!;
    const update = advance(battle, deadline.at + 1);
    if (update.events.some(({ type }) => type === 'blowResolved')) return update;
    battle = update.battle;
  }
  throw new Error('The blow never landed');
}

/** Le héros frappe sa cible sans appui, jusqu'à la fin de sa frappe. */
function heroStrikes(initial: Battle): BattleUpdate {
  const aimed = heroAction(initial, {
    action: { kind: 'attack' },
    touchStartedAt: initial.now + 50,
    releasedAt: initial.now + 100,
  });
  const events: BattleEvent[] = [...aimed.events];
  let { battle } = aimed;
  for (let guard = 0; guard < 20 && battle.phase.kind === 'heroStrike'; guard += 1) {
    const update = advance(battle, nextDeadline(battle)!.at + 1);
    battle = update.battle;
    events.push(...update.events);
  }
  return { battle, events };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  afterEach(cleanup);

  // --- Un coup renforcé ---

  given(/^un Porte-cierge debout en première ligne$/u, () => {
    world = { battle: lineBattle(['candleBearer', 'ghoul']) } as World;
  });

  and(/^une Goule dont le coup simple fait (\d+)$/u, (damage) => {
    world.battle = withAttack(world.battle, 1, 'basic', Number(damage));
  });

  when(/^la Goule porte son coup$/u, () => {
    world.blow = untilBlow(world.battle, 1);
    world.played = untilImpact(world.blow.battle);
  });

  then(/^il fait (\d+) dégâts avant la défense du héros$/u, (damage) => {
    expect(world.blow.step.damage).toBe(Number(damage));
    expect(world.blow.windUp.aura).toBe(1);
    expect(battleView(world.blow.battle).enemies[1]!.auraBoost).toBe(true);
  });

  and(/^le chiffre de dégâts porte une petite flamme$/u, () => {
    const { heroFloat } = displayed(world.played);
    expect(heroFloat?.float).toMatchObject({ at: 'hero', kind: 'damage', aura: true });
    expect(announced(world.played)).toContainEqual(
      expect.stringMatching(/^Touché, \d+ dégâts, aura du Porte-cierge$/u),
    );
  });

  // --- Étourdi, l'Aura reste ---

  given(/^un Porte-cierge dont la garde est brisée$/u, () => {
    world = {
      battle: lineBattle(['ghoul', 'candleBearer'], (_, index) =>
        index === 1 ? { stun: STUNNED, guard: 0 } : {},
      ),
    } as World;
  });

  when(/^un allié porte un coup pendant qu'il est étourdi$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 5), 0);
    expect(world.blow.battle.enemies[1]!.stun).not.toBeNull();
  });

  then(/^ce coup est renforcé de 20 %, au moins \+1$/u, () => {
    expect(world.blow.step.damage).toBe(6);
    expect(world.blow.windUp.aura).toBe(1);
  });

  and(/^la lueur du cierge et les « \+20 % » des alliés restent affichés$/u, () => {
    const { enemies } = battleView(world.blow.battle);
    // La ligne du pouce, à la phase du héros, le Porte-cierge étourdi pour cible (C3).
    const { line } = battleView({ ...world.battle, target: 1 });
    expect(enemies[1]).toMatchObject({ stunned: true, auraGlow: 'lit' });
    expect(enemies[1]!.signature).toMatchObject({ text: 'Aura +20 %', off: false });
    expect(enemies[0]!.auraBoost).toBe(true);
    expect(line?.after).toContain('étourdi, son aura brûle encore');
  });

  // --- L'Aura s'éteint ---

  given(/^un Porte-cierge debout et une Goule dont le coup simple fait (\d+)$/u, (damage) => {
    world = {
      battle: withAttack(
        lineBattle(['candleBearer', 'ghoul'], (_, index) => (index === 0 ? { hp: 5 } : {})),
        1,
        'basic',
        Number(damage),
      ),
    } as World;
    expect(battleView(world.battle).enemies[1]!.auraBoost).toBe(true);
  });

  when(/^le Porte-cierge tombe$/u, () => {
    world.played = heroStrikes(world.battle);
    expect(world.played.events).toContainEqual(
      expect.objectContaining({ type: 'enemyDefeated', enemy: 0 }),
    );
    world.display = displayed(world.played);
  });

  then(
    /^le mot de scène « L'aura s'éteint » s'affiche et les « \+20 % » des alliés se barrent puis disparaissent$/u,
    async () => {
      expect(world.display.feedback?.texts.map(({ title }) => plain(title))).toEqual([
        "L'aura s'éteint",
      ]);
      expect(world.display.auraOut).toMatchObject({ enemies: [1] });
      expect(world.display.candleFalls).toHaveProperty('0');
      expect(battleView(world.played.battle).enemies[1]).not.toHaveProperty('auraBoost');
      jest.useFakeTimers();
      try {
        await render(<AuraBoostChip kind="ghoul" out reducedMotion={false} />);
        const chip = StyleSheet.flatten(screen.getByText('+20 %', hiddenToo).props.style);
        expect(chip).toMatchObject({ textDecorationLine: 'line-through' });
        await act(async () => {
          jest.advanceTimersByTime(400);
        });
        expect(screen.queryByText('+20 %', hiddenToo)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  and(/^le lecteur d'écran annonce « Porte-cierge tombe. L'aura s'éteint »$/u, () => {
    expect(announced(world.played)).toContain("Porte-cierge tombe. L'aura s'éteint");
  });

  and(/^le coup suivant de la Goule fait (\d+)$/u, (damage) => {
    const next = untilBlow(world.played.battle, 1);
    expect(next.step.damage).toBe(Number(damage));
    expect(next.windUp).not.toHaveProperty('aura');
  });

  // --- Un renfort sous l'Aura ---

  when(/^un ennemi de la réserve entre en renfort$/u, () => {
    world.battle = lineBattle(['candleBearer', 'ghoul', 'ghoul', 'ghoul'], (_, index) =>
      index > 0 ? { hp: 0 } : {},
    );
    expect(world.battle.reserve).toEqual(['ghoul']);
    world.blow = untilBlow(world.battle, 1);
    expect(world.blow.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', enemy: 1, kind: 'ghoul' }),
    );
  });

  then(/^il porte « \+20 % » sur sa plaque et ses coups sont renforcés$/u, () => {
    const entered = battleView(world.blow.battle).enemies[1]!;
    expect(entered.auraBoost).toBe(true);
    expect(entered.label).toContain('aura du Porte-cierge, +20 % de dégâts');
    expect(world.blow.windUp.aura).toBeGreaterThanOrEqual(1);
    expect(announced({ battle: world.blow.battle, events: world.blow.events })).toContain(
      'Renfort : Goule. Aura du Porte-cierge, +20 % de dégâts',
    );
  });

  // --- Seul debout ---

  given(/^un Porte-cierge seul debout en première ligne, la réserve vide$/u, () => {
    world = {
      battle: lineBattle(['candleBearer', 'ghoul', 'cryptRat'], (_, index) =>
        index === 0 ? {} : { hp: 0 },
      ),
    } as World;
    expect(world.battle.reserve).toEqual([]);
  });

  then(/^sa marque de signature est « Aura · seul », grisée$/u, async () => {
    const view = battleView(world.battle).enemies[0]!;
    expect(view.signature).toMatchObject({ text: 'Aura · seul', off: true });
    expect(view.auraGlow).toBe('out');
    await render(<SignatureMark signature={view.signature!} testID="mark" />);
    expect(
      StyleSheet.flatten(screen.getByText('Aura · seul', hiddenToo).props.style),
    ).toMatchObject({ color: battleColors.signatureOff });
  });
};

// L'écran seul : `@domain` passe par le moteur, `@session` par la session.
const feature = loadFeature('features/catacombes-aura-nuee.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
