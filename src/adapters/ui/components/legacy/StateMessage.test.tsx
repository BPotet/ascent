import { render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { StateMessage } from './StateMessage';

const action = <Button label="Réessayer" onPress={() => undefined} />;

describe('StateMessage', () => {
  it.each([
    ['summit', 180, 130],
    ['alert', 56, 56],
  ] as const)(
    'shows the « %s » illustration of the mockup, %i × %i, hidden from the screen reader',
    async (illustration, width, height) => {
      await render(
        <StateMessage illustration={illustration} title="Titre" text="Texte" action={action} />,
      );

      const image = screen.getByTestId(`illustration-${illustration}`, {
        includeHiddenElements: true,
      });
      expect(image).toHaveStyle({ width, height });
      expect(image).toHaveProp('source', expect.anything());
      expect(screen.queryByTestId(`illustration-${illustration}`)).not.toBeOnTheScreen();
    },
  );

  it('uses a different picture for each illustration', async () => {
    await render(<StateMessage illustration="summit" title="T" text="T" action={action} />);
    const summit = screen.getByTestId('illustration-summit', { includeHiddenElements: true }).props
      .source;
    await render(<StateMessage illustration="alert" title="T" text="T" action={action} />);
    const alert = screen.getByTestId('illustration-alert', { includeHiddenElements: true }).props
      .source;

    expect(summit).not.toEqual(alert);
  });

  it('reads the title and the text as a header, or as an alert', async () => {
    await render(<StateMessage illustration="summit" title="Vide." text="Rien." action={action} />);
    expect(screen.getByRole('header', { name: 'Vide. Rien.' })).toBeOnTheScreen();

    await render(
      <StateMessage alert illustration="alert" title="Erreur." text="Oups." action={action} />,
    );
    expect(screen.getByRole('alert', { name: 'Erreur. Oups.' })).toBeOnTheScreen();
  });
});
