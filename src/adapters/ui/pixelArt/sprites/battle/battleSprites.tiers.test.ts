// Les images des entrées des paliers 2 et 3 en combat (#38, avenant à l'ADR 0010) : les poses en
// plus, rangées dans l'atlas, et l'aspect de phase 2 d'un boss, dans un second atlas.
import { ASH_BRAMBLE_ANIMATION } from '../atelier/data/ashBramble';
import { ASH_GARDENER_ANIMATION } from '../atelier/data/ashGardener';
import { ASH_GLEANER_ANIMATION } from '../atelier/data/ashGleaner';
import { HOUR_RINGER_ANIMATION } from '../atelier/data/hourRinger';
import { HOUR_RINGER_PHASE2 } from '../atelier/data/hourRingerPhase2';
import { animationSprite, type FullAnimation } from '../atelier/fullAnimation';
import { atlasRect, battleAtlas, frameRect } from './battleAtlas';
import {
  attackMotion,
  battleSprite,
  enemyExtraFrames,
  hasPhase2,
  poseAnchors,
} from './battleCharacters';

const HOUR_RINGER: FullAnimation = { ...HOUR_RINGER_ANIMATION, phase2: HOUR_RINGER_PHASE2 };
const ASH_BRAMBLE: FullAnimation = ASH_BRAMBLE_ANIMATION;
const ASH_GLEANER: FullAnimation = ASH_GLEANER_ANIMATION;
const ASH_GARDENER: FullAnimation = ASH_GARDENER_ANIMATION;

describe('the extra poses in battle (#38)', () => {
  it('lists the extra poses each entity has', () => {
    expect(enemyExtraFrames('ashBramble')).toEqual(['rise0', 'rise1']);
    expect(enemyExtraFrames('scarecrow')).toEqual(['rise0', 'rise1']);
    expect(enemyExtraFrames('ashGleaner')).toEqual(['guard', 'raiseAlly']);
    expect(enemyExtraFrames('ghoul')).toEqual([]);
    expect(enemyExtraFrames('necromancer')).toEqual([]);
  });

  it('draws an extra pose the entity has, as copied', () => {
    expect(battleSprite('ashBramble', 'rise1')).toEqual(animationSprite(ASH_BRAMBLE, 'rise1'));
    expect(battleSprite('ashGleaner', 'raiseAlly').anchors).toEqual(
      animationSprite(ASH_GLEANER, 'raiseAlly').anchors,
    );
  });

  it('shows idle0 for an extra pose the entity does not have', () => {
    expect(battleSprite('ghoul', 'guard')).toEqual(battleSprite('ghoul', 'idle0'));
  });

  it('gives the extra poses their own cell of the atlas, at tier 0, never red', () => {
    const { table } = battleAtlas('ashBramble');
    const rise0 = frameRect('ashBramble', 'rise0', 0, false);

    expect(Object.keys(table.frames)).toEqual(expect.arrayContaining(['rise0', 'rise1']));
    expect(rise0).not.toEqual(frameRect('ashBramble', 'idle0', 0, false));
    expect(rise0).not.toEqual(frameRect('ashBramble', 'rise1', 0, false));
    expect(frameRect('ashBramble', 'rise0', 2, true)).toEqual(rise0);
    expect(atlasRect(battleAtlas('ghoul').table, 'rise0', 0, false)).toEqual(
      frameRect('ghoul', 'idle0', 0, false),
    );
  });

  it('gives the anchors of an extra pose', () => {
    expect(poseAnchors('ashGleaner', 'guard')).toEqual(
      animationSprite(ASH_GLEANER, 'guard').anchors,
    );
  });
});

describe('the phase 2 aspect in battle (#38)', () => {
  it('knows the bosses with a phase 2 aspect', () => {
    expect(
      ['ashGardener', 'hourRinger', 'wishGranter'].map((kind) => hasPhase2(kind as 'ashGardener')),
    ).toEqual([true, true, true]);
    expect(hasPhase2('ossuaryWarden')).toBe(false);
    expect(hasPhase2('facelessPrior')).toBe(false);
  });

  it('draws the poses of the phase 2 aspect, with the palette of phase 1', () => {
    const shifted = battleSprite('ashGardener', 'idle0', { phase2: true });

    expect(shifted).toEqual(animationSprite(ASH_GARDENER, 'idle0', undefined, { phase2: true }));
    expect(shifted.sprite).not.toEqual(battleSprite('ashGardener', 'idle0').sprite);
  });

  it('draws the attack poses of phase 2, joined from their own document, in red for the perilous one', () => {
    expect(
      battleSprite('hourRinger', 'lunge', { phase2: true, attack: 'delayedPerilous', red: true }),
    ).toEqual(
      animationSprite(HOUR_RINGER, 'lunge', undefined, {
        phase2: true,
        attack: 'delayedPerilous',
        red: true,
      }),
    );
  });

  it('prepares a second atlas for the phase 2 aspect, with the attack poses of phase 2', () => {
    const shifted = battleAtlas('hourRinger', { phase2: true });

    expect(shifted).not.toBe(battleAtlas('hourRinger'));
    expect(battleAtlas('hourRinger', { phase2: true })).toBe(shifted);
    expect(Object.keys(shifted.table.attacks).sort()).toEqual([
      'delayed',
      'delayedPerilous',
      'double',
      'feint',
    ]);
    expect(Object.keys(battleAtlas('hourRinger').table.attacks).sort()).toEqual([
      'delayed',
      'double',
    ]);
  });

  it('keeps the same atlas for a boss without a phase 2 aspect', () => {
    expect(battleAtlas('ossuaryWarden', { phase2: true })).toBe(battleAtlas('ossuaryWarden'));
  });

  it('gives the anchors and the motions of phase 2', () => {
    expect(poseAnchors('hourRinger', 'idle0', null, true)).toEqual(
      animationSprite(HOUR_RINGER, 'idle0', undefined, { phase2: true }).anchors,
    );
    expect(Object.keys(attackMotion('hourRinger', true)).sort()).toEqual([
      'delayed',
      'delayedPerilous',
      'double',
      'feint',
    ]);
    expect(attackMotion('ossuaryWarden', true)).toBe(attackMotion('ossuaryWarden'));
  });
});
