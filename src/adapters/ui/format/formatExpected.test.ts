import { doneOutOfExpected, GOALS_REACHED } from './formatExpected';

describe('doneOutOfExpected', () => {
  it.each([
    [0, 1, '0 habitude faite sur 1 attendue'],
    [1, 2, '1 habitude faite sur 2 attendues'],
    [2, 2, '2 habitudes faites sur 2 attendues'],
    [0, 0, '0 habitude faite sur 0 attendue'],
  ] as const)('reads %i done out of %i expected', (doneCount, expectedCount, label) => {
    expect(doneOutOfExpected(doneCount, expectedCount)).toBe(label);
  });
});

describe('GOALS_REACHED', () => {
  it('is the label of the mockups', () => {
    expect(GOALS_REACHED).toBe('Objectifs de la semaine atteints');
  });
});
