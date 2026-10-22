// Taille du texte des projets Jest « integration » et « bdd », qui rendent des écrans React Native.
// Le module natif simulé de React Native annonce un texte agrandi (`fontScale` 2) : les écrans
// passeraient tous en « grand texte » (`useLargeText`). Chaque test part de la taille habituelle (1) ;
// un test du grand texte la change lui-même avec `Dimensions.set`.
import { Dimensions } from 'react-native';

beforeEach(() => {
  Dimensions.set({
    window: { ...Dimensions.get('window'), fontScale: 1 },
    screen: { ...Dimensions.get('screen'), fontScale: 1 },
  });
});
