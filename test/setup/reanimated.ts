// Reanimated sous Jest (projets « integration » et « bdd »), selon sa doc « Testing with Jest » :
// Worklets, dont le module natif n'existe pas sous Jest, est remplacé par sa simulation (les
// worklets s'exécutent sur le fil JS), puis Reanimated installe ses matchers d'animation.
// jest.mock est remonté avant l'import : Reanimated charge déjà la simulation.
import { setUpTests } from 'react-native-reanimated';

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

setUpTests();
