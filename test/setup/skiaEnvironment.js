// Environnement Jest du test de fumée de Skia : celui de Skia (CanvasKit chargé en WebAssembly),
// enrichi pour StrykerJS. Un environnement choisi par l'en-tête d'un test échappe à celui que
// Stryker pose sur les projets : sans ce mixin, il ne rapporte pas la couverture par test et la
// mutation échoue. Hors de Stryker, le mixin ne change rien.
const { mixinJestEnvironment } = require('@stryker-mutator/jest-runner');
const SkiaEnvironment = require('@shopify/react-native-skia/jestEnv.js').default;

module.exports = mixinJestEnvironment(SkiaEnvironment);
