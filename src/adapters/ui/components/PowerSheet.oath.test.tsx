// Le cadre « Serment » de la fiche d'un pouvoir (#237, maquette 232 : S1, S4, S5, S6, S14).
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { artPalette } from '../pixelArt/artPalette';
import { PowerSheet, type SheetOath } from './PowerSheet';

const { roles } = artPalette;

async function open(code: PowerKind, oath: SheetOath | undefined) {
  const onSwear = jest.fn();
  await render(
    <PowerSheet
      code={code}
      state={{ kind: code === 'bulwark' || code === 'shadowStep' ? 'base' : 'unlocked' }}
      availableShards={20}
      ascentInProgress={false}
      readOnly={false}
      error={false}
      oath={oath}
      onSwear={onSwear}
      onUnlock={jest.fn()}
      onSee={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  return { onSwear };
}

const frame = () => within(screen.getByTestId('oath-frame'));

describe('the Oath in the sheet of a power (#237)', () => {
  it('invites to swear on an unlocked power of 2 Momentum (S1)', async () => {
    const { onSwear } = await open('retaliation', { kind: 'none' });

    expect(screen.getByText('Serment')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Lie une habitude à ce pouvoir. Si tu l'as faite la veille, il est attisé : 1 Élan au lieu de 2, pour toute l'ascension.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Prêter serment : lier une habitude à Représailles' }),
    );
    expect(onSwear).toHaveBeenCalled();
  });

  it('names the habit and says the Oath counts from tomorrow, framed in blue (S4)', async () => {
    await open('retaliation', { kind: 'sworn', habit: 'Courir 20 minutes', standing: 'fresh' });

    expect(frame().getByText('« Courir 20 minutes »')).toBeOnTheScreen();
    expect(screen.getByTestId('oath-frame')).toHaveProp(
      'accessibilityLabel',
      "Serment : Courir 20 minutes. Le Serment compte dès demain : fais « Courir 20 minutes » aujourd'hui, et Représailles sera attisé à ta prochaine ascension demain.",
    );
    expect(StyleSheet.flatten(screen.getByTestId('oath-frame').props.style).borderColor).toBe(
      roles.blue,
    );
    expect(screen.getByRole('button', { name: "Changer d'habitude" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Rompre/ })).not.toBeOnTheScreen();
    expect(screen.getByText('2 Élan')).toBeOnTheScreen();
  });

  it('turns to ember the day after, kindled, with « 2 → 1 Élan » (S5)', async () => {
    await open('retaliation', { kind: 'sworn', habit: 'Courir 20 minutes', standing: 'kept' });

    expect(frame().getByText('Attisé')).toBeOnTheScreen();
    expect(
      frame().getByText(
        "Faite hier : Représailles est attisé (1 Élan) pour toute ascension lancée aujourd'hui.",
      ),
    ).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('oath-frame').props.style).borderColor).toBe(
      roles.ember,
    );
    expect(screen.getByText('2 → 1 Élan')).toBeOnTheScreen();
    expect(screen.getByLabelText('Représailles, attisé, 1 Élan au lieu de 2')).toBeOnTheScreen();
  });

  it('says the habit was not done yesterday, at the normal cost', async () => {
    await open('shadowStep', { kind: 'sworn', habit: 'Lire', standing: 'missed' });

    expect(frame().queryByText('Attisé')).not.toBeOnTheScreen();
    expect(
      frame().getByText(
        "Pas faite hier : Pas de l'ombre coûte 3 Élan aujourd'hui. Fais-la aujourd'hui pour qu'il soit attisé demain.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('3 Élan')).toBeOnTheScreen();
  });

  it('names the habit only while yesterday is being read', async () => {
    await open('retaliation', { kind: 'sworn', habit: 'Courir', standing: null });

    expect(screen.getByTestId('oath-frame')).toHaveProp('accessibilityLabel', 'Serment : Courir');
  });

  it('gives a sentence, without any button, for a power of 1 Momentum (S6)', async () => {
    await open('bulwark', { kind: 'lowCost' });

    expect(
      screen.getByText('Le Serment se prête sur un pouvoir de 2 Élan ou plus.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Prêter serment/ })).not.toBeOnTheScreen();
  });

  it('tells a broken Oath in grey, and lets swear another one (S14)', async () => {
    const { onSwear } = await open('retaliation', { kind: 'broken' });

    expect(frame().getByText('Serment rompu')).toBeOnTheScreen();
    expect(
      frame().getByText('Son habitude a été supprimée. Représailles coûte 2 Élan.'),
    ).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('oath-frame').props.style).borderColor).toBe(
      roles.line,
    );
    expect(screen.getByText('2 Élan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Prêter serment/ }));
    expect(onSwear).toHaveBeenCalled();
  });

  it('has no Oath frame for a power that is not unlocked', async () => {
    await open('retaliation', undefined);

    expect(screen.queryByText('Serment')).not.toBeOnTheScreen();
  });
});
