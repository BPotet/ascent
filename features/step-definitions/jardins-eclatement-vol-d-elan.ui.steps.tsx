/**
 * « Les Jardins de cendre, l'Éclatement et le Vol d'Élan » (#267) par l'interface : un combat du
 * palier 2 joué par le domaine, puis ce que l'écran en montre, en dit et en fait entendre : la vue
 * du combat (`battleView`), l'état d'affichage (`displayOf`), les annonces au lecteur d'écran
 * (`announcementsFor`), les sons (`feedbackFor`), l'étiquette de la Brûlure (`BurnChip`), la marque
 * de signature (`SignatureMark`), les flammes de l'Éclatement et le losange volé.
 */
import { cleanup, render, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { StyleSheet } from 'react-native';

import { feedbackFor } from '../../src/application/useCases/battleFeedback';
import { EmberFlames, StolenMomentum } from '../../src/adapters/ui/battle/AshGardensEffects';
import { BurnChip } from '../../src/adapters/ui/battle/BurnChip';
import { SignatureMark } from '../../src/adapters/ui/battle/SignatureMark';
import { announcementsFor } from '../../src/adapters/ui/format/battleText';
import { powerStateText } from '../../src/adapters/ui/format/powerText';
import { battleView } from '../../src/adapters/ui/state/battleView';
import {
  INITIAL_DISPLAY,
  displayOf,
  momentumShown,
  type BattleDisplay,
} from '../../src/adapters/ui/state/useBattleDisplay';
import { battleColors } from '../../src/adapters/ui/theme/battleColors';
import type { Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import {
  STUNNED,
  SUFFERED,
  blowOf,
  defend,
  eventsOf,
  gardensBattle,
  playUntil,
  strike,
  toHeroPhase,
  type Played,
} from '../support/ashGardensStory';

interface World {
  burn: number | undefined;
  momentum: number;
  battle: Battle;
  played: Played;
  display: BattleDisplay;
}

let world = {} as World;

const hiddenToo = { includeHiddenElements: true } as const;
/** Les apostrophes droites du scénario et les apostrophes typographiques de l'écran se valent. */
const plain = (text: string) => text.replaceAll('’', "'");

/** Ce que l'écran tire d'une mise à jour : son état d'affichage. */
const displayed = ({ battle, events }: Played): BattleDisplay =>
  displayOf(INITIAL_DISPLAY, { battle, events, heroHint: false, powersHint: false }, false);

const announced = ({ battle, events }: Played) => announcementsFor(events, battle).map(plain);
const sounds = (events: readonly BattleEvent[]) => events.map((event) => feedbackFor(event).sound);
const words = (display: BattleDisplay) => display.feedback?.texts.map(({ title }) => title) ?? [];

/** Une Cosse de braise à abattre (place 0), le héros avec ses charges de Brûlure. */
function pod(change: Parameters<typeof gardensBattle>[0]['change'] = {}, others?: never[]) {
  return gardensBattle({
    first: 'emberPod',
    change,
    ...(world.burn !== undefined && { heroState: { burn: world.burn } }),
    ...(others !== undefined && { others }),
  });
}

/** Le héros prend les 2 charges de l'Éclatement à la chute de la Cosse, dans la même mise à jour. */
function expectBurstAt(played: Played, stacks: number) {
  const [fallen] = eventsOf(played.events, 'enemyDefeated');
  expect(eventsOf(played.events, 'heroBurning')).toEqual([
    expect.objectContaining({ at: fallen!.at, cause: 'emberBurst', enemy: 0, stacks }),
  ]);
  expect(played.battle.hero.burn).toBe(stacks);
}

/** L'Éclatement se voit (« Elle éclate », 2 flammes, l'étiquette cerclée) et s'entend. */
async function expectBurstShownAndHeard(played: Played, stacks: number) {
  const display = displayed(played);
  expect(words(display)).toContain('Elle éclate');
  expect(display.feedback?.texts).toContainEqual(
    expect.objectContaining({ title: 'Elle éclate', sub: `Brûlure ×${stacks}` }),
  );
  expect(display.emberFlames).toMatchObject({ enemy: 0 });
  expect(display.burnRing?.kind).toBe('new');
  expect(sounds(played.events)).toContain('emberBurst');
  await render(
    <EmberFlames
      from={{ x: 300, y: 100 }}
      to={{ x: 80, y: 260 }}
      delayMs={display.emberFlames!.delayMs}
      reducedMotion={false}
    />,
  );
  expect(screen.getAllByTestId('battle-ember-flame', hiddenToo)).toHaveLength(2);
  await cleanup();
  await render(<BurnChip stacks={played.battle.hero.burn!} ring={display.burnRing} />);
  expect(screen.getByText(`Brûlure ×${stacks}`, hiddenToo)).toBeOnTheScreen();
  expect(
    StyleSheet.flatten(screen.getByTestId('battle-burn-chip', hiddenToo).props.style),
  ).toMatchObject({ borderWidth: 2, borderColor: battleColors.burnRing });
  await cleanup();
}

/** Le coup de la Phalène voleuse (place 0) reçu sans défense, le héros à `momentum` Élan. */
function mothBlow(momentum: number): Played {
  return defend(blowOf(gardensBattle({ first: 'thievingMoth' }), { hero: { momentum } }), SUFFERED);
}

const signatureOf = (battle: Battle) => battleView(battle).enemies[0]!.signature!;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La Cosse de braise ---

  given(/^le héros avec (\d) charges? de Brûlure$/u, (stacks) => {
    world = { burn: Number(stacks) } as World;
  });

  and(/^une Cosse de braise non étourdie, avec 2 autres ennemis encore debout$/u, () => {
    world.battle = pod();
    expect(world.battle.enemies.filter((enemy) => enemy.hp > 0)).toHaveLength(3);
  });

  given(/^une Cosse de braise étourdie$/u, () => {
    world = { burn: undefined } as World;
    world.battle = pod({ stun: STUNNED, guard: 0 });
  });

  given(/^une Cosse de braise non étourdie, dernier ennemi debout, la réserve vide$/u, () => {
    world = { burn: undefined } as World;
    world.battle = pod({}, []);
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.battle.reserve).toEqual([]);
  });

  when(/^une frappe la fait tomber$/u, () => {
    world.played = strike(world.battle);
    expect(eventsOf(world.played.events, 'enemyDefeated')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
  });

  then(/^elle éclate et le héros prend 2 charges de Brûlure, sur-le-champ$/u, () => {
    expectBurstAt(world.played, (world.burn ?? 0) + 2);
    expect(eventsOf(world.played.events, 'heroBurning')[0]).toMatchObject({ added: 2 });
  });

  and(/^il a (\d) charges de Brûlure$/u, (stacks) => {
    expect(world.played.battle.hero.burn).toBe(Number(stacks));
  });

  and(
    /^le mot de scène « Elle éclate » s'affiche, 2 flammes volent vers le héros et l'étiquette « Brûlure ×(\d) » est cerclée$/u,
    async (stacks) => {
      await expectBurstShownAndHeard(world.played, Number(stacks));
    },
  );

  and(
    /^au début de la manche suivante il perd (\d) PV, puis passe à (\d) charges$/u,
    (loss, left) => {
      const hp = world.played.battle.hero.hp;
      const next = playUntil(world.played, (events) =>
        events.some((event) => event.type === 'burnTicked'),
      );
      expect(eventsOf(next.events, 'burnTicked')).toEqual([
        expect.objectContaining({ loss: Number(loss), heroHp: hp - Number(loss) }),
      ]);
      expect(next.battle.hero.burn).toBe(Number(left));
    },
  );

  then(/^elle s'éteint en fumée, sans Brûlure pour le héros$/u, () => {
    expect(eventsOf(world.played.events, 'emberBurstSmothered')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
    expect(eventsOf(world.played.events, 'heroBurning')).toEqual([]);
    expect(world.played.battle.hero.burn).toBeUndefined();
    world.display = displayed(world.played);
    expect(world.display.podFalls[0]).toMatchObject({ kind: 'smothered' });
    expect(world.display.emberFlames).toBeNull();
    expect(sounds(world.played.events)).toContain('emberSmother');
    expect(sounds(world.played.events)).not.toContain('emberBurst');
  });

  and(/^le mot de scène « (Éteinte) » s'affiche$/u, (title) => {
    expect(words(world.display)).toContain(title);
    expect(words(world.display)).not.toContain('Elle éclate');
  });

  and(/^le lecteur d'écran annonce « (.+) »$/u, (sentence) => {
    expect(announced(world.played)).toContain(sentence);
  });

  when(/^une (?:autre )?Cosse de braise non étourdie tombe$/u, () => {
    world.played = strike(pod());
  });

  then(/^le héros a (\d) charges de Brûlure$/u, (stacks) => {
    expectBurstAt(world.played, Number(stacks));
  });

  and(/^l'Éclatement se voit et s'entend quand même$/u, async () => {
    await expectBurstShownAndHeard(world.played, 5);
  });

  then(/^il reste à 5 charges, et l'Éclatement se voit et s'entend$/u, async () => {
    expectBurstAt(world.played, 5);
    expect(eventsOf(world.played.events, 'heroBurning')[0]).toMatchObject({ added: 0 });
    await expectBurstShownAndHeard(world.played, 5);
  });

  then(/^le combat est gagné et le héros ne prend aucune charge de Brûlure$/u, () => {
    expect(eventsOf(world.played.events, 'battleEnded')).toEqual([
      expect.objectContaining({ outcome: 'victory' }),
    ]);
    expect(eventsOf(world.played.events, 'heroBurning')).toEqual([]);
    expect(world.played.battle.hero.burn).toBeUndefined();
  });

  and(/^aucun Éclatement n'est montré$/u, () => {
    const display = displayed(world.played);
    expect(words(display)).not.toContain('Elle éclate');
    expect(words(display)).not.toContain('Éteinte');
    expect(display.emberFlames).toBeNull();
    expect(display.podFalls).toEqual({});
    expect(sounds(world.played.events)).not.toContain('emberBurst');
    expect(announced(world.played).join(' ')).not.toContain('éclate');
  });

  // --- Le prix de la Cosse ---

  given(/^une Cosse de braise non étourdie$/u, () => {
    world = { burn: undefined } as World;
    world.battle = pod({ hp: 45 });
  });

  then(/^sa marque de signature est « Braises 2 »$/u, async () => {
    expect(signatureOf(world.battle)).toMatchObject({ text: 'Braises 2', off: false });
    await render(<SignatureMark signature={signatureOf(world.battle)} />);
    const text = StyleSheet.flatten(screen.getByText('Braises 2', hiddenToo).props.style);
    expect(text.textDecorationLine).toBeUndefined();
    expect(text.color).toBe(battleColors.onBurn);
    await cleanup();
  });

  when(/^sa garde est brisée$/u, () => {
    world.played = strike({
      ...world.battle,
      enemies: world.battle.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, guard: 1 } : enemy,
      ),
    });
    expect(eventsOf(world.played.events, 'guardBroken')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
  });

  then(/^la marque « Braises 2 » est barrée et grisée tant qu'elle est étourdie$/u, async () => {
    const stunned = toHeroPhase(world.played);
    expect(stunned.battle.enemies[0]!.stun).not.toBeNull();
    for (const battle of [world.played.battle, stunned.battle]) {
      expect(signatureOf(battle)).toMatchObject({ text: 'Braises 2', off: true });
    }
    await render(<SignatureMark signature={signatureOf(stunned.battle)} />);
    expect(StyleSheet.flatten(screen.getByText('Braises 2', hiddenToo).props.style)).toMatchObject({
      textDecorationLine: 'line-through',
      color: battleColors.signatureOff,
    });
    await cleanup();
    world.played = stunned;
  });

  when(/^elle fait son retour en garde$/u, () => {
    // Le héros frappe un autre ennemi : la Cosse se relève à son tour.
    const elsewhere = strike({ ...world.played.battle, target: 1 });
    world.played = playUntil(elsewhere, (events) =>
      events.some((event) => event.type === 'guardRestored' && event.enemy === 0),
    );
    expect(eventsOf(world.played.events, 'guardRestored')).toContainEqual(
      expect.objectContaining({ enemy: 0 }),
    );
  });

  then(/^la marque « Braises 2 » revient$/u, () => {
    expect(world.played.battle.enemies[0]!.stun).toBeNull();
    expect(signatureOf(world.played.battle)).toMatchObject({ text: 'Braises 2', off: false });
  });

  // --- Le Vol d'Élan ---

  given(/^le héros avec (\d) Élan$/u, (momentum) => {
    world = { momentum: Number(momentum) } as World;
  });

  when(/^un impact de la Phalène voleuse le touche(?: sans défense)?$/u, () => {
    world.played = mothBlow(world.momentum);
  });

  then(/^il subit les dégâts, puis perd 1 Élan et passe à 2 Élan$/u, () => {
    const { events } = world.played;
    const [blow] = eventsOf(events, 'blowResolved');
    const [stolen] = eventsOf(events, 'momentumStolen');
    expect(blow).toMatchObject({ outcome: 'suffered' });
    expect(blow!.damage).toBeGreaterThan(0);
    expect(events.indexOf(stolen!)).toBeGreaterThan(events.indexOf(blow!));
    expect(stolen).toMatchObject({ enemy: 0, stolen: 1, momentum: 2 });
    expect(world.played.battle.hero.momentum).toBe(2);
  });

  and(
    /^un losange d'or quitte sa barre d'Élan et file vers la Phalène, avec le mot « −1 Élan »$/u,
    async () => {
      const display = displayed(world.played);
      expect(display.theft).toMatchObject({ enemy: 0, stolen: 1, delayMs: 300 });
      // La barre baisse avec le losange, pas avant.
      expect(momentumShown(2, display, false)).toBe(3);
      expect(momentumShown(2, display, true)).toBe(2);
      expect(sounds(world.played.events)).toContain('momentumSteal');
      await render(
        <StolenMomentum
          from={{ x: 80, y: 260 }}
          to={{ x: 300, y: 100 }}
          stolen={display.theft!.stolen}
          delayMs={display.theft!.delayMs}
          reducedMotion={false}
        />,
      );
      expect(screen.getByTestId('battle-stolen-diamond', hiddenToo)).toBeOnTheScreen();
      expect(StyleSheet.flatten(screen.getByText('−1 Élan', hiddenToo).props.style)).toMatchObject({
        color: battleColors.steal,
      });
      await cleanup();
    },
  );

  and(/^le lecteur d'écran annonce les dégâts, puis « (.+) »$/u, (theft) => {
    const [blow] = eventsOf(world.played.events, 'blowResolved');
    const said = announced(world.played);
    const damage = said.indexOf(`Touché, ${blow!.damage} dégâts`);
    expect(damage).toBeGreaterThanOrEqual(0);
    expect(said[damage + 1]).toBe(theft);
  });

  then(/^il subit les dégâts et reste à 0 Élan$/u, () => {
    expect(eventsOf(world.played.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered' }),
    ]);
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([]);
    expect(world.played.battle.hero.momentum).toBe(0);
  });

  and(/^aucun losange ni aucun mot « −1 Élan » ne s'affiche$/u, () => {
    const display = displayed(world.played);
    expect(display.theft).toBeNull();
    expect(momentumShown(0, display, false)).toBe(0);
    expect(sounds(world.played.events)).not.toContain('momentumSteal');
  });

  and(/^le lecteur d'écran n'annonce rien de plus que les dégâts$/u, () => {
    const [blow] = eventsOf(world.played.events, 'blowResolved');
    const said = announced(world.played);
    expect(said).toContain(`Touché, ${blow!.damage} dégâts`);
    expect(said.join(' ')).not.toContain('Élan');
  });

  given(/^le héros à qui la Phalène voleuse a volé l'Élan d'un pouvoir$/u, () => {
    world = {} as World;
    world.played = mothBlow(1);
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([
      expect.objectContaining({ momentum: 0 }),
    ]);
  });

  when(/^vient sa phase du héros$/u, () => {
    world.played = toHeroPhase(world.played);
    expect(world.played.battle.phase.kind).toBe('hero');
  });

  then(/^la touche de ce pouvoir est grisée et dit « (.+) », comme aujourd'hui$/u, (said) => {
    const { pad } = battleView(world.played.battle);
    if (pad.kind !== 'hero') throw new Error('Not the hero phase');
    const bulwark = pad.powers.find(({ power }) => power === 'bulwark')!;
    expect(bulwark).toMatchObject({ availability: 'missing', missing: 1 });
    expect(powerStateText(bulwark)).toBe(said);
  });
};

// L'interface seule : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/jardins-eclatement-vol-d-elan.feature');
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
