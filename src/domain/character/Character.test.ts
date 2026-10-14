import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Character, InvalidXpError, XP_PER_CHECK_IN } from './Character';

const today = Day.of(2026, 10, 14);
const checkIn = (day: Day, done = true, corrected = false): CheckIn => ({
  habitId: 1,
  day,
  done,
  corrected,
});

describe('Character', () => {
  it('earns 10 Xp per check-in (R14)', () => {
    expect(XP_PER_CHECK_IN).toBe(10);
  });

  it('starts with no experience and no retained experience', () => {
    expect(Character.NEW).toEqual(new Character(0, 0));
    expect(Character.NEW.xp).toBe(0);
    expect(Character.NEW.retainedXp).toBe(0);
  });

  it('keeps its experience and its retained experience', () => {
    const character = new Character(70, 20);

    expect(character.xp).toBe(70);
    expect(character.retainedXp).toBe(20);
  });

  it('has no retained experience unless told so', () => {
    expect(new Character(30).retainedXp).toBe(0);
  });

  it.each([
    [-10, 0],
    [0, -10],
    [-1, 0],
    [0, -1],
    [2.5, 0],
    [0, 2.5],
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
  ])('refuses xp = %p and retainedXp = %p (R16)', (xp, retainedXp) => {
    expect(() => new Character(xp, retainedXp)).toThrow(InvalidXpError);
  });

  it('tells which value is invalid', () => {
    expect(() => new Character(-10, 0)).toThrow('Invalid xp: -10');
    expect(() => new Character(0, -5)).toThrow('Invalid retainedXp: -5');
    expect(new InvalidXpError('xp', -1).name).toBe('InvalidXpError');
  });

  describe('applyCheckInChange', () => {
    it('gains 10 Xp when a case becomes « fait » (R14)', () => {
      expect(new Character(30).applyCheckInChange(true)).toEqual(new Character(40));
    });

    it('loses 10 Xp when a case goes back from « fait » (R14)', () => {
      expect(new Character(40).applyCheckInChange(false)).toEqual(new Character(30));
    });

    it('never goes below 0 (R16)', () => {
      expect(new Character(0).applyCheckInChange(false)).toEqual(new Character(0));
      expect(new Character(10).applyCheckInChange(false)).toEqual(new Character(0));
    });

    it('keeps the retained experience', () => {
      expect(new Character(50, 20).applyCheckInChange(true)).toEqual(new Character(60, 20));
      expect(new Character(50, 20).applyCheckInChange(false)).toEqual(new Character(40, 20));
    });

    it('leaves the character itself unchanged', () => {
      const character = new Character(30);

      character.applyCheckInChange(true);

      expect(character.xp).toBe(30);
    });
  });

  describe('retainOnHabitDeletion', () => {
    const monday = Day.of(2026, 10, 12);
    const tuesday = Day.of(2026, 10, 13);

    it("removes only the experience of today's check-in « fait » (R17)", () => {
      const deleted = [checkIn(monday), checkIn(tuesday), checkIn(today)];

      expect(new Character(40).retainOnHabitDeletion(deleted, today)).toEqual(
        new Character(30, 20),
      );
    });

    it('keeps the experience of the closed days as retained experience (R17)', () => {
      expect(new Character(50, 10).retainOnHabitDeletion([checkIn(monday)], today)).toEqual(
        new Character(50, 20),
      );
    });

    it('removes nothing without a check-in « fait » today (R17)', () => {
      expect(new Character(10).retainOnHabitDeletion([], today)).toEqual(new Character(10));
      expect(
        new Character(10).retainOnHabitDeletion(
          [checkIn(monday), checkIn(today, false, true)],
          today,
        ),
      ).toEqual(new Character(10, 10));
    });

    it('retains nothing of a closed day corrected to « pas fait »', () => {
      expect(
        new Character(10).retainOnHabitDeletion([checkIn(monday, false, true)], today),
      ).toEqual(new Character(10));
    });

    it('retains a check-in « fait » after today (clock set back), like a closed day', () => {
      const thursday = Day.of(2026, 10, 15);

      expect(new Character(10).retainOnHabitDeletion([checkIn(thursday)], today)).toEqual(
        new Character(10, 10),
      );
    });

    it('never goes below 0 (R16)', () => {
      expect(new Character(0).retainOnHabitDeletion([checkIn(today)], today)).toEqual(
        new Character(0),
      );
    });

    it('keeps the invariant: xp = 10 × check-ins « fait » of existing habits + retained (R15)', () => {
      // « Cuisiner » : lundi, mardi, aujourd'hui ; « Budget du jour » : aujourd'hui.
      const cooking = [checkIn(monday), checkIn(tuesday), checkIn(today)];
      const before = new Character(40, 0);

      const after = before.retainOnHabitDeletion(cooking, today);

      const budgetDone = 1;
      expect(after.xp).toBe(XP_PER_CHECK_IN * budgetDone + after.retainedXp);
    });

    it('leaves the character itself unchanged', () => {
      const character = new Character(40);

      character.retainOnHabitDeletion([checkIn(today)], today);

      expect(character).toEqual(new Character(40, 0));
    });
  });

  describe('xpChangeTo', () => {
    it('gives the change of experience from this character to the next one', () => {
      expect(new Character(30).xpChangeTo(new Character(40))).toBe(10);
      expect(new Character(40).xpChangeTo(new Character(30))).toBe(-10);
      expect(new Character(0).xpChangeTo(new Character(0))).toBe(0);
    });
  });
});
