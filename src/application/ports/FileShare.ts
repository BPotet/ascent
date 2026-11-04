/** Un fichier à partager. */
export interface SharedFile {
  readonly name: string;
  readonly mimeType: 'application/json';
  readonly contents: string;
}

/**
 * Le partage d'un fichier (`FileShare`, #196) par le Menu de partage du téléphone. La promesse se
 * résout quand le menu se referme, que le fichier soit parti ou non (Android ne dit pas lequel) ;
 * elle est rejetée si le fichier n'a pas pu être écrit ou le menu ouvert.
 */
export interface FileShare {
  share(file: SharedFile): Promise<void>;
}
