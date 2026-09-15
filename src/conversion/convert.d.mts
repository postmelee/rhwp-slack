export const MAX_PDF_BYTES: number;
export function convertPdf(bytes: Uint8Array, options?: {timeoutMs?: number}): Promise<Buffer>;

export interface Preview {pdf:Buffer;png:Buffer;}
export const MAX_PNG_BYTES:number;
export function convertPreview(bytes:Uint8Array, options?:{timeoutMs?:number}):Promise<Preview>;
