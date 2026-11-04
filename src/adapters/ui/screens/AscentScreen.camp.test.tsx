// L'écran de fin d'ascension et le camp (#40, C11) : « Aller au camp » sous « Retour au pied de la
// tour » après une chute, un abandon ou le Sommet ; le bilan garde le Total d'Éclats.
import { fireEvent, screen } from '@testing-library/react-native';

import { abandonAscent, startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { Unlock } from '../../../domain/ascent/unlocks';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { AscentScreen } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

async function show(
  saved: Ascent,
  { camp = true, shards, unlocks }: { camp?: boolean; shards?: number; unlocks?: Unlock[] },
) {
  const setUp = ascentSetUp({
    saved,
    ...(shards !== undefined && { shards }),
    ...(unlocks !== undefined && { unlocks }),
  });
  await setUp.session.load();
  const onLeave = jest.fn();
  const onCamp = jest.fn();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={onLeave}
      {...(camp && { onCamp })}
    />,
    setUp.dependencies,
  );
  return { ...setUp, onLeave, onCamp };
}

const fall: Ascent = { ...startAscent(42), encounter: null, outcome: 'fall' };
const summit: Ascent = {
  ...startAscent(42),
  tier: 3,
  floor: 6,
  encounter: null,
  outcome: 'victory',
};

describe('« Aller au camp » at the end of the ascent (#40, C11)', () => {
  it.each([
    ['a fall', fall],
    ['an abandon', abandonAscent(startAscent(42))],
    ['the Summit', summit],
  ])('is offered after %s, under « Retour au pied de la tour »', async (_, saved) => {
    await show(saved, {});

    const buttons = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(buttons.indexOf('Aller au camp')).toBe(buttons.indexOf('Retour au pied de la tour') + 1);
  });

  it('leaves the end of the ascent, then opens the camp, where no ascent is in progress', async () => {
    const { session, camp, onCamp, onLeave } = await show(fall, {});

    await fireEvent.press(screen.getByRole('button', { name: 'Aller au camp' }));

    expect(onCamp).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    expect(session.current()).toBeNull();
    expect(camp.view().ascentInProgress).toBe(false);
  });

  it('keeps the Shard total on the end screen, even after Shards spent at the camp', async () => {
    await show(fall, { shards: 82, unlocks: ['huntingSpear'] });

    expect(screen.getByText('Total : 82 Éclats')).toBeOnTheScreen();
  });

  it('offers no camp without a way to open it', async () => {
    await show(fall, { camp: false });

    expect(screen.queryByRole('button', { name: 'Aller au camp' })).not.toBeOnTheScreen();
  });
});
