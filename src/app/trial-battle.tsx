import { Redirect } from 'expo-router';

/**
 * L'ancienne adresse du combat d'essai (`ascent://trial-battle`), retiré par #121 : elle ramène à
 * l'accueil, sur tous les canaux du build, sans tomber sur une route introuvable.
 */
export default function OldTrialBattleRoute() {
  return <Redirect href="/" />;
}
