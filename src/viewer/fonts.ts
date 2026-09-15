export interface FontRecord { family: string; weight: string; unicodeRange: string; file: string }
export async function loadFonts(base: string, target: { add(font: FontFace): unknown }, signal?: AbortSignal): Promise<void> {
  const response = await fetch(new URL('fonts.json', base), { signal });
  if (!response.ok) throw new Error('Font manifest unavailable');
  const records: FontRecord[] = await response.json();
  // Preserve every Unicode subset; lazy loading would make initial paint depend on the host fonts.
  let cursor = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < records.length) {
      const record = records[cursor++];
      const face = new FontFace(record.family, `url("${new URL(record.file, base)}")`, { weight: record.weight, unicodeRange: record.unicodeRange });
      await face.load();
      if (signal?.aborted) throw signal.reason;
      target.add(face);
    }
  }));
}
export function fallbackFamily(family: string): string {
  return /명조|바탕|serif|times/i.test(family) && !/sans/i.test(family) ? 'Noto Serif KR' : 'Noto Sans KR';
}

let uiFonts: Promise<void> | undefined;
export function loadUiFonts(base: string, signal: AbortSignal): Promise<void> {
  uiFonts ??= loadFonts(base, document.fonts).catch(error => { uiFonts = undefined; throw error; });
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    uiFonts!.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
