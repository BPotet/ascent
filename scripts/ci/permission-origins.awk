# Origine de chaque permission Android, lue dans le rapport de fusion du manifeste de Gradle
# (android/app/build/outputs/logs/manifest-merger-release-report.txt) : pour chaque élément
# `uses-permission#<nom>`, les lignes « ADDED from », « MERGED from », « INJECTED from »,
# « REMOVED from » ou « REJECTED from » qui le suivent : une permission bloquée
# (`tools:node="remove"`) montre ainsi son retrait et les modules qui la demandaient. Le module
# d'origine ([groupe:module:version]) est gardé, pas le chemin du fichier.
# Sortie : une ligne Markdown par origine, « - <permission> : <ADDED|…|REJECTED> from <origine> ».
/^uses-permission(-sdk-23)?#/ {
  permission = substr($0, index($0, "#") + 1)
  next
}
permission != "" && /^(ADDED|MERGED|INJECTED|REMOVED|REJECTED) from / {
  origin = $0
  if (origin ~ /\[/) {
    sub(/\] .*/, "]", origin)
  } else {
    sub(/ \/.*\//, " ", origin)
  }
  print "  - " permission ": " origin
  next
}
/^[^ \t]/ {
  permission = ""
}
