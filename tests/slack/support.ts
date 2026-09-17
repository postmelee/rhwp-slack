import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import type {Config} from '../../src/server/config';
import type {SlackApi,Method} from '../../src/server/slack-api';
import {createSlackReceiver} from '../../src/server/receiver';
export const config:Config={signingSecret:'a'.repeat(32),botToken:'xoxb-synthetic-test',appId:'ATEST',teamId:'TTEST',workspaceHost:'rhwp-test.slack.com',channelIds:new Set(['CTEST','CPRIVATE']),port:3000};
export const actor={teamId:'TTEST',userId:'UTEST',channelId:'CTEST'};
export const bytes=readFileSync('tests/fixtures/viewer-two-pages.hwp');
export const file={id:'FTEST',name:'문서.hwp',size:bytes.length,mode:'hosted',is_external:false,is_restricted_sharing_enabled:false,
  shares:{public:{CTEST:[{team_id:'TTEST',ts:'123.456'}]}},url_private:'https://files.slack.com/files-pri/TTEST-FTEST/download/document.hwp'};
export const channel={id:'CTEST',is_channel:true,is_private:false,is_im:false,is_mpim:false,is_member:true,is_archived:false,
  is_ext_shared:false,is_pending_ext_shared:false,is_org_shared:false,context_team_id:'TTEST',pending_shared:[],shared_team_ids:['TTEST']};
export class FakeApi implements SlackApi {
  calls:{method:Method;args:Record<string,unknown>}[]=[];
  handler?: (method:Method,args:Record<string,unknown>,signal?:AbortSignal)=>Promise<Record<string,unknown>>;
  async call(method:Method,args:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>> {
    this.calls.push({method,args});if(this.handler)return this.handler(method,args,signal);
    return this.response(method,args);
  }
  response(method:Method,args:Record<string,unknown>):Record<string,unknown> {
    if(method==='auth.test')return {ok:true,team_id:'TTEST',bot_id:'BBOT',user_id:'UBOT',is_enterprise_install:false};
    if(method==='conversations.info')return {ok:true,channel:structuredClone(channel)};
    if(method==='conversations.members')return {ok:true,members:['UTEST'],response_metadata:{next_cursor:''}};
    if(method==='files.info')return {ok:true,file:{...structuredClone(file),id:args.file,url_private:`https://files.slack.com/files-pri/TTEST-${args.file}/download/document.hwp`}};
    return {ok:true,view:{id:'VTEST'}};
  }
}
export function command(overrides:Record<string,string>={}) {
  return {team_id:'TTEST',team_domain:'rhwp-test',channel_id:'CTEST',user_id:'UTEST',command:'/rhwp',text:'open https://rhwp-test.slack.com/files/UTEST/FTEST/document.hwp',
    api_app_id:'ATEST',trigger_id:'123.456.synthetic',response_url:'https://untrusted.invalid/do-not-request',...overrides};
}
export async function start(api=new FakeApi(),options:Parameters<typeof createSlackReceiver>[3]={download:async()=>bytes}) {
  const runtime=createSlackReceiver(config,api,{botId:'BBOT',botUserId:'UBOT'},options);
  const server=await runtime.receiver.start({host:'127.0.0.1',port:0});
  const address=server.address();if(!address||typeof address==='string')throw new Error('No server');
  const origin=`http://127.0.0.1:${address.port}`;
  return {...runtime,api,origin,async stop(){await runtime.receiver.stop();await runtime.close();}};
}
export async function signed(origin:string,body:Record<string,unknown>|URLSearchParams,options:{timestamp?:number;tamper?:boolean;signature?:string;json?:boolean}={}) {
  let raw=options.json?JSON.stringify(body):body instanceof URLSearchParams?body.toString():new URLSearchParams({payload:JSON.stringify(body)}).toString();
  const ts=options.timestamp??Math.floor(Date.now()/1000);
  const signature=options.signature??'v0='+createHmac('sha256',config.signingSecret).update(`v0:${ts}:${raw}`).digest('hex');
  if(options.tamper)raw+='changed';
  return fetch(origin+'/slack/events',{method:'POST',headers:{'Content-Type':options.json?'application/json':'application/x-www-form-urlencoded','X-Slack-Request-Timestamp':String(ts),'X-Slack-Signature':signature},body:raw});
}
