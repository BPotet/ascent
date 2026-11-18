// Les textes de la page d'un ennemi (#283, maquette 278 F1 à F6) : l'en-tête, l'état, la page cachée,
// les mécaniques avec les libellés du combat, les coups avec leurs puces, les phases d'un boss, et
// aucun chiffre de jeu (B21) hors des libellés du combat.
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  EMPTY_DISCOVERY_BOOK,
  type BestiaryState,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { BESTIARY_CATALOG, catalogKinds } from '../../../domain/discoveryBook/bestiary';
import { enemyPage, type EnemyPage } from '../../../domain/discoveryBook/enemyPage';
import {
  HIDDEN_PAGE_LABEL,
  PAGE_BACK_LABEL,
  hiddenPageSentence,
  pageFilledAnnouncement,
  pageIdentityLabel,
  pageMechanicsText,
  pagePhasesText,
  pageStatus,
  pageSubtitle,
  pageTierLine,
} from './enemyPageText';

const pageOf = (kind: EnemyKind, state: BestiaryState = 'defeated'): EnemyPage =>
  enemyPage({ ...EMPTY_DISCOVERY_BOOK, enemies: { [kind]: { state } } }, kind)!;

/** Les nombres permis par B21 : les libellés du combat, et des nombres de choses visibles. */
const ALLOWED_NUMBERS = [
  /Aura \+\d+ %/gu,
  /Braises \d+/gu,
  /Brûlure ×\d+/gu,
  /jusqu'à 3/gu,
  /phase \d/giu,
  /Palier \d/gu,
];

const withoutAllowed = (text: string) =>
  ALLOWED_NUMBERS.reduce((rest, allowed) => rest.replace(allowed, ''), text);

describe('the texts of the enemy page (#283)', () => {
  it('heads the page with « Retour au Bestiaire », the bestiary and the tier', () => {
    expect(PAGE_BACK_LABEL).toBe('Retour au Bestiaire');
    expect(pageSubtitle(pageOf('gravedigger'))).toBe('Bestiaire · Palier 1');
    expect(pageTierLine(pageOf('gravedigger'))).toBe('Palier 1 · les Catacombes');
    expect(pageTierLine(pageOf('burningHusk'))).toBe('Palier 2 · les Jardins de cendre');
  });

  it('reads the name, the category and the state, agreed with the name', () => {
    expect(pageIdentityLabel(pageOf('gravedigger'))).toBe('Fossoyeur, Élite, vaincu.');
    expect(pageIdentityLabel(pageOf('ghoul'))).toBe('Goule, Ennemi, vaincue.');
    expect(pageIdentityLabel(pageOf('brambleMother', 'encountered'))).toBe(
      'Mère-ronce, Élite, rencontrée.',
    );
    expect(pageStatus(pageOf('brambleMother', 'encountered'))).toBe('Rencontrée');
    expect(pageStatus(pageOf('hourRinger'))).toBe('Vaincu');
  });

  it('says the hidden page in one sentence (F4)', () => {
    expect(HIDDEN_PAGE_LABEL).toBe('Histoire cachée');
    expect(hiddenPageSentence('brambleMother')).toBe(
      "Son histoire, ses mécaniques et ses coups restent cachés tant que tu ne l'as pas vaincue.",
    );
    expect(hiddenPageSentence('gravedigger')).toBe(
      "Son histoire, ses mécaniques et ses coups restent cachés tant que tu ne l'as pas vaincu.",
    );
  });

  it('announces « Page remplie » politely, with the name (F5)', () => {
    expect(pageFilledAnnouncement('burningHusk')).toBe('Page remplie : Embrasé.');
  });

  it('says each mechanic with its combat label and its sentence (B22, D4)', () => {
    const labels = (kind: EnemyKind) => pageMechanicsText(pageOf(kind)).map(({ label }) => label);
    expect(labels('candleBearer')).toEqual(['Aura +20 %']);
    expect(labels('emberPod')).toEqual(['Braises 2']);
    expect(labels('thievingMoth')).toEqual(["Vole l'Élan"]);
    expect(labels('cryptRat')).toEqual(['Meute']);
    expect(labels('bronzeRam')).toEqual(['Charge']);
    expect(labels('bellClapper')).toEqual(['Balayage']);
    expect(labels('brambleMother')).toEqual(['Épines']);
    expect(labels('beadle')).toEqual(['Sanctuaire']);
    expect(labels('gravedigger')).toEqual(['Exhumer']);
    expect(labels('skeleton')).toEqual(['Se relève seul']);
    expect(labels('ashBramble')).toEqual(['Se relève seule']);
    expect(labels('ashGleaner')).toEqual(['Soutien']);
    expect(labels('mothQueen')).toEqual(['Invocation', 'Changement de phase']);
    expect(labels('ghoul')).toEqual([]);
    expect(pageMechanicsText(pageOf('cryptRat'))[0]).toEqual({
      mechanic: 'swarm',
      label: 'Meute',
      sentence:
        "Il mord plus fort quand d'autres Rats de crypte sont debout. Ils viennent jusqu'à 3 : chaque Rat abattu affaiblit la meute.",
      speech:
        "Meute. Il mord plus fort quand d'autres Rats de crypte sont debout. Ils viennent jusqu'à 3 : chaque Rat abattu affaiblit la meute.",
    });
    expect(pageMechanicsText(pageOf('brambleMother', 'encountered'))).toEqual([]);
  });

  it('reads a move « Coup de pelle, Coup simple. Il lève sa pelle… », with its chips', () => {
    const [phase] = pagePhasesText(pageOf('gravedigger'));
    expect(phase!.moves[0]).toEqual({
      attack: 'basic',
      name: 'Coup de pelle',
      type: 'Coup simple',
      chips: [],
      description:
        "Il lève sa pelle et l'abat à plat, d'un seul coup. Un reflet blanc, un seul impact.",
      speech:
        "Coup de pelle, Coup simple. Il lève sa pelle et l'abat à plat, d'un seul coup. Un reflet blanc, un seul impact.",
    });
    const burner = pagePhasesText(pageOf('brambleBurner'))[0]!.moves;
    expect(burner.map(({ type, chips }) => [type, chips])).toEqual([
      ['Coup simple', [{ kind: 'burn', label: 'Brûlure ×2' }]],
      ['Double frappe', [{ kind: 'bleed', label: 'Saignement' }]],
      ['Coup retardé imparable', []],
    ]);
    expect(burner[1]!.speech).toMatch(/^Fagot d'épines, Double frappe, Saignement\. /u);
    expect(pagePhasesText(pageOf('bronzeRam'))[0]!.moves[1]!.chips).toEqual([
      { kind: 'charge', label: 'Charge' },
    ]);
  });

  it('gives a single phase « Coups » to an enemy, and two phases to a boss (F3)', () => {
    expect(
      pagePhasesText(pageOf('gravedigger')).map(({ title, count, description }) => ({
        title,
        count,
        description,
      })),
    ).toEqual([{ title: 'Coups', count: '3', description: null }]);
    const queen = pagePhasesText(pageOf('mothQueen'));
    expect(queen.map(({ title, count }) => [title, count])).toEqual([
      ['Phase 1', '2 coups'],
      ['Phase 2 · sous la moitié de ses PV', '+1 coup'],
    ]);
    expect(queen[1]!.description).toMatch(/^Sous la moitié de ses PV, elle appelle/u);
    expect(queen[1]!.moves.map(({ name }) => name)).toEqual(['Flamme de la lampe']);
    expect(pagePhasesText(pageOf('mothQueen', 'encountered'))).toEqual([]);
  });

  it.each(catalogKinds(BESTIARY_CATALOG))(
    'gives no game number on the filled page of %s, read or shown (B21)',
    (kind) => {
      const page = pageOf(kind);
      const said = [
        pageIdentityLabel(page),
        pageTierLine(page),
        pageSubtitle(page),
        ...pageMechanicsText(page).flatMap(({ label, sentence, speech }) => [
          label,
          sentence,
          speech,
        ]),
        ...pagePhasesText(page).flatMap(({ title, description, moves }) => [
          title,
          description ?? '',
          ...moves.flatMap(({ name, type, chips, description: text, speech }) => [
            name,
            type,
            text,
            speech,
            ...chips.map(({ label }) => label),
          ]),
        ]),
      ];
      said.forEach((text) => expect(withoutAllowed(text)).not.toMatch(/\d/u));
      said.forEach((text) => expect(text).not.toMatch(/monstre|maudit/iu));
    },
  );
});
