// The PDF parser/browser do not need Slack tokens, signing secrets or unrelated host credentials.
export function workerEnvironment(env=process.env){
  const result={};
  for(const key of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','PLAYWRIGHT_BROWSERS_PATH'])if(env[key]!==undefined)result[key]=env[key];
  return result;
}
