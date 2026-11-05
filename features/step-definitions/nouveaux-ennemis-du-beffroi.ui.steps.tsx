/**
 * « Les nouveaux ennemis du Beffroi » (#214), la menace lisible, par l'interface :
 * - « prépare son coup signature » : un combat du palier 3 joué par le domaine jusqu'à la
 *   préparation d'Heure pleine, le coup imparable du Jaquemart ;
 * - « le joueur regarde l'ennemi » : la vue du combat (`battleView`), la colonne de l'ennemi
 *   (`EnemyColumn`) et les poses de sa préparation, comme la scène les demande ;
 * - « se reconnaît » : le sceau rouge pulse au-dessus de lui, et ses poses d'Heure pleine sortent
 *   de l'atlas (`battleAtlas`) dans sa palette rouge, égales aux poses recopiées de l'Atelier
 *   (même méthode que `spectre-chevalier-prieur.ui.steps.tsx`).
 */
import { cleanup, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { EnemyColumn } from '../../src/adapters/ui/battle/EnemyColumn';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import { toRgba } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { CLOCK_JACK_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/clockJack';
import {
  RED_FRAMES,
  attackMotion,
  playsRed,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { battleView, type EnemyView } from '../../src/adapters/ui/state/battleView';
import { TIERS } from '../../src/domain/ascent/tiers';
import { ATTACKS } from '../../src/domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
} from '../../src/domain/battle/Battle';
import { ENEMIES } from '../../src/domain/battle/combatants';
import {
  IMPACT,
  WIND_UP_AT,
  atlasCell,
  attackPosesOf,
  attackTimeline,
  copiedPose,
  type AttackShownPose,
} from '../support/fullAnimationStory';

/** La menace lisible du Beffroi (voir **Rôle d'ennemi**), au milieu de son groupe. */
const THREAT = 'clockJack';
const GROUP = ['bellNovice', THREAT, 'matinsRinger'] as const;
const AT = GROUP.indexOf(THREAT);

interface World {
  battle: Battle;
  sealed: number | null;
  shown: AttackShownPose[];
}

let world: World;

/**
 * Le combat du palier 3 joué par le domaine (le héros attaque à chacun de ses tours) jusqu'à ce
 * que le Jaquemart prépare son coup imparable, tiré pour lui.
 */
function windingUpPerilous(): Battle {
  const { battle: started } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: GROUP,
    tierMultiplier: TIERS[3].multiplier,
  });
  let battle: Battle = {
    ...started,
    enemies: started.enemies.map((enemy, index) =>
      index === AT && enemy.intent?.category === 'attack'
        ? { ...enemy, intent: { ...enemy.intent, attack: 'perilous' } }
        : enemy,
    ),
  };
  for (let turn = 0; turn < 100; turn += 1) {
    const { phase } = battle;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack' && phase.step.enemy === AT) {
      return battle;
    }
    const next = nextDeadline(battle)!;
    battle =
      phase.kind === 'hero'
        ? heroAction(battle, {
            action: { kind: 'attack' },
            touchStartedAt: battle.now,
            releasedAt: battle.now,
          }).battle
        : advance(battle, next.awaitsPress ? next.at + 1 : next.at).battle;
  }
  throw new Error('The Clock jack never wound up');
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^la menace du Beffroi prépare son coup signature$/u, () => {
    world = { battle: windingUpPerilous(), sealed: null, shown: [] };
    const { phase } = world.battle;
    expect(phase.kind === 'enemy' && phase.step.kind === 'attack' && phase.step.attack).toBe(
      'perilous',
    );
  });

  when(/^le joueur regarde l'ennemi$/u, async () => {
    world.sealed = battleView(world.battle).sealed;
    world.shown = attackPosesOf(
      attackTimeline('perilous'),
      attackMotion(THREAT),
      WIND_UP_AT,
      IMPACT + 600,
    );
    const enemy = world.battle.enemies[AT]!;
    const view: EnemyView = {
      kind: THREAT,
      name: ENEMY_NAMES[THREAT],
      standing: true,
      target: false,
      hpRatio: 1,
      hpText: `${enemy.hp}/${enemy.maxHp} PV`,
      guardRatio: 1,
      guardText: `Garde ${enemy.guard}/${enemy.maxGuard}`,
      stunned: false,
      losingAction: false,
      rising: null,
      intent: { category: 'attack' },
      active: true,
      dimmed: false,
      tag: null,
      label: `${ENEMY_NAMES[THREAT]}, intention : attaque`,
    };
    await cleanup();
    await render(
      <EnemyColumn
        view={view}
        index={AT}
        slot={sceneGeometry(390, 440, 3).enemies[AT]!}
        sealed={world.sealed === AT}
        reducedMotion={false}
        float={null}
        uiNow={() => 0}
        now={() => 0}
        onTarget={() => undefined}
      />,
    );
  });

  then(
    /^le coup se reconnaît comme le prévoit sa fiche validée \(coup imparable, coup trompeur, ou annonce « Il se relève »\)$/u,
    () => {
      // Sa fiche : Heure pleine, un coup imparable, ni coup trompeur ni « Il se relève ».
      expect(ENEMIES[THREAT].moves).toContainEqual({ attack: 'perilous', damage: 9 });
      expect(ENEMIES[THREAT].moves.some(({ attack }) => ATTACKS[attack].feint)).toBe(false);
      expect(ENEMIES[THREAT].selfRevive).toBeUndefined();
      expect(CLOCK_JACK_ANIMATION.attackPoses.perilous.move).toBe('Heure pleine');

      // Le sceau rouge pulse au-dessus de lui pendant sa préparation.
      expect(world.sealed).toBe(AT);
      const seal = within(screen.getByTestId(`enemy-${THREAT}`)).getByLabelText(
        'Sceau rouge : coup imparable',
      );
      const hidden = { includeHiddenElements: true };
      expect(within(seal).getByTestId('peril-seal-small', hidden).props.sprite).toBe('seal-8');
      expect(within(seal).getByTestId('peril-seal-big', hidden).props.sprite).toBe('seal-10');

      // Ses poses d'Heure pleine sortent de l'atlas dans sa palette rouge, pose pour pose.
      expect(playsRed(THREAT)).toBe(true);
      const reds = world.shown.filter(({ red }) => red);
      expect(reds.map(({ frame }) => frame)).toEqual(
        expect.arrayContaining(['ant0', 'ant1', 'ant2', 'lunge', 'impact', 'rec0']),
      );
      expect(reds.filter(({ poses }) => poses === 'perilous').length).toBeGreaterThan(0);
      for (const { frame, tier, red, poses } of world.shown) {
        const copied = copiedPose(
          CLOCK_JACK_ANIMATION,
          frame,
          red && RED_FRAMES.includes(frame),
          poses,
        );
        expect([frame, tier, red, poses, atlasCell(THREAT, frame, tier, red, poses)]).toEqual([
          frame,
          tier,
          red,
          poses,
          toRgba(copied),
        ]);
      }
    },
  );
};

// La menace lisible par l'interface seule : `@domain` et `@session` passent ailleurs.
const feature = loadFeature('features/nouveaux-ennemis-du-beffroi.feature');
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
