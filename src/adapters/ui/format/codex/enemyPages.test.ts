// Le contenu des pages des ennemis (#283, D11) : recopié du Codex, il est le filet de sécurité des
// données exclues de la détection de duplication. Chaque entrée du catalogue a sa page, alignée sur
// sa fiche du domaine, avec les mécaniques du domaine et sans aucun chiffre de jeu (B21, B22).
import { ENEMIES, type EnemyKind } from '../../../../domain/battle/combatants';
import { BESTIARY_CATALOG, catalogKinds } from '../../../../domain/discoveryBook/bestiary';
import { pageMechanics } from '../../../../domain/discoveryBook/enemyPage';
import { ENEMY_PAGES } from './enemyPages';

const KINDS = catalogKinds(BESTIARY_CATALOG);

/**
 * Les nombres permis par B21 : des nombres de choses visibles (« jusqu'à 3 » Rats de crypte, la
 * « phase 2 » d'un boss), jamais un chiffre de jeu.
 */
const ALLOWED_NUMBERS = [/jusqu'à 3/gu, /phase 2/giu];

const texts = (kind: EnemyKind): string[] => {
  const { lore, mechanics, phases } = ENEMY_PAGES[kind];
  return [
    lore,
    ...Object.values(mechanics),
    ...phases.flatMap(({ description, moves }) => [
      ...(description === undefined ? [] : [description]),
      ...moves.flatMap(({ name, description: text }) => [name, text]),
    ]),
  ];
};

describe('the content of the enemy pages (#283)', () => {
  it('has the 37 entries of the bestiary: 12 at tier 1, 12 at tier 2 and 13 at tier 3', () => {
    expect(KINDS).toHaveLength(37);
    expect(([1, 2, 3] as const).map((tier) => catalogKinds({ ...emptyBut(tier) }).length)).toEqual([
      12, 12, 13,
    ]);
    expect(Object.keys(ENEMY_PAGES).sort()).toEqual([...KINDS].sort());
  });

  it.each(KINDS)('gives %s its lore and its moves, aligned on its sheet', (kind) => {
    const { lore, phases } = ENEMY_PAGES[kind];
    const { moves, phase2Moves } = ENEMIES[kind];
    expect(lore.trim()).not.toBe('');
    const sheet = phase2Moves === undefined ? [moves] : [moves, phase2Moves];
    expect(phases.map((phase) => phase.moves.map(({ attack }) => attack))).toEqual(
      sheet.map((phase) => phase.map(({ attack }) => attack)),
    );
    phases.forEach((phase) =>
      phase.moves.forEach(({ name, description }) => {
        expect(name.trim()).not.toBe('');
        expect(description.trim()).not.toBe('');
      }),
    );
    if (phase2Moves !== undefined) {
      phases.forEach(({ description }) => expect(description?.trim()).toBeTruthy());
    } else {
      expect(phases[0]!.description).toBeUndefined();
    }
  });

  it.each(KINDS)('says the mechanics of %s, exactly those of its sheet (B22)', (kind) => {
    expect(Object.keys(ENEMY_PAGES[kind].mechanics)).toEqual(pageMechanics(ENEMIES[kind]));
    Object.values(ENEMY_PAGES[kind].mechanics).forEach((sentence) =>
      expect(sentence.trim()).not.toBe(''),
    );
  });

  it.each(KINDS)('gives no game number in any text of %s (B21)', (kind) => {
    texts(kind).forEach((text) => {
      const words = ALLOWED_NUMBERS.reduce((rest, allowed) => rest.replace(allowed, ''), text);
      expect(words).not.toMatch(/\d/u);
    });
  });

  it.each(KINDS)('says « ennemi », never « monstre », nor « maudit », for %s', (kind) => {
    texts(kind).forEach((text) => expect(text).not.toMatch(/monstre|maudit/iu));
  });

  it('says the Invocation of the Moth Queen as the GD corrected it (#299)', () => {
    expect(ENEMY_PAGES.mothQueen.mechanics.summon).toBe(
      'Quand ses PV descendent à la moitié, elle appelle deux Phalénides à ses côtés. Elles retombent en cendre avec elle.',
    );
  });

  it('says Frôlement and the Momentum theft of the Thieving moth as the GD corrected them (#299)', () => {
    expect(ENEMY_PAGES.thievingMoth.phases[0]!.moves[0]!.description).toBe(
      'Elle frôle deux fois le héros du bout des ailes. Le reflet se dédouble : deux impacts. Chaque impact qui le touche, même sur une bonne parade, lui vole un peu de son Élan.',
    );
    expect(ENEMY_PAGES.thievingMoth.mechanics.momentumTheft).toBe(
      'Chaque impact qui te touche, bonne parade comprise, te vole un peu de ton Élan. Une parade parfaite ou une esquive le protège.',
    );
  });

  it('says the Staff of vigils of the Necromancer as a simple blow, as the GD corrected it (#299)', () => {
    expect(ENEMY_PAGES.necromancer.phases[0]!.moves[0]!.description).toBe(
      "Il lève son bâton et l'abat d'un coup sec, comme on frappe à une porte. Un reflet blanc, un seul impact.",
    );
  });
});

function emptyBut(tier: 1 | 2 | 3) {
  const none = { enemies: [], elites: [], bosses: [] };
  return { 1: none, 2: none, 3: none, [tier]: BESTIARY_CATALOG[tier] };
}
