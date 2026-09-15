export const MAX_PDF_BYTES: number;
export function convertPdf(bytes: Uint8Array, options?: {timeoutMs?: number}): Promise<Buffer>;
