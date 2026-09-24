import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {TaskContext,TaskSpec} from './tasks';
import type {ConversionMetric} from '../../conversion/convert.mjs';
const stages=new Set(['authorize','download','conversion','upload_pdf','upload_png','share_confirm','card_post','card_update','source_prepare']);
for(const stage of ['metadata_get','metadata_list','metadata_atomic','slack_auth_test','slack_conversations_info','slack_conversations_members','slack_files_info','slack_views_publish','slack_reactions_add','slack_reactions_remove','slack_chat_postEphemeral','slack_views_open','slack_chat_postMessage','slack_chat_update','slack_entity_presentDetails','slack_files_getUploadURLExternal','slack_files_completeUploadExternal'])stages.add(stage);
const editorOperations=new Set(['exchange','document','source','save','save_status','preflight','other']);
export type EditorOperation='exchange'|'document'|'source'|'save'|'save_status'|'preflight'|'other';
const errors=new Set(['access_denied','source_changed','session_expired','rate_limited','slack_unavailable','slack_rejected','upload_uncertain','size_limit','card_pending','share_pending','conversion_timeout','conversion_start','conversion_child','conversion_output','conversion_aborted','conversion_busy','task_deadline','task_attempts','task_busy','pages_pending']);
export function errorCode(error:unknown):string {
  const e=error as {code?:unknown;name?:unknown}|undefined;
  if(typeof e?.code==='string'&&errors.has(e.code))return e.code;
  if(e?.name==='TimeoutError')return 'timeout';
  if(e?.name==='AbortError')return 'aborted';
  return 'internal';
}
type Sink=(record:Record<string,unknown>)=>void;
interface Trace {started:number;sink:Sink;fields:Record<string,unknown>;}
const traces=new AsyncLocalStorage<Trace>();
export const runtimeId=randomUUID();
function emit(record:Record<string,unknown>):void {
  const trace=traces.getStore();if(!trace)return;
  try{trace.sink({...trace.fields,...record,elapsedMs:Math.round(performance.now()-trace.started)});}catch{/* Observability cannot fail work. */}
}
export async function measured<T>(stage:string,run:()=>Promise<T>):Promise<T>{
  if(!stages.has(stage))throw new Error('Unknown measurement stage');
  if(!traces.getStore())return run();
  const started=performance.now();emit({event:'stage_started',stage});
  try{const result=await run();emit({event:'stage_finished',stage,ok:true,durationMs:Math.round(performance.now()-started)});return result;}
  catch(error){emit({event:'stage_finished',stage,ok:false,durationMs:Math.round(performance.now()-started),errorCode:errorCode(error)});throw error;}
}
/** Only method names are observed; arguments, responses and URLs never enter the trace. */
export function measuredSlack<T>(method:string,run:()=>Promise<T>):Promise<T>{
  const stage='slack_'+method.replaceAll('.','_');
  return stages.has(stage)?measured(stage,run):run();
}
/** HTTP handler time, including external waits; not the client's full download duration. */
export async function traceEditor<T>(operation:EditorOperation,run:()=>Promise<T>,status:()=>number,sink:Sink=record=>console.log(JSON.stringify(record))):Promise<T>{
  const fields={runtimeId,runId:randomUUID(),operation:editorOperations.has(operation)?operation:'other'};
  const started=performance.now();
  return traces.run({started,sink,fields},async()=>{
    emit({event:'api_started'});
    let failed=false,code:string|undefined;
    try{return await run();}catch(error){failed=true;code=errorCode(error);throw error;}
    finally{
      const value=status(),statusCode=Number.isInteger(value)&&value>=100&&value<=599?value:500;
      emit({event:'api_finished',statusCode,ok:!failed&&statusCode<400,errorCode:code,durationMs:Math.round(performance.now()-started),parentRssBytes:process.memoryUsage().rss});
    }
  });
}
export function conversionMetric(metric:ConversionMetric):void {
  // convert.mjs validates the child protocol and creates these values from an allowlist.
  emit({event:'conversion_stage',stage:metric.stage,phase:metric.phase,durationMs:metric.durationMs,rssBytes:metric.rssBytes});
}
export function milestone(name:'first_card'|'pdf_ready'|'first_image'|'all_ready'):void {emit({event:'milestone',name});}
async function memory():Promise<Record<string,number>> {
  for(const path of ['/sys/fs/cgroup/memory.peak','/sys/fs/cgroup/memory/memory.max_usage_in_bytes']){
    const value=Number(await readFile(path,'utf8').catch(()=>''));if(Number.isSafeInteger(value)&&value>0)return {cgroupPeakBytes:value,parentRssBytes:process.memoryUsage().rss};
  }
  return {parentRssBytes:process.memoryUsage().rss};
}
export async function traceTask<T>(spec:TaskSpec,context:TaskContext,run:()=>Promise<T>,sink:Sink=record=>console.log(JSON.stringify(record))):Promise<T>{
  const fields={runtimeId,runId:randomUUID(),kind:spec.kind,cardKey:createHash('sha256').update(spec.cardId).digest('hex'),...(context.id&&/^[a-f0-9]{64}$/.test(context.id)?{taskId:context.id}:{}),...(Number.isSafeInteger(context.attempt)?{attempt:context.attempt}:{})};
  const started=performance.now();
  return traces.run({started,sink,fields},async()=>{
    emit({event:'task_started',processUptimeMs:Math.round(process.uptime()*1000)});
    let ok=false,code:string|undefined;
    try{const result=await run();ok=true;return result;}catch(error){code=errorCode(error);throw error;}
    finally{emit({event:'task_finished',ok,errorCode:code,durationMs:Math.round(performance.now()-started),...await memory()});}
  });
}

export function notificationFailure(stage:'preview_progress'|'preview_notice',error:unknown):void {emit({event:'notification_failed',stage,errorCode:errorCode(error)});}
