// Ce que l'écran montre de la Mère-ronce et du Bedeau (#259, maquette 245, M1, M4, B1, B3, B5) :
// leurs marques de signature lues dans le domaine, le liseré d'acier de la barre de garde du Bedeau,
// la ligne du pouce et la plaque lue « Élite ».
import { encounterMultipliers } from '../../../domain/ascent/tiers';
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { battleView } from './battleView';

const STUN = { heroAction: 99, actionLost: false };

function eliteOf(kind: EnemyKind, tier: 2 | 3, escort: readonly EnemyKind[] = []): Battle {
  const enemies = [kind, ...escort];
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    ...encounterMultipliers(tier, { kind: 'elite', enemies }),
  }).battle;
}

const mother = (escort: readonly EnemyKind[] = []) => eliteOf('brambleMother', 2, escort);
const beadle = (escort: readonly EnemyKind[] = []) => eliteOf('beadle', 3, escort);

const withElite = (battle: Battle, change: Partial<EnemyState>): Battle => ({
  ...battle,
  enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
});

const signatureOf = (battle: Battle) => battleView(battle).enemies[0]!.signature;

describe('the signature mark of the Bramble mother (#259, M1, M4)', () => {
  it('says « Épines 2 » with the thorn while she is not stunned (M1)', () => {
    expect(signatureOf(mother())).toEqual({
      variant: 'thorns',
      glyph: 'thorn8',
      text: 'Épines 2',
      speech: 'épines : chaque frappe sur elle te coûte 2 PV',
      off: false,
      now: false,
    });
  });

  it('greys « Épines 2 » out while she is stunned (M4, M5)', () => {
    expect(signatureOf(withElite(mother(), { guard: 0, stun: STUN }))).toMatchObject({
      variant: 'thorns',
      glyph: 'thorn8',
      text: 'Épines 2',
      speech: 'épines sans effet tant qu’elle est étourdie',
      off: true,
    });
  });

  it('has no mark once she has fallen, and none on her escort (M6)', () => {
    const view = battleView(mother(['ashBramble']));

    expect(view.enemies[1]).not.toHaveProperty('signature');
    expect(battleView(withElite(mother(), { hp: 0 })).enemies[0]).not.toHaveProperty('signature');
  });

  it('reads the plate as an Elite, with the price of her Thorns', () => {
    expect(battleView(mother()).enemies[0]!.label).toMatch(
      /^Mère-ronce, Élite, cible, 136 PV sur 136, garde 63 sur 63, épines : chaque frappe sur elle te coûte 2 PV, /u,
    );
  });

  it('never puts a steel border on her guard bar', () => {
    expect(battleView(mother()).enemies[0]).not.toHaveProperty('guardWard');
  });
});

describe('the signature mark of the Beadle (#259, B1, B3, B5)', () => {
  it('says « Sanctuaire ½ » with the ward, and borders his guard bar with steel (B1)', () => {
    const [warden] = battleView(beadle()).enemies;

    expect(warden!.signature).toEqual({
      variant: 'sanctuary',
      glyph: 'ward8',
      text: 'Sanctuaire ½',
      speech: 'sanctuaire : moitié des dégâts tant que sa garde tient',
      off: false,
      now: false,
    });
    expect(warden!.guardWard).toBe(true);
  });

  it('greys « Sanctuaire rompu » out with the crack, without the steel border, once broken (B3, B4)', () => {
    const [warden] = battleView(withElite(beadle(), { guard: 0, stun: STUN })).enemies;

    expect(warden!.signature).toMatchObject({
      glyph: 'crack8',
      text: 'Sanctuaire rompu',
      speech: 'sanctuaire rompu : dégâts entiers',
      off: true,
    });
    expect(warden).not.toHaveProperty('guardWard');
  });

  it('brings the mark and the border back with his guard (B5)', () => {
    const [warden] = battleView(withElite(beadle(), { guard: 96, stun: null })).enemies;

    expect(warden!.signature).toMatchObject({ text: 'Sanctuaire ½', off: false });
    expect(warden!.guardWard).toBe(true);
  });

  it('gives his escort neither mark nor border (B6)', () => {
    const [, escort] = battleView(beadle(['bellNovice', 'bellNovice'])).enemies;

    expect(escort).not.toHaveProperty('signature');
    expect(escort).not.toHaveProperty('guardWard');
  });
});

describe('the line above the buttons (#259, M1, B1)', () => {
  it('says the price of a strike while the Bramble mother is the target', () => {
    expect(battleView(mother()).line).toEqual({
      before: 'Cible : ',
      strong: 'Mère-ronce',
      after: ' · Épines : −2 PV par frappe',
    });
  });

  it('says nothing of the Thorns while she is stunned, but the × 1.5', () => {
    expect(battleView(withElite(mother(), { guard: 0, stun: STUN })).line).toEqual({
      before: 'Cible : ',
      strong: 'Mère-ronce',
      after: ' · ×1,5',
    });
  });

  it('says nothing of the Thorns when the target is her escort', () => {
    expect(battleView({ ...mother(['ashBramble']), target: 1 }).line).toEqual({
      before: 'Cible : ',
      strong: 'Ronce de cendre',
      after: '',
    });
  });

  it('says « Sanctuaire, ½ des dégâts » while the Beadle is the target under his Sanctuary', () => {
    expect(battleView(beadle()).line).toEqual({
      before: 'Cible : ',
      strong: 'Bedeau',
      after: ' · Sanctuaire, ½ des dégâts',
    });
    expect(battleView(withElite(beadle(), { guard: 0, stun: STUN })).line).toMatchObject({
      after: ' · ×1,5',
    });
  });
});
