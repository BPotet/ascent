import type { AttackKind } from '../../../domain/battle/attacks';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { EntryCategory } from '../../../domain/discoveryBook/bestiary';
import type { EnemyPage, PageMechanic, PageMove } from '../../../domain/discoveryBook/enemyPage';
import { TIER_NAMES } from './ascentText';
import { ATTACK_NAMES, ENEMY_NAMES, agreed, burnChipText, signatureText } from './battleText';
import { ENEMY_PAGES } from './codex/enemyPages';

/**
 * Les textes de la page d'un ennemi (#283), tirés de la maquette
 * `docs/mockups/278-carnet-de-decouvertes/` (F1 à F6) et du glossaire : « ennemi » partout. Aucun
 * chiffre de jeu (B21) : les libellés du combat viennent des mêmes fonctions qu'en combat, leur mot
 * seulement (`signatureText(…).text`), jamais leur phrase au lecteur d'écran, qui donne des nombres.
 */
export const PAGE_BACK_LABEL = 'Retour au Bestiaire';
export const LORE_TITLE = 'Histoire';
export const MECHANICS_TITLE = 'Mécaniques';
export const NO_MECHANIC = 'Aucune mécanique propre : tout est dans ses coups.';
export const HIDDEN_LORE = '???';
export const HIDDEN_PAGE_LABEL = 'Histoire cachée';
export const PAGE_FILLED = 'Page remplie';
export const PHASE_2_PORTRAIT = 'Nouveau visage en phase 2';

const CATEGORY_NAMES: Readonly<Record<EntryCategory, string>> = {
  enemy: 'Ennemi',
  elite: 'Élite',
  boss: 'Boss',
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** La catégorie d'une page : « Ennemi », « Élite », « Boss ». */
export function pageCategory(page: EnemyPage): string {
  return CATEGORY_NAMES[page.category];
}

/** Le sous-titre de l'en-tête : « Bestiaire · Palier 2 ». */
export function pageSubtitle(page: EnemyPage): string {
  return `Bestiaire · Palier ${page.tier}`;
}

/** La ligne sous le nom : « Palier 1 · les Catacombes ». */
export function pageTierLine(page: EnemyPage): string {
  const name = TIER_NAMES[page.tier];
  return `Palier ${page.tier} · ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/** L'état de la page en un mot, accordé au nom : « Vaincue », « Rencontré ». */
export function pageStatus(page: EnemyPage): string {
  return capitalized(agreed(page.kind, page.state === 'defeated' ? 'vaincu' : 'rencontré'));
}

/** La lecture du haut de la page : « Fossoyeur, Élite, vaincu. » */
export function pageIdentityLabel(page: EnemyPage): string {
  return `${ENEMY_NAMES[page.kind]}, ${pageCategory(page)}, ${pageStatus(page).toLowerCase()}.`;
}

/** La phrase de la page cachée (F4). */
export function hiddenPageSentence(kind: EnemyKind): string {
  return `Son histoire, ses mécaniques et ses coups restent cachés tant que tu ne l'as pas ${agreed(kind, 'vaincu')}.`;
}

/** L'annonce polie de « Page remplie » (F5) : « Page remplie : Embrasé. » */
export function pageFilledAnnouncement(kind: EnemyKind): string {
  return `${PAGE_FILLED} : ${ENEMY_NAMES[kind]}.`;
}

/** Le libellé de chaque mécanique : celui du combat quand le combat en a un (D4). */
function mechanicLabel(kind: EnemyKind, mechanic: PageMechanic): string {
  switch (mechanic) {
    case 'selfRevive':
      return agreed(kind, 'Se relève seul');
    case 'support':
      return 'Soutien';
    case 'exhume':
      return 'Exhumer';
    case 'summon':
      return 'Invocation';
    case 'thorns':
      return 'Épines';
    case 'sanctuary':
      return 'Sanctuaire';
    case 'swarm':
      return 'Meute';
    case 'phaseShift':
      return 'Changement de phase';
    case 'aura':
      return signatureText(kind, { state: 'aura', off: false }).text;
    case 'emberBurst':
      return signatureText(kind, { state: 'emberBurst', off: false }).text;
    case 'momentumTheft':
      return signatureText(kind, { state: 'momentumTheft' }).text;
    case 'charge':
      return signatureText(kind, { state: 'charge', mark: 'idle' }).text;
    case 'sweep':
      return signatureText(kind, { state: 'sweep' }).text;
  }
}

/** Une mécanique de la page : son libellé, sa phrase, et leur lecture ensemble. */
export interface MechanicText {
  readonly mechanic: PageMechanic;
  readonly label: string;
  readonly sentence: string;
  readonly speech: string;
}

/** Les mécaniques d'une page remplie, dans l'ordre du domaine ; aucune pour une page cachée. */
export function pageMechanicsText(page: EnemyPage): MechanicText[] {
  if (page.state !== 'defeated') return [];
  const sentences = ENEMY_PAGES[page.kind].mechanics;
  return page.mechanics.map((mechanic) => {
    const label = mechanicLabel(page.kind, mechanic);
    const sentence = sentences[mechanic]!;
    return { mechanic, label, sentence, speech: `${label}. ${sentence}` };
  });
}

/** Une puce d'un coup : Saignement, Brûlure ou Charge. */
export interface MoveChip {
  readonly kind: 'bleed' | 'burn' | 'charge';
  readonly label: string;
}

/** Un coup de la page : son nom, son type au mot, ses puces, sa description, et sa lecture. */
export interface MoveText {
  readonly attack: AttackKind;
  readonly name: string;
  readonly type: string;
  readonly chips: readonly MoveChip[];
  readonly description: string;
  readonly speech: string;
}

function moveChips(move: PageMove): MoveChip[] {
  const chips: MoveChip[] = [];
  if (move.bleed) chips.push({ kind: 'bleed', label: 'Saignement' });
  if (move.burn !== null) chips.push({ kind: 'burn', label: burnChipText(move.burn) });
  if (move.charge) chips.push({ kind: 'charge', label: 'Charge' });
  return chips;
}

/** Une phase de la page : son titre, son compte de coups, sa description (boss) et ses coups. */
export interface PhaseText {
  readonly title: string;
  readonly count: string;
  readonly description: string | null;
  readonly moves: readonly MoveText[];
}

const moves = (count: number) => `${count} ${count > 1 ? 'coups' : 'coup'}`;

/**
 * Les coups d'une page remplie : « Coups », ou pour un boss la phase 1, puis ce que la phase 2
 * ajoute, avec sa description ; aucun pour une page cachée.
 */
export function pagePhasesText(page: EnemyPage): PhaseText[] {
  if (page.state !== 'defeated') return [];
  const texts = ENEMY_PAGES[page.kind].phases;
  const boss = page.phases.length > 1;
  return page.phases.map((phase, index) => {
    const text = texts[index]!;
    const shown = phase.moves.map((move, at): MoveText => {
      const { name, description } = text.moves[at]!;
      const type = capitalized(ATTACK_NAMES[move.attack]);
      const chips = moveChips(move);
      const said = [name, type, ...chips.map(({ label }) => label)].join(', ');
      return {
        attack: move.attack,
        name,
        type,
        chips,
        description,
        speech: `${said}. ${description}`,
      };
    });
    if (!boss) {
      return { title: 'Coups', count: `${shown.length}`, description: null, moves: shown };
    }
    return {
      title: index === 0 ? 'Phase 1' : 'Phase 2 · sous la moitié de ses PV',
      count: index === 0 ? moves(shown.length) : `+${moves(shown.length)}`,
      description: text.description!,
      moves: shown,
    };
  });
}
