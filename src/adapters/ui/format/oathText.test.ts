// Les libellés du Serment et du pouvoir attisé (#237, maquette 232 : S1 à S14).
import {
  boundElsewhere,
  deleteOathLine,
  habitOathBadge,
  kindledCostText,
  kindledLabel,
  oathBrokenText,
  oathInvite,
  oathStandingText,
  pickerIntro,
  swearLabel,
  swearOnLabel,
  swornAnnouncement,
} from './oathText';

describe('the texts of the Oath at the camp (#237)', () => {
  it('invites to swear on a power of 2 Momentum or more (S1)', () => {
    expect(oathInvite('retaliation')).toBe(
      "Lie une habitude à ce pouvoir. Si tu l'as faite la veille, il est attisé : 1 Élan au lieu de 2, pour toute l'ascension.",
    );
    expect(swearLabel('retaliation')).toBe('Prêter serment : lier une habitude à Représailles');
  });

  it('tells when the Oath counts, and whether it is kindled today (S4, S5)', () => {
    expect(oathStandingText('retaliation', 'Courir 20 minutes', 'fresh')).toBe(
      "Le Serment compte dès demain : fais « Courir 20 minutes » aujourd'hui, et Représailles sera attisé à ta prochaine ascension demain.",
    );
    expect(oathStandingText('retaliation', 'Courir 20 minutes', 'kept')).toBe(
      "Faite hier : Représailles est attisé (1 Élan) pour toute ascension lancée aujourd'hui.",
    );
    expect(oathStandingText('shadowStep', 'Lire', 'missed')).toBe(
      "Pas faite hier : Pas de l'ombre coûte 3 Élan aujourd'hui. Fais-la aujourd'hui pour qu'il soit attisé demain.",
    );
    expect(oathStandingText('shadowStep', 'Lire', null)).toBeNull();
  });

  it('tells a broken Oath, without the name of the deleted habit (S14)', () => {
    expect(oathBrokenText('retaliation')).toBe(
      'Son habitude a été supprimée. Représailles coûte 2 Élan.',
    );
  });

  it('shows the kindled cost, and reads it in full', () => {
    expect(kindledCostText('retaliation')).toBe('2 → 1 Élan');
    expect(kindledCostText('shadowStep')).toBe('3 → 2 Élan');
    expect(kindledLabel('retaliation')).toBe('Représailles, attisé, 1 Élan au lieu de 2');
  });

  it('announces the Oath sworn, politely (S4)', () => {
    expect(swornAnnouncement('retaliation', 'Courir 20 minutes')).toBe(
      "Serment prêté : Courir 20 minutes. Représailles sera attisé demain si tu la fais aujourd'hui.",
    );
  });
});

describe('the texts of the choice of the habit (#237, S2)', () => {
  it('says what the habit will kindle', () => {
    expect(pickerIntro('mist')).toBe(
      "Choisis l'habitude qui attisera Brume : faite la veille, il coûte 1 Élan au lieu de 2, pour toute l'ascension.",
    );
  });

  it('marks a habit bound to another power, and names the habit on the button', () => {
    expect(boundElsewhere('mist')).toBe('Déjà liée à Brume');
    expect(swearOnLabel('Courir 20 minutes')).toBe('Prêter serment sur « Courir 20 minutes »');
  });
});

describe('the texts of a habit that holds an Oath (#237, S13)', () => {
  it('shows the power on the line of the habit', () => {
    expect(habitOathBadge('retaliation')).toBe('Serment · Représailles');
  });

  it('warns, in the deletion, that the Oath will be broken', () => {
    expect(deleteOathLine('retaliation')).toBe(
      'Elle tient le Serment de Représailles : il sera rompu, et Représailles coûtera 2 Élan.',
    );
  });
});
