// Délai explicite des projets Jest « integration » et « bdd », qui rendent des écrans React Native.
// Le premier rendu d'un worker charge React Native à froid : en CI, cache de transformation vide et
// plusieurs workers en parallèle, il peut dépasser les 5 s par défaut de Jest sans qu'aucun test ne
// soit en faute. Le projet « unit » garde le délai par défaut.
jest.setTimeout(15_000);
