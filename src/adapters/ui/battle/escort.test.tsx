// Les composants de l'Élite escortée (#257, maquette 245, E2, E3, E6, E7, E8, E9) : la couronne
// d'Élite sur la plaque et sur la case de frise, les plaques de 128 et 100 dp, la place vide qui ne
// se touche plus, et le mot « L'escorte reste ».
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

import type { ActionTrackView, EnemyView } from '../state/battleView';
import { ActionTrack } from './ActionTrack';
import { FeedbackLabel } from './BattleEffects';
import { EnemyColumn, enemyGestureTestId } from './EnemyColumn';
import { sceneGeometry } from './scene/sceneGeometry';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

const PILGRIM: EnemyView = {
  kind: 'firstPilgrim',
  name: 'Premier Pèlerin',
  standing: true,
  target: true,
  hpRatio: 1,
  hpText: '237/237 PV',
  guardRatio: 1,
  guardText: 'Garde 82/82',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'attack' },
  active: false,
  dimmed: false,
  tag: null,
  elite: true,
  label: 'Premier Pèlerin, Élite, cible, 237 PV sur 237, garde 82 sur 82, intention : attaque',
};

const { elite: _elite, ...ORDINARY } = PILGRIM;

const NOVICE: EnemyView = {
  ...ORDINARY,
  kind: 'bellNovice',
  name: 'Novice des cloches',
  target: false,
  hpText: '45/45 PV',
  guardText: 'Garde 24/24',
  escort: true,
  label: 'Novice des cloches, 45 PV sur 45, garde 24 sur 24. Touche pour viser',
};

async function renderColumn(view: EnemyView, index: number, count = 3) {
  const onTarget = jest.fn();
  await render(
    <EnemyColumn
      view={view}
      index={index}
      slot={sceneGeometry(360, 440, count, { lead: true }).enemies[index]!}
      sealed={false}
      float={null}
      uiNow={() => 0}
      now={() => 4_321}
      onTarget={onTarget}
    />,
  );
  return { onTarget };
}

/** Un toucher sur toute la colonne de l'ennemi `index`, relâché dessus. */
async function tapColumn(index: number) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(enemyGestureTestId(index)), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
    await Promise.resolve();
  });
}

describe('EnemyColumn of an escorted Elite (#257)', () => {
  it('puts the purple crown of the Elite before its name, on a plate of 128 dp (E2)', async () => {
    await renderColumn(PILGRIM, 0);

    expect(screen.getByTestId('enemy-firstPilgrim-crown', hiddenToo)).toBeOnTheScreen();
    expect(style('enemy-firstPilgrim-plate')).toMatchObject({ maxWidth: 128 });
    expect(screen.getByText('Premier Pèlerin')).toBeOnTheScreen();
  });

  it('gives no crown to an escort enemy, its plate of 100 dp (E7)', async () => {
    await renderColumn(NOVICE, 1, 2);

    expect(screen.queryByTestId('enemy-bellNovice-crown', hiddenToo)).toBeNull();
    expect(style('enemy-bellNovice-plate')).toMatchObject({ maxWidth: 100 });
  });

  it('keeps the plate of an ordinary enemy as wide as its column', async () => {
    const { escort: _escort, ...ordinary } = NOVICE;
    await renderColumn(ordinary, 1);

    expect(style('enemy-bellNovice-plate').maxWidth).toBeUndefined();
  });

  it('adds the curse tag to the crown, without taking it (E6)', async () => {
    await renderColumn({ ...PILGRIM, curse: 'Maudit' }, 0);

    expect(screen.getByTestId('enemy-firstPilgrim-crown', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('Maudit')).toBeOnTheScreen();
  });

  it('aims at an escort enemy with a touch anywhere on its column (E3)', async () => {
    const { onTarget } = await renderColumn(NOVICE, 1);

    await tapColumn(1);

    expect(onTarget).toHaveBeenCalledWith(1, 0, 0);
  });

  it('never aims at an empty place, by touch or by the screen reader (E9)', async () => {
    const { onTarget } = await renderColumn({ ...PILGRIM, standing: false, target: false }, 0);

    await tapColumn(0);
    await fireEvent(screen.getByTestId('enemy-firstPilgrim', hiddenToo), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onTarget).not.toHaveBeenCalled();
  });
});

describe('the crown of the Elite in the action track (#257, E2, E6)', () => {
  const track = (crowned: boolean, cursed = false): ActionTrackView => ({
    round: 1,
    current: [
      { actor: 'hero', fighter: 'sentinel', phase2: false },
      {
        actor: 0,
        fighter: 'firstPilgrim',
        phase2: false,
        ...(crowned && { crowned: true as const }),
        ...(cursed && { cursed: true as const }),
      },
      { actor: 1, fighter: 'bellNovice', phase2: false },
    ],
    next: [],
  });

  it('crowns the entry of the Elite while it is escorted, and only it', async () => {
    await render(<ActionTrack track={track(true)} />);

    expect(screen.getAllByTestId('track-crown', hiddenToo)).toHaveLength(1);
  });

  it('shows the crown and the skull together on a cursed Elite (E6)', async () => {
    await render(<ActionTrack track={track(true, true)} />);

    expect(screen.getByTestId('track-crown', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('track-cursed-skull', hiddenToo)).toBeOnTheScreen();
  });

  it('takes the crown off the track once the Elite is alone (E8)', async () => {
    await render(<ActionTrack track={track(false)} />);

    expect(screen.queryByTestId('track-crown', hiddenToo)).toBeNull();
  });
});

describe("« L'escorte reste » (#257, E9)", () => {
  it('shows the word in gold, with its line, over the scene', async () => {
    await render(
      <FeedbackLabel
        texts={[
          {
            tone: 'escort',
            title: "L'escorte reste",
            sub: "Le combat continue jusqu'à la chute de tous",
          },
        ]}
      />,
    );

    expect(screen.getByText("L'escorte reste", hiddenToo)).toBeOnTheScreen();
    expect(
      screen.getByText("Le combat continue jusqu'à la chute de tous", hiddenToo),
    ).toBeOnTheScreen();
  });
});
