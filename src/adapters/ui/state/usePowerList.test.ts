// L'ouverture de la liste des pouvoirs en combat (#271) : un état d'interface, qui se ferme de lui-même
// quand la vue du combat quitte la phase du héros déverrouillée, ou quand un pouvoir instantané
// vient d'être lancé ; une fermeture sans lancer rend le focus à « Pouvoirs ».
import { act, renderHook } from '@testing-library/react-native';

import type { ActionPad, PowerSlot } from './battleView';
import { usePowerList } from './usePowerList';

const rend: PowerSlot = {
  power: 'rend',
  cost: 1,
  availability: 'available',
  missing: 0,
  instant: true,
};

const hero = (change: Partial<Extract<ActionPad, { kind: 'hero' }>> = {}): ActionPad => ({
  kind: 'hero',
  locked: false,
  lock: null,
  powers: [rend],
  ...change,
});

async function opened(pad: ActionPad = hero()) {
  const hook = await renderHook(({ pad: shown }: { pad: ActionPad }) => usePowerList(shown), {
    initialProps: { pad },
  });
  await act(() => hook.result.current.toggle());
  expect(hook.result.current.open).toBe(true);
  return hook;
}

describe('usePowerList (#271)', () => {
  it('starts closed, opens on « Pouvoirs » and closes when « Pouvoirs » is touched again', async () => {
    const { result } = await renderHook(() => usePowerList(hero()));
    expect(result.current).toMatchObject({ open: false, focusPowers: false });

    await act(() => result.current.toggle());
    expect(result.current.open).toBe(true);

    await act(() => result.current.toggle());
    expect(result.current).toMatchObject({ open: false, focusPowers: true });
  });

  it('closes without casting on dismiss, and gives the focus back to « Pouvoirs »', async () => {
    const { result } = await opened();

    await act(() => result.current.dismiss());

    expect(result.current).toMatchObject({ open: false, focusPowers: true });
    await act(() => result.current.toggle());
    expect(result.current).toMatchObject({ open: true, focusPowers: false });
  });

  it.each<[string, ActionPad]>([
    ['the phase transition locks the keys', hero({ locked: true, lock: { since: 0, until: 900 } })],
    ['a hero action is resolved', hero({ locked: true })],
    [
      'a power strike begins',
      { kind: 'strike', since: 0, impactAt: 700, resolved: false, power: 'flurry' },
    ],
    ['the enemy phase begins', { kind: 'defense', locked: false, lock: null, offBalance: false }],
    ['the battle is over', { kind: 'none' }],
    ['an instant power was just cast', hero({ instantCast: true })],
  ])('closes by itself when %s, without moving the focus', async (_, next) => {
    const { result, rerender } = await opened();

    await rerender({ pad: next });

    expect(result.current).toMatchObject({ open: false, focusPowers: false });
  });

  it('stays open when the view does not change (a touch ignored by the battle)', async () => {
    const { result, rerender } = await opened();

    await rerender({ pad: hero() });

    expect(result.current.open).toBe(true);
  });

  it('opens again after an instant power, and stays open while it stays cast', async () => {
    const { result, rerender } = await opened();
    await rerender({ pad: hero({ instantCast: true }) });
    expect(result.current.open).toBe(false);

    await act(() => result.current.toggle());
    await rerender({ pad: hero({ instantCast: true }) });

    expect(result.current.open).toBe(true);
  });

  it('never shows the list once the hero phase is left, nor opens it while the keys are locked', async () => {
    const { result, rerender } = await opened();
    await rerender({ pad: { kind: 'defense', locked: false, lock: null, offBalance: false } });
    await rerender({ pad: hero() });
    expect(result.current.open).toBe(false);

    await rerender({ pad: hero({ locked: true }) });
    await act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });
});
