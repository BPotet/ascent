// Le pouvoir attisé au Choix du héros (#237, maquette 232 : S8 et S9) : la case bordée de braise,
// la flamme et « 2 → 1 Élan », et une ligne qui dit pourquoi ; ou, habitude pas faite hier, une
// ligne neutre.
import { screen, within } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { HeroChoiceScreen, type HeroOathLine } from './HeroChoiceScreen';

const { roles } = artPalette;
const hiddenToo = { includeHiddenElements: true } as const;

async function show(lines: readonly HeroOathLine[], kindled: readonly 'retaliation'[] = []) {
  await renderScreen(
    <HeroChoiceScreen
      onStart={jest.fn()}
      onClose={jest.fn()}
      title="Choisir un héros"
      note="Il ne change plus jusqu'à la fin de l'ascension."
      confirmLabel={(hero) => `Continuer avec ${hero}`}
      equipped={{ sentinel: ['bulwark', 'retaliation', 'holdFast'], wanderer: ['shadowStep'] }}
      kindled={{ sentinel: kindled, wanderer: [] }}
      oathLines={{ sentinel: lines, wanderer: [] }}
    />,
    ascentSetUp().dependencies,
  );
}

const card = () => within(screen.getByTestId('hero-choice-sentinel'));

describe('HeroChoiceScreen: the kindled powers (#237)', () => {
  it('borders Retaliation with ember, with the flame and « 2 → 1 Élan », and says why (S8)', async () => {
    await show(
      [
        {
          tone: 'kindled',
          text: "Attisé : « Courir 20 minutes » faite hier. 1 Élan pour toute l'ascension.",
        },
      ],
      ['retaliation'],
    );

    const cell = screen.getByTestId('equipped-power-retaliation');
    expect(within(cell).getByText('2 → 1 Élan')).toBeOnTheScreen();
    expect(cell).toHaveStyle({ borderColor: roles.ember });
    expect(screen.getByTestId('equipped-power-kindled-retaliation', hiddenToo)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('equipped-power-holdFast')).getByText('3 Élan'),
    ).toBeOnTheScreen();
    expect(
      card().getByText("Attisé : « Courir 20 minutes » faite hier. 1 Élan pour toute l'ascension."),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('hero-choice-sentinel').props.accessibilityLabel).toContain(
      'Pouvoirs équipés : Rempart, 1 Élan ; Représailles, attisé, 1 Élan ; Tenir bon, 3 Élan.',
    );
  });

  it('says, without any flame, what to do for tomorrow when the habit was missed (S9)', async () => {
    await show([
      {
        tone: 'muted',
        text: "Serment de Représailles : « Courir 20 minutes » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.",
      },
    ]);

    expect(screen.queryByTestId('equipped-power-kindled-retaliation', hiddenToo)).toBeNull();
    expect(
      within(screen.getByTestId('equipped-power-retaliation')).getByText('2 Élan'),
    ).toBeOnTheScreen();
    expect(card().getByText(/pas faite hier/u)).toBeOnTheScreen();
  });
});
