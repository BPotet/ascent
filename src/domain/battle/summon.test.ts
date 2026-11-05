// Les places libres de l'Invocation (#172, règle 6) : vides d'abord, puis celles des ennemis tombés,
// chaque fois de gauche à droite, au plus `count` ; un tombé que vise une intention Relever d'un
// allié debout n'est pas libre.
import type { Intent } from './intents';
import { freeSlots } from './summon';

const standing = { hp: 10, intent: null };
const fallen = { hp: 0, intent: null };
const raising = (ally: number): { readonly hp: number; readonly intent: Intent } => ({
  hp: 10,
  intent: { category: 'raise', ally },
});

describe('the free slots of the front line for a summon (#172, rule 6)', () => {
  it('gives the two empty slots right of a boss alone, from left to right', () => {
    expect(freeSlots([standing], 2)).toEqual([1, 2]);
  });

  it('gives at most count slots', () => {
    expect(freeSlots([standing], 1)).toEqual([1]);
  });

  it('gives nothing in a front line of three enemies standing', () => {
    expect(freeSlots([standing, standing, standing], 2)).toEqual([]);
  });

  it('takes the slots of fallen enemies, from left to right', () => {
    expect(freeSlots([standing, fallen, fallen], 2)).toEqual([1, 2]);
    expect(freeSlots([fallen, standing, fallen], 1)).toEqual([0]);
  });

  it('takes the empty slots before the slots of fallen enemies', () => {
    expect(freeSlots([standing, fallen], 2)).toEqual([2, 1]);
    expect(freeSlots([standing, fallen], 1)).toEqual([2]);
  });

  it('gives fewer slots than count when fewer are free', () => {
    expect(freeSlots([standing, standing, fallen], 2)).toEqual([2]);
  });

  it('never takes a fallen enemy that the Raise intent of a standing ally targets', () => {
    expect(freeSlots([standing, raising(2), fallen], 2)).toEqual([]);
    expect(freeSlots([fallen, raising(2), fallen], 2)).toEqual([0]);
  });

  it('takes a fallen enemy that only a fallen ally meant to raise', () => {
    expect(freeSlots([standing, { ...raising(2), hp: 0 }, fallen], 2)).toEqual([1, 2]);
  });

  it('never counts a slot beyond the front line of three', () => {
    expect(freeSlots([standing, standing, standing, fallen], 2)).toEqual([]);
  });
});
