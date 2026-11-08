/**
 * Aide de test (#257, EE10) : un combat d'Élite du palier 3 tel que `develop` l'enregistrait avant
 * l'Élite escortée, écrit à la main : le Premier Pèlerin seul, au multiplicateur d'Élite et de boss
 * d'alors (135 % des PV et des dégâts, 150 % de la garde : 364 PV, garde 82), entamé à 300 PV, sans
 * escorte ni `escortMultiplier`, en phase du héros de la manche 2.
 */
export const ELITE_BATTLE_BEFORE_257 = `{
  "now": 9000,
  "random": 1199730146,
  "inputOffset": 0,
  "round": 2,
  "heroKind": "sentinel",
  "initiative": true,
  "tierMultiplier": { "hpPercent": 135, "guardPercent": 150 },
  "summonMultiplier": { "hpPercent": 175, "guardPercent": 150 },
  "respitePercent": 5,
  "hero": { "hp": 70, "maxHp": 80, "momentum": 2, "bulwark": false },
  "enemies": [
    {
      "kind": "firstPilgrim",
      "hp": 300,
      "maxHp": 364,
      "guard": 60,
      "maxGuard": 82,
      "intent": null,
      "stun": null,
      "raised": false,
      "raisedRound": null,
      "guardRestore": null
    }
  ],
  "reserve": [],
  "target": 0,
  "phase": { "kind": "hero", "since": 9000, "announced": true },
  "turn": { "order": [0, "hero"], "position": 1 },
  "lastPlayed": null,
  "heroActions": 1,
  "offBalanceUntil": null,
  "hitStop": null,
  "defenseHintPending": false
}`;
