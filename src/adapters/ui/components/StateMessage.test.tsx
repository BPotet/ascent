import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { StateMessage } from './StateMessage';

const hidden = { includeHiddenElements: true };

describe('StateMessage (pixel art)', () => {
  it('shows the character at ×3, a title in the pixel font, a text in the text font and its action', async () => {
    await render(
      <StateMessage
        illustration="character"
        title="Aucune habitude pour l’instant"
        text="Crée ta première habitude."
        action={<Text>Ajouter</Text>}
      />,
    );

    const character = screen.getByTestId('illustration-character', hidden);
    expect(character.props.sprite).toBe('character-0');
    expect(character.props.scale).toBe(3);
    expect(screen.getByText('Aucune habitude pour l’instant')).toHaveStyle({
      fontFamily: pixelFont,
      fontSize: 24,
    });
    expect(screen.getByText('Crée ta première habitude.')).toHaveStyle({
      fontFamily: textFont.regular,
    });
    expect(screen.getByText('Ajouter')).toBeOnTheScreen();
    expect(screen.getByRole('header')).toHaveAccessibleName(
      'Aucune habitude pour l’instant Crée ta première habitude.',
    );
  });

  it('shows the alert emblem at ×2 and announces an error', async () => {
    await render(
      <StateMessage
        alert
        illustration="alert"
        title="Impossible de charger tes habitudes."
        text="Une erreur est survenue."
        action={null}
      />,
    );

    const emblem = screen.getByTestId('illustration-alert', hidden);
    expect(emblem.props.sprite).toBe('alert-emblem');
    expect(emblem.props.scale).toBe(2);
    expect(screen.getByRole('alert')).toHaveAccessibleName(
      'Impossible de charger tes habitudes. Une erreur est survenue.',
    );
  });

  it('never cuts the title in the pixel font', async () => {
    await render(<StateMessage illustration="alert" title="Titre" text="Texte" action={null} />);

    const title = screen.getByText('Titre');
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.adjustsFontSizeToFit).toBeUndefined();
    expect(title.props.allowFontScaling).not.toBe(false);
  });
});
