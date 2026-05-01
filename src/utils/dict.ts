export function openDict(word: string) {
  const url = `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${encodeURIComponent(word)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
