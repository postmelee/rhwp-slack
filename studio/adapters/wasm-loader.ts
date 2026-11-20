declare const __SLACK_WASM_PARTS__: string[];

export async function loadStudioWasm(): Promise<ArrayBuffer> {
  const pieces = await Promise.all(__SLACK_WASM_PARTS__.map(async name => {
    const response = await fetch(import.meta.env.BASE_URL + 'engine/' + name);
    if (!response.ok) throw new Error('편집기 엔진을 불러오지 못했습니다.');
    return response.arrayBuffer();
  }));
  return new Blob(pieces).arrayBuffer();
}
