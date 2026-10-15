import { Day } from '../../../domain/day/Day';
import { CHECK_IN_SAVE_FAILED, correctionMessage } from './checkInMessages';

describe('check-in messages', () => {
  it('says that the check-in was not saved', () => {
    expect(CHECK_IN_SAVE_FAILED).toBe('Le suivi n’a pas été enregistré.');
  });

  it('names the day that has just been closed in a correction', () => {
    expect(correctionMessage(Day.of(2026, 10, 14))).toBe(
      'Mercredi 14 octobre vient d’être clos : enregistré comme correction.',
    );
  });
});
