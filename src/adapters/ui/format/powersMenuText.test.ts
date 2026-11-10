// Les libellés du menu des pouvoirs et de la carte « Pouvoirs équipés » (#270, maquette 269,
// sections 1, 2, 3 et 7).
import {
  ASCENT_SUBTITLE,
  CARD_LOCKED_NOTE,
  FIRST_OPEN_BAND,
  NEXT_ASCENT_SUBTITLE,
  POWERS_SAVE_ERROR,
  autoEquippedBand,
  backLabel,
  cardLabel,
  changePowersLinkLabel,
  choosePowersLabel,
  equippedAnnouncement,
  lockedBand,
  menuHeading,
  menuOathLine,
  menuRowLabel,
  missingLabel,
  officeBand,
  otherMissingText,
  slotsText,
  tabCount,
  tabLabel,
  waitingBand,
  waitingNote,
} from './powersMenuText';

describe('the texts of the powers menu (#270)', () => {
  it('has its subtitles, its back links and its heading', () => {
    expect(NEXT_ASCENT_SUBTITLE).toBe('Pour ta prochaine ascension');
    expect(ASCENT_SUBTITLE).toBe('Ascension en cours');
    expect(backLabel('tower')).toBe('Retour au pied de la tour');
    expect(backLabel('choice')).toBe('Retour au Choix du héros');
    expect(menuHeading('wanderer')).toBe("L'Errante · dans l'ordre de l'arbre");
  });

  it('counts the equipped powers on 3', () => {
    expect(slotsText(2)).toBe('2 sur 3');
    expect(tabCount(3)).toBe('3/3');
  });

  it('reads a tab with its count, to complete or in the ascent', () => {
    expect(tabLabel('wanderer', { count: 2, toComplete: true })).toBe(
      "L'Errante, 2 pouvoirs équipés sur 3, choix à compléter",
    );
    expect(tabLabel('sentinel', { count: 1, toComplete: false })).toBe(
      'La Sentinelle, 1 pouvoir équipé sur 3',
    );
    expect(tabLabel('sentinel', 'locked')).toBe('La Sentinelle, en ascension');
  });

  it('has the bands of the menu', () => {
    expect(FIRST_OPEN_BAND).toBe(
      "Nouveau : tes pouvoirs se préparent ici, avant chaque ascension. Ils sont gardés d'une fois sur l'autre.",
    );
    expect(autoEquippedBand('holdFast')).toBe(
      "Tenir bon s'est équipé tout seul : il restait une place.",
    );
    expect(waitingBand('flurry')).toBe(
      'Rafale est à toi, pas encore équipé : retire un pouvoir pour lui faire une place.',
    );
    expect(officeBand(2)).toBe(
      "Tes 2 pouvoirs sont équipés d'office : rien à choisir. À partir de 4, tu choisis tes 3.",
    );
    expect(officeBand(1)).toBe(
      "Ton pouvoir est équipé d'office : rien à choisir. À partir de 4, tu choisis tes 3.",
    );
    expect(lockedBand('sentinel')).toBe(
      "Ascension en cours. La Sentinelle garde ces pouvoirs jusqu'à sa fin. Tu pourras les changer pour la prochaine.",
    );
    expect(POWERS_SAVE_ERROR).toBe(
      "Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie.",
    );
  });

  it('says what « Valider » waits for, on this tab or on the other', () => {
    expect(missingLabel('wanderer', 1)).toBe(
      "Valider, indisponible : choisis encore 1 pouvoir pour l'Errante",
    );
    expect(missingLabel('sentinel', 2)).toBe(
      'Valider, indisponible : choisis encore 2 pouvoirs pour la Sentinelle',
    );
    expect(otherMissingText('sentinel', 1)).toBe('Sentinelle : choisis encore 1');
  });

  it('reads a row with its cost, its type, its effect, its Oath and its state', () => {
    expect(menuRowLabel('flurry', {})).toBe('Rafale, 2 Élan, Frappe. Une frappe en 4 coups.');
    expect(
      menuRowLabel('retaliation', {
        kindled: true,
        oath: "Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.",
        state: 'fixed',
      }),
    ).toBe(
      "Représailles, attisé, 1 Élan au lieu de 2, Instantané. Ta prochaine contre-attaque fait 200 % de ses dégâts et de son Brise-garde. Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension. Fixé jusqu'à la fin de l'ascension.",
    );
    expect(menuRowLabel('bulwark', { state: 'office', isNew: true })).toBe(
      "Rempart, 1 Élan, Action. Le prochain coup subi fait 50 % de dégâts en moins, et elle riposte. Nouveau. Équipé d'office.",
    );
  });

  it('says the Oath of a row, kindled only when it is checked (M5, M6)', () => {
    expect(menuOathLine('retaliation', 'Courir', 'kept', true)).toEqual({
      tone: 'kindled',
      text: "Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.",
    });
    expect(menuOathLine('retaliation', 'Courir', 'kept', false)).toEqual({
      tone: 'oath',
      text: 'Serment tenu hier : équipé, il sera attisé (1 Élan).',
    });
    expect(menuOathLine('holdFast', 'Lire', 'missed', true)).toEqual({
      tone: 'muted',
      text: "Serment : « Lire » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.",
    });
    expect(menuOathLine('holdFast', 'Lire', 'fresh', false)).toEqual({
      tone: 'muted',
      text: "Serment : il compte dès demain. Fais « Lire » aujourd'hui, il sera attisé demain.",
    });
  });

  it('announces the new choice of a hero (T5)', () => {
    expect(equippedAnnouncement('wanderer', ['rend', 'flurry', 'mist'])).toBe(
      "3 pouvoirs équipés pour l'Errante : Entaille, Rafale, Brume.",
    );
    expect(equippedAnnouncement('sentinel', ['bulwark'])).toBe(
      'Un pouvoir équipé pour la Sentinelle : Rempart.',
    );
  });

  it('names the links to the menu (H2, D1)', () => {
    expect(changePowersLinkLabel('wanderer')).toBe(
      "Changer les pouvoirs de l'Errante : ouvre le menu des pouvoirs",
    );
    expect(choosePowersLabel('wanderer')).toBe(
      "Choisir mes pouvoirs : ouvre le menu des pouvoirs de l'Errante",
    );
  });
});

describe('the texts of the card « Pouvoirs équipés » (#270, T1, T4, T6)', () => {
  it('says a waiting power, and the locked powers', () => {
    expect(waitingNote('flurry')).toBe('Rafale attend une place.');
    expect(CARD_LOCKED_NOTE).toBe("Fixés jusqu'à la fin de l'ascension.");
  });

  it('reads each hero, the kindled powers, the free slots and the waiting powers', () => {
    expect(
      cardLabel({
        rows: [
          {
            hero: 'sentinel',
            powers: ['bulwark', 'retaliation', 'holdFast'],
            kindled: ['retaliation'],
          },
          { hero: 'wanderer', powers: ['shadowStep', 'rend'], kindled: [] },
        ],
        waiting: ['flurry'],
        locked: false,
      }),
    ).toBe(
      "Pouvoirs équipés. La Sentinelle : Rempart, Représailles, attisé, Tenir bon. L'Errante : Pas de l'ombre, Entaille, 1 place libre. Nouveau : Rafale attend une place. Changer les pouvoirs",
    );
    expect(
      cardLabel({
        rows: [{ hero: 'sentinel', powers: ['bulwark'], kindled: [] }],
        waiting: [],
        locked: true,
      }),
    ).toBe(
      "Pouvoirs équipés. La Sentinelle : Rempart, 2 places libres. Fixés jusqu'à la fin de l'ascension. Voir les pouvoirs",
    );
  });
});
