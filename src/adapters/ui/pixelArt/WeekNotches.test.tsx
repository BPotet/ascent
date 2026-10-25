import { render, screen } from '@testing-library/react-native';

import { artPalette } from './artPalette';
import { WeekNotches } from './WeekNotches';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const notches = () => screen.getAllByTestId(/^week-notch-/, hidden);
const lit = () => screen.queryAllByTestId('week-notch-on', hidden);

describe('WeekNotches', () => {
  it('draws one notch per « fait » expected by the target of the week, green when done', async () => {
    await render(<WeekNotches done={2} target={5} reached={false} testID="notches" />);

    expect(notches()).toHaveLength(5);
    expect(lit()).toHaveLength(2);
    lit().forEach((notch) => expect(notch).toHaveStyle({ backgroundColor: roles.done }));
    expect(notches()[0]).toHaveStyle({ width: 10, height: 10 });
  });

  it('turns the notches to gold when the target is reached', async () => {
    await render(<WeekNotches done={3} target={3} reached testID="notches" />);

    expect(lit()).toHaveLength(3);
    lit().forEach((notch) => expect(notch).toHaveStyle({ backgroundColor: roles.gold }));
  });

  it('shows « +N » beyond the target', async () => {
    await render(<WeekNotches done={5} target={3} reached testID="notches" />);

    expect(lit()).toHaveLength(3);
    expect(screen.getByText('+2', hidden)).toBeTruthy();
  });

  it('has 12 dp notches in the counter of the day view', async () => {
    await render(<WeekNotches done={1} target={2} reached={false} size="counter" />);

    expect(notches()[0]).toHaveStyle({ width: 12, height: 12 });
  });

  it('is decorative: the text « 2/5 cette semaine » carries the meaning', async () => {
    await render(<WeekNotches done={2} target={5} reached={false} testID="notches" />);

    expect(screen.getByTestId('notches', hidden)).toHaveProp('accessibilityElementsHidden', true);
  });
});
