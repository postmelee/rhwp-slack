export function editorPolicy(apiOrigin?:string):string {
  return `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'${apiOrigin?' '+apiOrigin:''}; img-src 'self' data: blob:; frame-src 'self'; frame-ancestors 'self' https://*.slack.com https://*.slack-gov.com https://*.slack-mcps.com; object-src 'none'; base-uri 'none'; form-action 'none'`;
}
