/**
 * « La Brûlure » (#171) par la session de combat : les trois sons de la Brûlure, joués à leur
 * instant sur l'horloge de combat manuelle (le souffle de flamme par-dessus le touché ou la parade,
 * le crépitement, l'extinction d'une flamme 80 ms après la parade ou 400 ms après le crépitement).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { BattleSoundCue } from '../../src/application/ports/BattleSound';
import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  battleWith,
  enemyWith,
  heroWith,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { BattleSession } from '../../src/application/useCases/BattleSession';
import { ATTACKS } from '../../src/domain/battle/attacks';
import type { DefenseButton } from '../../src/domain/battle/BattleEvent';

interface Played {
  readonly cue: BattleSoundCue;
  readonly at: number;
}

/** Les ennemis 1 et 2 du combat de test restent étourdis ; la Goule aussi avec `all`. */
const STUNNED = { stun: { actionLost: false, heroAction: 999 } };

/** La Goule porte un coup simple qui brûle d'une charge. */
const burningBlow = enemyWith(0, {
  guard: 99,
  intent: {
    category: 'attack',
    attack: 'basic',
    damage: 5,
    windUpMs: ATTACKS.basic.windUpMs,
    feintFraction: 0.5,
    burn: 1,
  },
});

/** Une session de combat sur l'horloge manuelle ; les sons sont notés avec leur instant. */
async function session(...changes: readonly BattleChange[]) {
  const clock = new ManualBattleClock(1_000);
  const sound = silentBattleSound();
  const played: Played[] = [];
  const values = new Map([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  const battleSession = new BattleSession(
    {
      clock,
      seeds: new FixedSeedSource(5, 6),
      sound: { ...sound, play: (cue) => void played.push({ cue, at: clock.now() }) },
      haptics: silentBattleHaptics(),
      keyValueStore: {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => void values.set(key, value),
        remove: async (key) => void values.delete(key),
      },
    },
    {
      createBattle: battleWith(enemyWith(1, STUNNED), enemyWith(2, STUNNED), ...changes),
    },
  );
  await battleSession.start();
  return { clock, played, battleSession };
}

type Session = Awaited<ReturnType<typeof session>>;

/** Rejoue jusqu'à `done` : le héros attaque à son tour, chaque impact reçoit `defense`. */
type Defense = { readonly button: DefenseButton; readonly offset: number } | null;

function playUntil(
  { clock, battleSession }: Session,
  done: () => boolean,
  defense: Defense = null,
): void {
  for (let guard = 0; guard < 200 && !done(); guard += 1) {
    const { phase } = battleSession.current()!.battle;
    const impact =
      phase.kind === 'enemy' && phase.step.kind === 'attack'
        ? phase.step.impacts.find((candidate) => candidate.outcome === null)
        : undefined;
    if (phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else if (defense !== null && impact !== undefined && clock.now() < impact.at) {
      const at = impact.at + defense.offset;
      clock.advanceTo(at);
      battleSession.pressDefense(defense.button, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
  }
  if (!done()) throw new Error('The battle never reached the expected state');
}

const cues = (played: readonly Played[]) => played.map(({ cue }) => cue);
const has = (context: Session, cue: BattleSoundCue) => () => cues(context.played).includes(cue);

let world: { touched: Session[]; round: Session | null };

const steps: StepDefinitions = ({ given, when, then }) => {
  given('la Brûlure ne touche que le héros', () => {
    world = { touched: [], round: null };
  });

  when('un coup qui brûle touche le héros', async () => {
    // Un coup reçu, puis une bonne parade.
    for (const defense of [null, { button: 'parry', offset: 100 }] as const) {
      const context = await session(burningBlow);
      playUntil(context, has(context, 'flameBreath'), defense);
      world.touched.push(context);
    }
  });

  then('un souffle de flamme court se joue par-dessus le son du touché ou de la parade', () => {
    const [hit, parry] = world.touched.map(({ played }) => played);
    for (const [played, under] of [
      [hit!, 'hit'],
      [parry!, 'parry'],
    ] as const) {
      const breath = played.findIndex(({ cue }) => cue === 'flameBreath');
      expect(played[breath - 1]).toEqual({ cue: under, at: played[breath]!.at });
    }
  });

  when('une manche commence et que le héros brûle', async () => {
    const context = await session(heroWith({ burn: 2 }), enemyWith(0, STUNNED));
    playUntil(context, has(context, 'burnCrackle'));
    world.round = context;
  });

  then('le feu crépite', () => {
    expect(cues(world.round!.played)).toContain('burnCrackle');
    expect(cues(world.round!.played)).not.toContain('burnOut');
  });

  when("une flamme s'éteint, par la manche, une parade parfaite ou une esquive", async () => {
    const { clock } = world.round!;
    clock.advanceTo(clock.now() + 400);
    for (const button of ['parry', 'dodge'] as const) {
      const context = await session(burningBlow, heroWith({ burn: 2 }));
      playUntil(
        context,
        () =>
          context.battleSession.current()!.events.some(({ type }) => type === 'burnExtinguished'),
        { button, offset: 0 },
      );
      context.clock.advanceTo(context.clock.now() + 80);
      world.touched.push(context);
    }
  });

  then("le son d'extinction se joue", () => {
    const { played } = world.round!;
    const crackle = played.find(({ cue }) => cue === 'burnCrackle')!;
    expect(played.find(({ cue }) => cue === 'burnOut')).toEqual({
      cue: 'burnOut',
      at: crackle.at + 400,
    });
    for (const { played: byBlow } of world.touched.slice(2)) {
      const defended = byBlow.find(({ cue }) => cue === 'perfectParry' || cue === 'dodge')!;
      expect(byBlow.find(({ cue }) => cue === 'burnOut')).toEqual({
        cue: 'burnOut',
        at: defended.at + 80,
      });
    }
  });
};

const feature = loadFeature('features/brulure.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
