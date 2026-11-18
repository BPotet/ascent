// Stryker disable all
/*
 * Le contenu des pages des ennemis (#283, ADR 0032, D11) : des données seules, recopiées telles
 * quelles, sans aucune fonction. Ne pas retoucher à la main : toute retouche passe par l'Atelier.
 *
 * - L'Histoire, le nom et la description de chaque coup, la description de chaque phase d'un boss
 *   et la phrase « Soutien » de la Glaneuse de cendre et de la Sonneuse de matines : le Codex de
 *   l'Atelier de l'ascension, lu le 18/11/2026, fiche par fiche, avec sa version et la sha256 de la
 *   fiche (JSON compact, clés triées). Les textes sont ceux de la copie de la maquette 278 du
 *   12/11/2026 (`CX`), à une exception près, notée sur la fiche du Nécromancien.
 * - Les autres phrases des mécaniques : la maquette 278 corrigée par le GD, recopiées telles
 *   quelles, sans dégâts chiffrés (B21).
 * - Écrits pour cette story, à relire par le GD : l'Invocation de la Reine des phalènes, et
 *   Frôlement (Phalène voleuse) sans son chiffre ; le Codex n'est pas modifié.
 *
 * Pour un boss, la seconde phase ne donne que les coups qu'elle ajoute. `attack` est recopié pour
 * être vérifié contre la fiche du domaine (`ENEMIES`).
 */
import type { AttackKind } from '../../../../domain/battle/attacks';
import type { EnemyKind } from '../../../../domain/battle/combatants';
import type { PageMechanic } from '../../../../domain/discoveryBook/enemyPage';

/** Un coup de la page : son type, son nom et sa description, du Codex. */
export interface EnemyMoveText {
  readonly attack: AttackKind;
  readonly name: string;
  readonly description: string;
}

/** Une phase de la page : sa description (celle d'un boss) et ses coups. */
export interface EnemyPhaseText {
  readonly description?: string;
  readonly moves: readonly EnemyMoveText[];
}

/** Les textes de la page d'un ennemi : son Histoire, la phrase de chaque mécanique, ses phases. */
export interface EnemyPageText {
  readonly lore: string;
  readonly mechanics: Readonly<Partial<Record<PageMechanic, string>>>;
  readonly phases: readonly EnemyPhaseText[];
}

export const ENEMY_PAGES: Readonly<Record<EnemyKind, EnemyPageText>> = {
  // `codex/ghoul` v3 (31a68786671d0dfe0c44baf264bf1172598118ec29613ff456f14c487c34f445).
  ghoul: {
    lore: 'Ce qui reste des fossoyeurs des Catacombes. Elle ne se souvient que de la faim, et creuse encore.',
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Griffes de fossoyeur',
            description:
              "La Goule se ramasse sur elle-même, les doigts crochus levés, puis se jette d'un seul élan. Une anticipation franche, un reflet blanc, un seul impact : parez à l'arrivée de la ruée.",
          },
          {
            attack: 'double',
            name: 'Pelletées',
            description:
              'Elle frappe deux fois de suite, comme on creuse, le bras qui retombe à peine relevé. Le reflet se dédouble avant le premier impact : il faut parer les deux pour lui rendre le coup.',
          },
        ],
      },
    ],
  },
  // `codex/specter` v3 (76f98cadc87b76157aa1d74eb39ba50b36514c0a16d9cc801b00799027c1dae0).
  specter: {
    lore: "Un souffle froid qui porte un visage emprunté. Il frappe avant qu'on l'ait vu venir, et ne frappe jamais deux fois de la même façon.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'delayed',
            name: 'Souffle retenu',
            description:
              "Le Spectre recule et reste suspendu, tremblant, bien plus longtemps qu'on ne l'attend. Ne parez pas pendant l'hésitation : attendez que la ruée parte.",
          },
          {
            attack: 'feint',
            name: 'Visage emprunté',
            description:
              "Il s'élance, puis s'arrête court au milieu de sa préparation, le temps qu'un autre visage passe sur le sien. Un reflet terne marque cette fausse ruée : qui pare là pare le vide. Le vrai coup vient ensuite.",
          },
          {
            attack: 'perilous',
            name: 'Étreinte glacée',
            description:
              'Sa forme vire au rouge et le sceau pulse au-dessus de lui pendant toute la préparation. Aucune parade ne retient ce froid : esquivez.',
          },
        ],
      },
    ],
  },
  // Coup sans nom ni description dans le Codex du jour : la révision du 26/10/2026 (maquette 278).
  // `codex/necromancer` v5 (967b8d4c88f23c680eb6fd6b081b5ac0a62abf1b2bb65fe91c8be895a7e707a0).
  necromancer: {
    lore: "Il garde les morts comme d'autres gardent un troupeau. Tant qu'il veille, rien de ce qui tombe ne reste tombé.",
    mechanics: {
      support:
        'Quand un allié tombe, il le relève une fois, avec la moitié de ses PV. Garde entamée, il peut la refermer. Il ne vient jamais seul.',
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Bâton des veilles',
            description:
              "Il lève son bâton sans hâte et l'abat d'un coup sec, comme on frappe à une porte. Une préparation lente et lisible, un seul impact.",
          },
        ],
      },
    ],
  },
  // `codex/nouvelEnnemi` v29 (6870e5af33178e6705355ed778e0344727a9c5907f634471fe24d7e0d71b68a9).
  skeleton: {
    lore: "Quand il tombe, ses os se rassemblent et il se relève de lui-même. Il faut l'achever une fois de plus pour qu'il reste à terre.",
    mechanics: {
      selfRevive:
        "Quand il tombe, il se relève aussitôt, une fois, avec la moitié de ses PV. Il faut l'abattre une seconde fois.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: "Tir à l'arc",
            description:
              'Le Squelette bande son arc, puis décoche sur le héros. Un reflet blanc, un seul trait, un seul impact : parez à son arrivée.',
          },
        ],
      },
    ],
  },
  // `codex/nouvelEnnemi2` v34 (dec1e96300f7ab4721c4bb5b8e93b4f58da7ca89ce854640bac15c6c74f96831).
  madVillager: {
    lore: "Poussé par le désespoir, il a voulu atteindre le sommet de la tour, où se trouverait, dit-on, de quoi exaucer tous les vœux de celui qui l'atteint. À force d'errer dans ses étages, il en est devenu fou. Il ne lâche plus sa fourche.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Fourche',
            description:
              "Il plante sa fourche droit devant lui. Un reflet blanc, un seul impact : si les dents touchent, la plaie saigne pendant quelques manches. Seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'basic',
            name: 'Coup de manche',
            description:
              'Il retourne sa fourche et frappe du manche, sans viser, en marmonnant. Un seul impact, et pas de saignement.',
          },
        ],
      },
    ],
  },
  // `codex/candleBearer` v1 (67eac4569760a0f24eaeb22ac3b24ed777e5d32d39a5a9fe6dd1bb734aee0e2a).
  candleBearer: {
    lore: "Il guidait les processions dans les Catacombes. Tant qu'il tient son cierge, les morts autour de lui frappent plus fort.",
    mechanics: {
      aura: "Tant qu'il est debout, même étourdi, les autres ennemis frappent plus fort. Abats-le d'abord. Il ne vient jamais seul.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Coup de cierge',
            description: 'Il abat son cierge comme une masse. Un reflet blanc, un seul impact.',
          },
        ],
      },
    ],
  },
  // `codex/cryptRat` v1 (5bf7bf53b31354d8795f65e0cb782d19ad4e7811306b05f4fb57009be18f3cf0).
  cryptRat: {
    lore: "Les rats des Catacombes viennent en meute. Seuls, ils tombent d'une bonne frappe ; ensemble, chacun mord plus fort.",
    mechanics: {
      swarm:
        "Il mord plus fort quand d'autres Rats de crypte sont debout. Ils viennent jusqu'à 3 : chaque Rat abattu affaiblit la meute.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Morsure',
            description: 'Il bondit et mord. Un reflet blanc, un seul impact.',
          },
          {
            attack: 'double',
            name: 'Grouillement',
            description:
              'Il grouille sous les pieds et mord deux fois. Le reflet se dédouble : deux impacts, deux parades.',
          },
        ],
      },
    ],
  },
  // `codex/fallenKnight` v5 (4ea953e20c0063fc800d9e6686da1576c92b46624d163c6dce392f48978bec84).
  fallenKnight: {
    lore: 'Il a juré de défendre la porte de la tour. Il la défend encore, contre tous ceux qui montent, sans se rappeler pour qui.',
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Taille du serment',
            description:
              "Le Chevalier lève la hache à deux mains au-dessus du heaume et l'abat droit devant lui. Lourd mais loyal : le fer tombe d'un seul trait, sans détour.",
          },
          {
            attack: 'delayed',
            name: 'Garde tenue',
            description:
              "Il arme son coup et le garde levé, immobile, comme s'il attendait un ordre qui ne viendra plus. Le fer tremble pendant l'hésitation : parez à la ruée, pas avant.",
          },
          {
            attack: 'perilous',
            name: 'Charge de la porte',
            description:
              "Il baisse l'épaule derrière son écu fendu, sa silhouette rougit et le sceau s'allume au-dessus de lui. On ne pare pas une porte qui s'effondre : esquivez.",
          },
        ],
      },
    ],
  },
  // `codex/nouvelleElite` v61 (f91aa8e253a257efc8c98d411d24cba0bf500b731ad56fe0fe3859b9348bb84f).
  twins: {
    lore: 'Deux frères, deux héros, tombés ensemble dans la tour. Un nécromancien a voulu les relever et a échoué : leurs corps se sont fondus en un seul amas de chair, une moitié pour chacun.',
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Frappe en double',
            description:
              "Les Jumeaux frappent chacun leur tour, l'épée de la main gauche, puis celle de la main droite. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Onde de choc',
            description:
              "Les Jumeaux préparent longuement leur coup, puis frappent le sol de leurs deux épées à la fois. Le sceau rouge pulse pendant toute l'hésitation : cette onde de choc ne se pare pas. Esquivez quand la ruée part.",
          },
          {
            attack: 'basic',
            name: "Carreau d'arbalète",
            description:
              'Les Jumeaux sortent une arbalète et tirent un seul carreau. Un reflet blanc, un seul impact.',
          },
        ],
      },
    ],
  },
  // `codex/gravedigger` v1 (dea86734e85556d73cac94c882f926c68dbf0fd3a7f25d5297cac6b6f7b24de6).
  gravedigger: {
    lore: "Il a creusé toutes les tombes des Catacombes, une à une, pendant des siècles. Il creuse encore, mais à l'envers : ce qu'il sort de terre se relève et marche.",
    mechanics: {
      exhume:
        "Aux manches paires, il exhume un Squelette, s'il n'en a pas un debout. Brise sa garde avant pour l'en empêcher.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Coup de pelle',
            description:
              "Il lève sa pelle et l'abat à plat, d'un seul coup. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'double',
            name: 'Terre jetée',
            description:
              'Il charge sa pelle de terre et la lance deux fois au visage du héros. Le reflet se dédouble : deux impacts, deux parades.',
          },
          {
            attack: 'perilous',
            name: 'Fosse ouverte',
            description:
              "Il frappe le sol et la terre s'ouvre sous le héros ; sa silhouette rougit et le sceau pulse. Ce coup-là ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/ossuaryWarden` v2 (1d9f71865c207e1c23d2513d0b24a976ad753a4b89452a28dc301f1774409537).
  ossuaryWarden: {
    lore: 'Elle range les os des oubliés depuis des siècles, lentement, un par un. Chaque intrus est une place de plus sur ses étagères.',
    mechanics: {
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          "Elle va et vient entre ses étagères, un os à la main, sans colère. Ses gestes sont amples et lents : c'est le moment d'apprendre son rythme.",
        moves: [
          {
            attack: 'basic',
            name: 'Fémur',
            description:
              "Elle frappe avec un long fémur, d'un geste ample et patient. Une anticipation large, un reflet blanc, un seul impact.",
          },
          {
            attack: 'delayed',
            name: 'Pesée',
            description:
              "Elle soupèse l'intrus du regard, l'os levé, et suspend son geste longtemps. Laissez passer l'hésitation : la ruée part quand on ne l'attend plus.",
          },
        ],
      },
      {
        description:
          "Sous la moitié de ses PV, les étagères s'effondrent derrière elle et les os roulent à ses pieds. Sa garde revient entière, elle agit plus tôt, et elle prend un os dans chaque main : elle ne range plus, elle veut en finir.",
        moves: [
          {
            attack: 'double',
            name: 'Deux tibias',
            description:
              "Elle frappe des deux mains, un os dans chacune, l'un juste après l'autre. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'perilous',
            name: 'Mise en ossuaire',
            description:
              "Elle ouvre grand les bras, comme pour ranger l'intrus avec les autres. Sa silhouette rougit et le sceau pulse au-dessus d'elle : ce geste-là ne se pare pas, esquivez.",
          },
        ],
      },
    ],
  },
  // `codex/facelessPrior` v2 (2103e6c747a74789cbdc4521ace251c467ab12643c61a66cf57d3b9196585b8f).
  facelessPrior: {
    lore: "Il a prié si longtemps qu'il a oublié son nom, puis ses traits. Ses gestes mentent, et sa voix aussi.",
    mechanics: {
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          'Il prie à mi-voix, la tête basse sous sa capuche. Ses gestes commencent comme des bénédictions et finissent en coups : regardez ses mains, jamais son attitude.',
        moves: [
          {
            attack: 'feint',
            name: 'Fausse bénédiction',
            description:
              "Il lève la main comme pour bénir, s'élance, puis s'arrête court. Un reflet terne marque la fausse ruée : ne parez pas, le vrai coup vient juste après.",
          },
          {
            attack: 'double',
            name: 'Chapelet de fer',
            description:
              "Il fouette deux fois avec son chapelet, à un souffle d'intervalle. Le reflet se dédouble avant le premier impact.",
          },
        ],
      },
      {
        description:
          "Sous la moitié de ses PV, sa capuche tombe : il n'y a rien dessous. Sa garde revient entière, sa prière monte et il agit plus tôt. À ses mensonges s'ajoutent des gestes qui attendent et d'autres qui ne se parent pas.",
        moves: [
          {
            attack: 'delayed',
            name: 'Silence du chœur',
            description:
              "Il se fige, les bras ouverts, et le silence dure plus longtemps qu'une prière. Laissez passer l'hésitation : la ruée part quand le silence se rompt.",
          },
          {
            attack: 'perilous',
            name: 'Absolution',
            description:
              'Il joint les mains au-dessus de sa tête vide, sa silhouette rougit et le sceau pulse au-dessus de lui. Ce pardon-là ne se pare pas : esquivez.',
          },
        ],
      },
    ],
  },
  // `codex/thornPilgrim` v3 (6540aa3a24565b74804b514e852cc3d1b2529070d544a844d5672e516f2383ab).
  thornPilgrim: {
    lore: "Il s'est assis pour reprendre son souffle, un soir, au milieu des jardins. Les ronces ont poussé sur lui pendant qu'il priait. Il prie encore, et elles le portent.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'delayed',
            name: "Prière d'épines",
            description:
              "Il lève lentement son bourdon couvert de ronces et le tient au-dessus de sa tête, le temps d'une prière. Laissez passer l'hésitation : si les épines touchent, la plaie saigne pendant quelques manches. Seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'basic',
            name: 'Bourdon',
            description:
              "Il abat son bâton de pèlerin d'un seul geste lourd. Un reflet blanc, un seul impact, pas d'épines.",
          },
        ],
      },
    ],
  },
  // `codex/ashBramble` v3 (d820769f3ab310b37a9369423cb2332a48d3aa838ee71932942e81e85f872833).
  ashBramble: {
    lore: 'Tout a brûlé, sauf elle. On la coupe, elle repousse ; on la coupe encore, elle repousse encore, un peu plus grise à chaque fois.',
    mechanics: {
      selfRevive:
        'Quand elle tombe, elle se relève aussitôt, deux fois, avec une partie de ses PV.',
    },
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Fouet de ronce',
            description:
              'Elle se dresse et fouette deux fois, la tige qui revient aussitôt. Le reflet se dédouble : deux impacts, deux parades.',
          },
          {
            attack: 'basic',
            name: 'Épine',
            description:
              "Elle se tend d'un coup vers le héros, une seule épine en avant. Un reflet blanc, un seul impact.",
          },
        ],
      },
    ],
  },
  // `codex/ashGleaner` v3 (9636b78cf7683d47f955f6101a56c2de4c089397731334336c638ff5ed35f5b4).
  ashGleaner: {
    lore: "Elle passe derrière les combats et ramasse ce qui est tombé, comme on glane un champ après la moisson. Ce qu'elle ramasse se relève.",
    mechanics: {
      support:
        "Quand un allié tombe, elle se penche sur lui et le relève, une seule fois, à la moitié de ses forces : une flèche vers le haut l'annonce. Quand sa garde est entamée, elle s'abrite derrière son râteau et la referme. Tant qu'elle glane, rien de ce qui tombe ne reste tombé.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Râteau',
            description:
              "Elle ramène son râteau vers elle d'un geste las, comme on ratisse la cendre. Une préparation lente et lisible, un seul impact.",
          },
        ],
      },
    ],
  },
  // `codex/smolderingBrand` v4 (555047c9cf5361b9a632a8b7aed8ec6efd21e2b4108e29129167ade354ef3015).
  burningHusk: {
    lore: "Un jardinier pris dans l'incendie, la nuit où les jardins ont brûlé. Il n'a jamais cessé de brûler. Il ne crie plus ; il tend seulement les bras vers ceux qui passent, comme pour partager sa chaleur.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Main de braise',
            description:
              "Il pose sa main en flammes sur le héros, presque doucement. Un reflet blanc, un seul impact : si elle touche, le héros brûle. Seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'perilous',
            name: 'Embrasement',
            description:
              "Il ouvre les bras, ses flammes virent au rouge et le sceau pulse au-dessus de lui : tout ce qui restait de l'incendie part d'un coup. Ça ne se pare pas : esquivez.",
          },
        ],
      },
    ],
  },
  // `codex/ashMoth` v4 (8ce25db74e1bb92ebed1fb1786ff2ec49a7e3b4c31905799105fed005b4427fb).
  mothkin: {
    lore: "Des pèlerins qui ont suivi la Reine des phalènes vers la lumière du sommet. La cendre a pris leurs corps : des ailes grises dans le dos, des mandibules à la place de la bouche, des gestes d'insecte. Ils tournent encore autour d'elle, et ne se souviennent plus d'avoir été des hommes.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'feint',
            name: 'Vol brisé',
            description:
              "Il bondit, ailes ouvertes, et ses ailes lâchent à mi-chemin dans un nuage de cendre ; il retombe, puis repart à pied. Un reflet terne marque l'arrêt : qui pare là pare la cendre. Le vrai coup vient juste après.",
          },
          {
            attack: 'double',
            name: 'Mandibules',
            description:
              'Il se jette en avant et mord deux fois, sec, comme un insecte. Le reflet se dédouble : deux impacts, deux parades.',
          },
        ],
      },
    ],
  },
  // `codex/emberPod` v1 (6825e825274b932c9e4c726b60a74aee44cfcb3fc4b4c77be5936f2e2cb16464).
  emberPod: {
    lore: "Une graine des Jardins de cendre, gorgée de braises. Abattue debout, elle éclate et brûle le héros ; étourdie, elle s'éteint sans rien allumer.",
    mechanics: {
      emberBurst:
        "Abattue debout, elle éclate et te brûle. Achevée étourdie, elle s'éteint sans rien allumer.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Éclat de coque',
            description:
              'Sa coque se fend et projette un éclat brûlant. Un reflet blanc, un seul impact.',
          },
          {
            attack: 'double',
            name: 'Crachin de cendre',
            description:
              'Elle crache deux bouffées de cendre chaude. Le reflet se dédouble : deux impacts, deux parades.',
          },
        ],
      },
    ],
  },
  // Frôlement réécrit sans chiffre (B21, à relire par le GD) : le Codex dit « lui vole 1 Élan ».
  // `codex/thievingMoth` v1 (c486543b4f7dd50e2c84c8661484e4b4f95bcea6ecee763cc83bc5762fd0bfdd).
  thievingMoth: {
    lore: "Une phalène violette aux ailes ocellées d'or, attirée par l'élan des héros comme par une flamme. Elle le leur vole à chaque contact.",
    mechanics: {
      momentumTheft:
        'Chaque impact qui te touche, bonne parade comprise, lui donne un peu de ton Élan. Une parade parfaite ou une esquive le protège.',
    },
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Frôlement',
            description:
              'Elle frôle deux fois le héros du bout des ailes. Le reflet se dédouble : deux impacts. Chaque impact qui te touche lui donne un peu de ton Élan.',
          },
          {
            attack: 'feint',
            name: "Poudre d'ailes",
            description:
              'Elle secoue ses ailes, fait mine de frapper, puis frappe vraiment. Attendez le vrai coup.',
          },
        ],
      },
    ],
  },
  // `codex/scarecrow` v3 (0126979e947445aa3ce0b47f738e5e4f76f1230896e4af01776483f84719bc01).
  scarecrow: {
    lore: "Planté là pour garder les vœux semés dans les jardins. Les oiseaux sont partis, les vœux ont brûlé, et il garde toujours. Quand on l'abat, la paille se rassemble et il se redresse sur son pieu.",
    mechanics: {
      selfRevive: "Quand on l'abat, il se redresse aussitôt, une fois, avec une partie de ses PV.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Faucille',
            description:
              "Il fauche d'un grand geste du bras, la lame rouillée au bout de la manche. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'feint',
            name: 'Bras ballant',
            description:
              "Son bras de paille part, retombe mollement à mi-chemin comme si le vent l'avait lâché, puis repart d'un coup. Le reflet terne marque la fausse ruée : attendez le vrai coup.",
          },
          {
            attack: 'perilous',
            name: 'Moisson',
            description:
              'Il lève la faucille à deux mains au-dessus de son chapeau, sa paille rougit et le sceau pulse au-dessus de lui. On ne pare pas une moisson : esquivez.',
          },
        ],
      },
    ],
  },
  // `codex/brambleBurner` v4 (4ac53d4feeba10d6d926c6cc936ca9bb6ac96c9d3e0fc7abef261c6d729fd154).
  brambleBurner: {
    lore: 'On lui avait demandé de brûler les mauvaises herbes. Il a voulu bien faire, et il a mis le feu à tous les jardins. Il cherche encore les ronces, sa torche à la main.',
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Torche',
            description:
              "Il abat sa torche de haut en bas, dans une pluie d'étincelles. Un reflet blanc, un seul impact : si elle touche, le héros brûle. Seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'double',
            name: "Fagot d'épines",
            description:
              "Il fouette deux fois avec un fagot de ronces sèches. Le reflet se dédouble : deux impacts. Chaque épine qui touche fait saigner ; seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Feu de broussailles',
            description:
              "Il lève sa torche et la tient haute, longtemps, pendant que le feu prend ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Ce feu-là ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/brambleMother` v1 (9e849bd533032c6c6f7258a6068190a8b50ac4dca73d9e26e5431dbb95ea9d66).
  brambleMother: {
    lore: 'La première ronce des Jardins de cendre, celle qui a survécu au feu. Elle a pris forme pour défendre ce qui reste du jardin, et quiconque la touche se pique.',
    mechanics: {
      thorns:
        'Chaque frappe qui la touche te pique et te coûte des PV, sauf quand elle est étourdie.',
    },
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Lianes',
            description:
              'Elle fouette deux fois avec ses bras de lianes. Le reflet se dédouble : deux impacts, deux parades.',
          },
          {
            attack: 'delayed',
            name: "Étreinte d'épines",
            description:
              "Elle ouvre les bras et attend, longtemps, avant de refermer ses épines sur le héros. Laissez passer l'hésitation ; si elle touche, le héros saigne.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Floraison noire',
            description:
              "Ses fleurs noires s'ouvrent toutes à la fois ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Ce coup-là ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/ashGardener` v2 (e1bc051eba2d290b70da67d42f126a63a8cbdeec5902e04086089b5127351b5e).
  ashGardener: {
    lore: "Chaque pèlerin qui passe lui confie un vœu, et elle le met en terre. Rien n'a poussé depuis l'incendie. Elle continue de planter, et elle voudrait bien que vous restiez pour l'aider.",
    mechanics: {
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          "Elle soigne ses plates-bandes de cendre sans se presser, et vous traite comme une mauvaise herbe. Elle est lente : vous agissez presque toujours avant elle. C'est le moment d'user sa garde.",
        moves: [
          {
            attack: 'basic',
            name: 'Sécateur',
            description:
              "Elle referme son grand sécateur d'un coup sec, comme on taille une branche morte. Une anticipation franche, un reflet blanc, un seul impact.",
          },
          {
            attack: 'delayed',
            name: 'Taille',
            description:
              "Elle ouvre le sécateur et attend, la tête penchée, que la branche soit bien en place. Laissez passer l'hésitation : la lame se referme quand on ne l'attend plus.",
          },
        ],
      },
      {
        description:
          'Sous la moitié de ses PV, elle arrache les ronces des plates-bandes à pleines mains. Sa garde revient entière, elle agit plus tôt, et ses coups font saigner. Elle ne jardine plus : elle veut vous mettre en terre.',
        moves: [
          {
            attack: 'double',
            name: 'Ronces',
            description:
              "Elle fouette deux fois avec une tige de ronce arrachée au sol. Le reflet se dédouble : deux impacts. Chaque épine qui touche fait saigner ; seules une parade parfaite ou une esquive l'évitent.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Mise en terre',
            description:
              "Elle lève sa bêche des deux mains et la garde haute, longtemps ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Ce coup-là ne se pare pas : esquivez quand la bêche tombe.",
          },
        ],
      },
    ],
  },
  // `codex/mothQueen` v3 (a7095d17fe3fb82cca90d09ea04c1f45e4fd8e7a2c616398e944f6573056c2d6).
  mothQueen: {
    lore: "La première à avoir vu la lumière du sommet, et la première à s'y être brûlée. Ses ailes ne la portent plus, mais ceux qui l'ont suivie, devenus Phalénides, reviennent toujours à elle.",
    mechanics: {
      summon:
        'Sous la moitié de ses PV, elle appelle deux Phalénides à ses côtés. Ils retombent en cendre avec elle.',
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          "Elle tourne autour du héros comme autour d'une lampe, vite, sans jamais se poser. Elle agit souvent avant vous : regardez ses ailes, pas son corps.",
        moves: [
          {
            attack: 'feint',
            name: 'Voile de poussière',
            description:
              "Elle déploie ses ailes brûlées, s'élance et s'arrête court dans un nuage de cendre. Un reflet terne marque la fausse ruée : ne parez pas, le vrai coup vient juste après.",
          },
          {
            attack: 'double',
            name: 'Ailes de cendre',
            description:
              "Deux coups d'ailes, l'un sur l'autre, qui soulèvent la cendre du jardin. Le reflet se dédouble : deux impacts, deux parades.",
          },
        ],
      },
      {
        description:
          'Sous la moitié de ses PV, elle appelle : deux Phalénides sortent de la poussière et viennent se battre à ses côtés. Sa garde revient entière et elle agit plus tôt encore. Abattez-les, ou ignorez-les pour finir la Reine : ils retombent en cendre avec elle.',
        moves: [
          {
            attack: 'perilous',
            name: 'Flamme de la lampe',
            description:
              "Elle replie ses ailes sur une lueur qui brûle encore en elle ; sa silhouette rougit et le sceau pulse au-dessus d'elle. Cette flamme ne se pare pas : esquivez.",
          },
        ],
      },
    ],
  },
  // `codex/bronzeWarden` v3 (21998f92f913ccb7c94845587d4cdd640c5ce05fb070635fa265c4c20f09debb).
  bronzeWarden: {
    lore: "Une statue de bronze posée au pied des cloches pour veiller sur les heures. Personne ne lui a dit de s'arrêter. Il frappe à chaque heure, et toutes les heures se ressemblent.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: "Poing d'airain",
            description:
              "Il lève un poing de bronze et l'abat d'un bloc, sans hâte et sans détour. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Glas',
            description:
              "Il frappe sa propre poitrine, qui sonne comme une cloche, puis garde le bras levé ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Ce coup ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/gargoyle` v4 (6f6d8cbb6a0be28f74ed85a9517aae50b5742ac1c58025ebfdb34846d5232efd).
  gargoyle: {
    lore: "Elle crachait la pluie loin des murs du Beffroi. Il ne pleut plus depuis longtemps à cette hauteur. Quelque chose s'est logé dans la pierre, et c'est du feu qu'elle crache maintenant.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'feint',
            name: 'Piqué de pierre',
            description:
              "Elle se laisse tomber de son perchoir, se rattrape à mi-chemin d'un battement d'ailes de pierre, puis plonge pour de bon. Un reflet terne marque la fausse ruée.",
          },
          {
            attack: 'delayed',
            name: 'Gueule de feu',
            description:
              "Elle ouvre une gueule de gouttière où rougeoie une braise, et attend, immobile comme une statue, bien plus longtemps qu'on ne l'attend. Laissez passer l'hésitation : si les flammes touchent, le héros brûle. Seules une parade parfaite ou une esquive l'évitent.",
          },
        ],
      },
    ],
  },
  // `codex/bellFounder` v4 (0dd26622552e5d1bce739b6cc6c14950815fc0d0e664afe1f23e302eff005b25).
  bellFounder: {
    lore: "Il a fondu toutes les cloches du Beffroi, une par jour. Il en fond encore, pour des jours qui ne viendront plus, et il ne sait plus s'arrêter.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Marteau de fonte',
            description:
              "Il frappe deux fois, comme sur l'enclume, au même rythme qu'à l'atelier. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'delayed',
            name: 'Coulée',
            description:
              "Il lève son creuset à deux mains et le tient au-dessus de sa tête, longtemps, puis bondit sur le héros et le renverse sur lui. Laissez passer l'hésitation : si le bronze en fusion touche, le héros brûle. Seules une parade parfaite ou une esquive l'évitent.",
          },
        ],
      },
    ],
  },
  // `codex/bellNovice` v3 (93b9be88c9ccbebe2048bcb4d979617246995ab9e65e631ad45e25d8832ea465).
  bellNovice: {
    lore: "Des enfants montés au Beffroi pour apprendre à sonner les heures. Le Sonneur ne leur a jamais laissé la corde. Ils attendent leur tour depuis si longtemps qu'ils ont oublié pourquoi, et ils frappent ceux qui montent, de peur qu'on le leur prenne.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Bout de corde',
            description:
              "Il fait tourner un bout de corde effilochée au-dessus de sa tête, puis le lance d'un coup sec. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'delayed',
            name: 'Volée manquée',
            description:
              "Il tire de tout son poids sur une corde invisible et reste suspendu, les pieds dans le vide, comme une cloche qui ne veut pas partir. Laissez passer l'hésitation : il retombe sur le héros quand on ne l'attend plus.",
          },
        ],
      },
    ],
  },
  // `codex/matinsRinger` v3 (2db1235252145bd2dbf884784057e7fd43fd61e0baefb97d6af9d414cc0cf5db).
  matinsRinger: {
    lore: "Chaque matin, elle sonnait la première heure, et le village se levait. Il n'y a plus de village. Elle sonne quand même, et ceux qui sont tombés autour d'elle se relèvent, comme chaque matin.",
    mechanics: {
      support:
        "Quand un allié tombe, elle agite sa clochette au-dessus de lui et il se relève, une seule fois, à la moitié de ses forces : une flèche vers le haut l'annonce. Quand sa garde est entamée, elle serre sa clochette contre elle et la referme. Tant qu'elle sonne matines, rien de ce qui tombe ne reste tombé.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'delayed',
            name: 'Angélus',
            description:
              "Elle lève sa clochette et la tient immobile, sans un son, le temps d'une prière. Laissez passer l'hésitation : le coup tombe au premier tintement.",
          },
        ],
      },
    ],
  },
  // `codex/clockJack` v3 (0304b3c6e7706fef7d271fc4c0f01c574d504f0b5bef8f8fc5ba0a97081f3f84).
  clockJack: {
    lore: "Un automate de bois peint et de fer, monté sur l'horloge pour frapper les heures au marteau. Le mécanisme ne s'est jamais arrêté. Il attend toujours la fin, puis il frappe, à l'heure exacte, sans se demander laquelle.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Demi-heure',
            description:
              "Il pivote sur son axe en grinçant et frappe deux fois, ding, dong, au même rythme que l'horloge. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'perilous',
            name: 'Heure pleine',
            description:
              "Son mécanisme se remonte d'un cran, son marteau monte jusqu'au bout de sa course, sa peinture rougit et le sceau pulse au-dessus de lui. L'heure ne se pare pas : esquivez quand le marteau tombe.",
          },
        ],
      },
    ],
  },
  // `codex/bronzeRam` v1 (b523363f844f4d98fa77aeebea89182a2a1114d6943998815868680b34f10b96).
  bronzeRam: {
    lore: "Un automate du Beffroi, fondu pour enfoncer les portes que les cloches n'ouvraient pas. Quand il baisse la tête, rien ne l'arrête, sauf une garde brisée.",
    mechanics: {
      charge:
        "Il charge pendant deux manches avant son Coup de bélier. Brise sa garde pendant la charge pour l'annuler.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Coup de front',
            description:
              'Il donne un coup de tête de bronze, sec et court. Un reflet blanc, un seul impact.',
          },
          {
            attack: 'delayed',
            name: 'Coup de bélier',
            description:
              "Il baisse la tête et charge pendant toute une manche, en piaffant ; à la suivante, il se rue. Brise sa garde pendant la charge pour l'arrêter, sinon laissez passer l'hésitation : le coup tombe tard.",
          },
        ],
      },
    ],
  },
  // `codex/bellClapper` v1 (baa551e284691ee32362b90d7d77ff11efcac1686c12d0e06abe50582247fe47).
  bellClapper: {
    lore: "Le battant d'une cloche fêlée, tombé de son beffroi, qui s'est mis à marcher. Il balaie tout ce qui passe à hauteur de chevilles.",
    mechanics: {
      sweep:
        "Un coup au ras du sol, qui se pare. L'esquiver, c'est le prendre en entier, et perdre l'équilibre.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'sweep',
            name: 'Grand balayage',
            description:
              "Il arme bas, à l'horizontale, et balaie le sol d'un coup de battant. On ne saute pas un balayage : il faut parer.",
          },
          {
            attack: 'basic',
            name: 'Coup de battant',
            description:
              'Il frappe de haut en bas, comme on sonne une cloche. Un reflet blanc, un seul impact.',
          },
        ],
      },
    ],
  },
  // `codex/firstPilgrim` v2 (88c3709b2af1ce414c350f0678db0f871ea6b9b5b5fef213f876ac83c4d14624).
  firstPilgrim: {
    lore: "Il est arrivé au sommet avant tous les autres, et il a fait le vœu de ne jamais redescendre. Le vœu a été exaucé. Il garde l'escalier des cloches et connaît tous les gestes de ceux qui sont tombés en dessous.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'double',
            name: 'Pas des Jumeaux',
            description:
              "Il frappe deux fois, d'une main puis de l'autre, comme les frères qu'il a vus tomber. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'feint',
            name: 'Visage du Prieur',
            description:
              "Il lève la main comme pour bénir, s'élance et s'arrête court. Un reflet terne marque la fausse ruée : le vrai coup vient juste après.",
          },
          {
            attack: 'delayed',
            name: 'Garde du Chevalier',
            description:
              "Il arme son bourdon et le tient levé, immobile, comme un chevalier qui attend un ordre. Laissez passer l'hésitation.",
          },
          {
            attack: 'perilous',
            name: 'Dernier pas',
            description:
              "Il se redresse de toute sa taille, sa silhouette rougit et le sceau pulse au-dessus de lui : c'est le pas qui l'a mené au sommet. Il ne se pare pas : esquivez.",
          },
        ],
      },
    ],
  },
  // `codex/stoneSaint` v2 (10dc891de95732b1321fbb19a82d1266a66baeee8b281fe528caa57db646f704).
  stoneSaint: {
    lore: "La statue d'un saint dont plus personne ne sait le nom, posée sous la grande cloche pour la bénir. Elle est descendue de son socle. Elle bénit encore, et ses bénédictions écrasent.",
    mechanics: {},
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Bénédiction de pierre',
            description:
              "Il lève sa main de pierre et l'abat comme on bénit, lourdement. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'delayed',
            name: 'Pénitence',
            description:
              "Il joint les mains et reste ainsi, figé, le temps d'une longue prière. Laissez passer l'hésitation : le coup tombe à l'amen.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Chute du clocher',
            description:
              "Il lève les deux bras vers la cloche, sa pierre rougit et le sceau pulse pendant toute l'hésitation ; le plafond tremble. Ce coup-là ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/beadle` v1 (6c32e3889b60570e19cd365af03b7f42c48b6a3998b721834640ec77f6c21c4b).
  beadle: {
    lore: "Il gardait le Beffroi et faisait taire les fidèles. Il garde encore la porte, sous le sanctuaire de sa cloche : tant qu'il tient sa garde, rien ne l'atteint vraiment.",
    mechanics: {
      sanctuary:
        "Tant que sa garde tient et qu'il n'est pas étourdi, tes coups ne lui retirent que la moitié des PV. Brise sa garde pour frapper en entier.",
    },
    phases: [
      {
        moves: [
          {
            attack: 'basic',
            name: 'Bâton de procession',
            description:
              "Il abat son bâton de procession, d'un seul coup. Un reflet blanc, un seul impact.",
          },
          {
            attack: 'feint',
            name: '« Silence ! »',
            description:
              'Il porte un doigt à ses lèvres et retient son bâton : une fausse amorce, puis le vrai coup. Attendez le vrai.',
          },
          {
            attack: 'delayedPerilous',
            name: 'Volée du beffroi',
            description:
              "Il lève son bâton et sa cloche sonne à toute volée ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Ce coup-là ne se pare pas : esquivez quand il tombe.",
          },
        ],
      },
    ],
  },
  // `codex/hourRinger` v2 (652b23957e7c9bb7b1ae78b1c94243cc248b47eb8c2ecb96d6585f1f630836ab).
  hourRinger: {
    lore: "Il sonne chaque jour qui passe, depuis toujours, sans en manquer un seul. Il n'a jamais su pourquoi. Il voudrait que quelqu'un d'autre tienne la corde, une fois, rien qu'une.",
    mechanics: {
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          'Il sonne les heures, régulier comme une habitude. Ses coups vont par deux, toujours au même rythme : apprenez-le, il ne change pas.',
        moves: [
          {
            attack: 'double',
            name: 'Carillon',
            description:
              "Il tire deux fois sur la corde, et deux battants s'abattent l'un après l'autre. Le reflet se dédouble : deux impacts, en rythme, comme deux coups d'horloge.",
          },
          {
            attack: 'delayed',
            name: 'Heure suspendue',
            description:
              "Il tient la corde tendue, le battant levé, et l'heure ne sonne pas. Laissez passer l'hésitation : le coup tombe quand le silence se rompt.",
          },
        ],
      },
      {
        description:
          "Sous la moitié de ses PV, la grande cloche se fend et sonne faux. Sa garde revient entière, il agit plus tôt, et son rythme se dérègle : des heures fausses, et un glas qu'il faut esquiver.",
        moves: [
          {
            attack: 'feint',
            name: 'Fausse heure',
            description:
              "La cloche part, puis s'arrête à mi-volée, comme une horloge qui se trompe. Un reflet terne marque la fausse ruée : le vrai coup vient juste après.",
          },
          {
            attack: 'delayedPerilous',
            name: 'Glas de minuit',
            description:
              "Il lâche la corde et prend le battant à bras-le-corps ; sa silhouette rougit et le sceau pulse pendant toute l'hésitation. Le glas ne se pare pas : esquivez quand il sonne.",
          },
        ],
      },
    ],
  },
  // `codex/wishGranter` v2 (b814cf17efd7fbd2af96a132eb7fc34eed41bf4d175ae9d2ada885a2c3bd1fe8).
  wishGranter: {
    lore: "Elle attend au sommet, entre les cloches. Elle a exaucé tous ceux qui sont montés jusqu'à elle : le Chevalier, les Jumeaux, la Jardinière, le Premier Pèlerin. Elle n'a jamais compris pourquoi aucun n'est redescendu heureux.",
    mechanics: {
      phaseShift:
        "Sous la moitié de ses PV, sa garde revient entière et ses coups de phase 2 s'ajoutent.",
    },
    phases: [
      {
        description:
          'Elle vous écoute. Ses gestes sont doux et ils mentent : elle promet, puis elle frappe. Parez la main, jamais le sourire.',
        moves: [
          {
            attack: 'basic',
            name: 'Main tendue',
            description:
              'Elle tend la main comme pour recevoir un vœu, puis frappe du revers. Un reflet blanc, un seul impact.',
          },
          {
            attack: 'feint',
            name: 'Promesse',
            description:
              "Elle s'avance avec un sourire, s'arrête comme si elle écoutait, puis frappe. Un reflet terne marque la fausse ruée : ne parez pas sa promesse, parez son geste.",
          },
        ],
      },
      {
        description:
          'Sous la moitié de ses PV, elle cesse de sourire. Sa garde revient entière et elle agit plus tôt. Elle exauce enfin le vœu de tous ceux qui montent : rester ici, pour toujours.',
        moves: [
          {
            attack: 'double',
            name: 'Deux vœux',
            description:
              "Elle frappe des deux mains, l'une après l'autre, comme on rend deux faveurs. Le reflet se dédouble : deux impacts, deux parades.",
          },
          {
            attack: 'perilous',
            name: 'Vœu exaucé',
            description:
              "Elle ouvre les bras, toutes les cloches sonnent à la fois, sa silhouette rougit et le sceau pulse au-dessus d'elle. Ce vœu-là ne se refuse pas, et il ne se pare pas : esquivez.",
          },
        ],
      },
    ],
  },
};
