import { defineFeature, loadFeature } from 'jest-cucumber';

import { SystemClock } from '../../src/adapters/device/clock/SystemClock';
import { formatLongDay } from '../../src/adapters/ui/format/formatDay';
import { getToday } from '../../src/application/useCases/getToday';
import type { Day } from '../../src/domain/day/Day';
import { phoneTime } from '../support/phoneTime';

const feature = loadFeature('features/today.feature');

defineFeature(feature, (test) => {
  const scenario = (title: string) =>
    test(title, ({ given, when, then }) => {
      let clock: SystemClock;
      let today: Day;

      given(/^le téléphone indique le (.+)$/, (moment: string) => {
        clock = new SystemClock(() => phoneTime(moment));
      });

      when("l'application demande quel jour on est", () => {
        today = getToday(clock);
      });

      then(/^elle obtient le (.+)$/, (expected: string) => {
        expect(formatLongDay(today)).toBe(expected);
      });
    });

  scenario("Aujourd'hui est la date locale du téléphone");
  scenario('Le jour change à minuit, heure du téléphone');
});
