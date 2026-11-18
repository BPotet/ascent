// Stryker disable all
/*
 * Les descriptions de 6 objets, recopiées telles quelles du Codex de l'Atelier de l'ascension
 * (collection `codex`) le 18/11/2026, en lecture seule (#284, D14, ADR 0010, ADR 0031). Pour chaque
 * texte : le document du Codex et sa version, l'empreinte sha256 du document (`data`) et celle de la
 * description, en JSON canonique (`json.dumps(…, sort_keys=True, separators=(',', ':'),
 * ensure_ascii=False)`, en UTF-8), recopiées de la story et recalculées par `itemDescriptions.test.ts`.
 * Une version de document différente arrête la recopie. Ne pas retoucher à la main : toute retouche
 * passe par l'Atelier.
 */

/** Les descriptions recopiées du Codex, par nom de code d'objet. */
export const CODEX_ITEM_DESCRIPTIONS = {
  /*
   * Hache rouillée : `codex/axe` version 3
   * (document e150055f7854ed97a5e77821d929c2ee368c181115b669e6698e6a17fd158cbd,
   * description 09670d570899add905006b4247ab2aff88eb1b9b0ad81d24cafab123038dbfef).
   */
  axe: 'Une hache de bûcheron, ébréchée sur les boucliers des morts. Elle fend la garde plus que la chair.',
  /*
   * Cuir : `codex/leather` version 1
   * (document 6370f9ac291e36e431a358a7e93ade50654b138e019b887497d2e91293f92328,
   * description 178a9d6df221f6e67aafcc1cc553fd9a2a3898d3c9cf4ae0f3edda267a896d7a).
   */
  leather:
    'Une armure souple, tannée par les années et la pluie. Elle laisse au bras la liberté de frapper juste.',
  /*
   * Mailles : `codex/chainmail` version 1
   * (document 69c991d2321343cab3329102860300528ba61fec4feabef2806d2672af44fdee,
   * description 8db04257c2320f9898de17dc5fe6e0f4efdc8db73b2b10107c87b9ad6261a0d5).
   */
  chainmail:
    "Des anneaux rouillés, lourds sur les épaules. Ils retiennent ce que la lame de l'autre ne retient pas.",
  /*
   * Bouclier du veilleur : `codex/watchmanShield` version 1
   * (document 006c1dfc3208a99deeed0afefe6617117ee499e7285209e019c5f0b1d3770576,
   * description f628886ab7fbc40c1c8c6a75a4cc0e76bfef1b2a964446496d30d6d40cc80248).
   */
  watchmanShield:
    "Le bouclier d'un guetteur mort à son poste. Chaque coup bien paré lui rend un peu de la chaleur qu'il a perdue.",
  /*
   * Amulette de Hâte : `codex/hasteAmulet` version 1
   * (document 22e496e51f71a19f697be94f1c08b539921bc2409fefec119f19597e28d56f31,
   * description f8ec2faa68594478dcdb7cfb9a8d39e772d6f43a6c63a5e8264f2890c74c9e3b).
   */
  hasteAmulet:
    'Un pendentif de verre où tourne un sable qui ne tombe jamais. Celui qui le porte agit avant les autres.',
  /*
   * Arbalète : `codex/nouvelleArme` version 8, `code` = `crossbow`
   * (document f3c54323c79b8c225e8b91c0ee3d9a6547cd51c617b7f41e046eaf9d572b7363,
   * description 75168be44a2bb85e4a16c9c9d8c2247093f6a32ca0ed2b599a6ecef261dbe746).
   */
  crossbow:
    "Une arbalète de guet, la corde raidie par le froid des étages. Elle tire avant que l'autre ait levé son arme.",
} as const;
