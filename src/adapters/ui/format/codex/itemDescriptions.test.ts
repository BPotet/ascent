// La fidélité des descriptions d'objets (#284, D14, ADR 0031) : chacun des 11 objets du jeu a sa
// description ; les 6 recopiées du Codex de l'Atelier le 18/11/2026 gardent l'empreinte de la story
// (sha256 du JSON canonique du texte, la règle de `json.dumps(…, ensure_ascii=False)`, en UTF-8), et
// les 5 déjà dans le jeu ne changent pas.
import { createHash } from 'node:crypto';

import { ITEMS, type ItemKind } from '../../../../domain/ascent/items';
import { itemDescription } from '../ascentText';
import { CODEX_ITEM_DESCRIPTIONS } from './itemDescriptions';

/** Le JSON canonique d'une chaîne : `JSON.stringify` laisse les caractères non ASCII tels quels. */
const sha256 = (text: string) =>
  createHash('sha256').update(JSON.stringify(text), 'utf8').digest('hex');

/** Les empreintes de la story, section « Descriptions des objets ». */
const STORY_FINGERPRINTS = {
  axe: '09670d570899add905006b4247ab2aff88eb1b9b0ad81d24cafab123038dbfef',
  leather: '178a9d6df221f6e67aafcc1cc553fd9a2a3898d3c9cf4ae0f3edda267a896d7a',
  chainmail: '8db04257c2320f9898de17dc5fe6e0f4efdc8db73b2b10107c87b9ad6261a0d5',
  watchmanShield: 'f628886ab7fbc40c1c8c6a75a4cc0e76bfef1b2a964446496d30d6d40cc80248',
  hasteAmulet: 'f8ec2faa68594478dcdb7cfb9a8d39e772d6f43a6c63a5e8264f2890c74c9e3b',
  crossbow: '75168be44a2bb85e4a16c9c9d8c2247093f6a32ca0ed2b599a6ecef261dbe746',
} as const;

/** Les 5 descriptions déjà dans le jeu (#129, #152, #195), inchangées. */
const IN_THE_GAME = {
  hammer:
    'Un marteau de forge, trop lourd pour un combat rapide. Aucune garde ne lui résiste longtemps.',
  blackKnightArmor: "L'armure d'un chevalier déchu. Trouvée dans une salle jadis emplie d'écuyers.",
  huntingSpear:
    'Un épieu de chasseur, le fer noirci par les feux du camp. Il ne brise aucune garde : il entre.',
  watchBell:
    'Une clochette fêlée, pendue jadis au cou des guetteurs du Beffroi. Elle sonne quand le coup revient, et le coup revient plus fort.',
  flamberge:
    "Une épée à lame ondulée, trempée dans la flamme du camp. Le Gardien dit qu'elle a appartenu à quelqu'un qui est monté très haut. Elle ne pèse rien quand le geste est juste.",
} as const;

describe('the item descriptions (#284, D14)', () => {
  it('gives each of the 11 items of the game a description', () => {
    for (const item of Object.keys(ITEMS) as ItemKind[]) {
      expect(itemDescription(item).trim()).not.toBe('');
    }
  });

  it('copies 6 descriptions from the Codex, each matching the fingerprint of the story', () => {
    expect(Object.keys(CODEX_ITEM_DESCRIPTIONS).sort()).toEqual(
      Object.keys(STORY_FINGERPRINTS).sort(),
    );
    for (const [item, fingerprint] of Object.entries(STORY_FINGERPRINTS)) {
      const text = CODEX_ITEM_DESCRIPTIONS[item as keyof typeof STORY_FINGERPRINTS];
      expect([item, sha256(text)]).toEqual([item, fingerprint]);
      expect(itemDescription(item as ItemKind)).toBe(text);
    }
  });

  it('keeps the 5 descriptions already in the game', () => {
    for (const [item, text] of Object.entries(IN_THE_GAME)) {
      expect(itemDescription(item as ItemKind)).toBe(text);
    }
  });

  it('computes the fingerprint as the canonical JSON of the text, in UTF-8', () => {
    // `json.dumps("é", ensure_ascii=False)` est `"é"`, en 4 octets UTF-8.
    expect(sha256('é')).toBe(createHash('sha256').update('"é"', 'utf8').digest('hex'));
  });
});
