export const MAX_PDF_BYTES:number;
export const MAX_PNG_BYTES:number;
export const MAX_PNG_TOTAL_BYTES:number;
export const MAX_PREVIEW_PAGES:number;
export interface PageImage {page:number;png:Buffer;}
export interface PageImages {pageCount:number;pages:PageImage[];}
export interface Preview extends PageImages {pdf:Buffer;}
export function convertPdf(bytes:Uint8Array,options?:{timeoutMs?:number}):Promise<Buffer>;
export function convertPreview(bytes:Uint8Array,options?:{timeoutMs?:number}):Promise<Preview>;
export function convertPageImages(bytes:Uint8Array,options?:{start?:number;end?:number;timeoutMs?:number}):Promise<PageImages>;
