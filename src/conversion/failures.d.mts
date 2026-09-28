export const FAILURE_REASONS:Set<string>;
export function failureCode(reason:string):string;
export function isPermanentConversionFailure(code:unknown):boolean;
export class ConversionFailure extends Error {reason:string;constructor(reason:string);}
