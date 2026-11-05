# language: fr
# Story #155, chemin B : les scénarios de la story, tels quels. La pose se vérifie à travers
# l'écran du combat (la pose que l'écran passe à la scène au moment de la riposte), puis sur les
# fonctions pures de la scène (`heroFrame`) et l'atlas de la Sentinelle ; l'écu sur la scène, sur
# l'atlas des effets et `bulwarkShield` ; l'étiquette à travers l'écran du combat ; la limite
# « recopiées telles quelles » sur les données, comparées aux empreintes des exports figés.

Fonctionnalité: La vraie pose du coup de bouclier et l'écu du Rempart validés dans l'Atelier

  Scénario: La Sentinelle riposte dans sa pose « coup de bouclier »
    Étant donné la Sentinelle a un Rempart actif
    Quand un coup ennemi use le Rempart et que la Riposte du Rempart part
    Alors la Sentinelle prend la pose bash validée dans l'Atelier, plus la pose de parade
    Et elle la tient 400 ms en poussant sur place, comme aujourd'hui

  Scénario: L'écu du Rempart, entier puis fendu, sur la scène
    Étant donné la Sentinelle a un Rempart actif
    Alors l'écu « entier » validé dans l'Atelier est devant elle
    Quand le Rempart s'use
    Alors l'écu « fendu » validé dans l'Atelier s'affiche une image, puis l'écu éclate comme aujourd'hui

  Scénario: Le même écu dans l'étiquette, devant « Riposte » et devant le chiffre
    Étant donné la Riposte du Rempart frappe
    Alors l'écu « entier » validé précède le mot de scène « Riposte » et le chiffre des dégâts
    Et l'étiquette « Rempart » sous les PV montre l'écu « entier »
    Et l'étiquette « Rempart usé » montre l'écu « fendu »
    Et l'ancien écu dessiné par le code n'apparaît plus nulle part

  Scénario: Limite : les données sont recopiées telles quelles
    Étant donné les exports figés de l'Atelier (sha256 ci-dessus)
    Alors la pose bash du code est identique, ligne à ligne, à animation.frames.bash de assets/sentinel version 26, avec ses ancrages
    Et la Sentinelle a 15 poses dans la case 36 × 44, avec la même palette de 19 teintes
    Et les images « entier » et « fendu » du code sont identiques à proposals[0] et proposals[1] de assets/bulwarkShield version 1

  Scénario: Limite : l'Errante ne change pas
    Étant donné l'ascension se joue avec l'Errante
    Alors ses 14 poses et son combat sont inchangés
