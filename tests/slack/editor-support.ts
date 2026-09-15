import {FakeApi,config,bytes,actor} from './support';
import type {Method} from '../../src/server/slack-api';
import {createSlackReceiver} from '../../src/server/receiver';
export class EditorApi extends FakeApi {
  sequence=0;files=new Map<string,Record<string,unknown>>();
  override response(method:Method,args:Record<string,unknown>):Record<string,unknown>{
    if(method==='chat.postMessage')return {ok:true,ts:'123.456'};
    if(method==='files.getUploadURLExternal'){const id=`FUPLOAD${++this.sequence}`;this.files.set(id,{id,name:args.filename});return {ok:true,file_id:id,upload_url:`https://files.slack.com/upload/v1/${id}`};}
    if(method==='files.completeUploadExternal'){
      const id=(args.files as {id:string}[])[0].id;
      Object.assign(this.files.get(id)!,{shares:{public:{[String(args.channel_id)]:[{team_id:'TTEST',ts:'456.789',thread_ts:args.thread_ts}]}},permalink:`https://rhwp-test.slack.com/files/UBOT/${id}/document`});
      return {ok:true,files:[{id}]};
    }
    if(method==='files.info'&&this.files.has(String(args.file)))return {ok:true,file:this.files.get(String(args.file))};
    return super.response(method,args);
  }
}
export async function editorServer(options:{api?:EditorApi;convert?:(bytes:Uint8Array)=>Promise<Buffer>;fetcher?:typeof fetch;now?:()=>number;origin?:string}={}){
  const api=options.api??new EditorApi();const publicOrigin=options.origin??'https://editor.example.com';
  const runtime=createSlackReceiver({...config,publicOrigin},api,{botId:'BBOT',botUserId:'UBOT'},
    {download:async()=>bytes,convert:options.convert??(async()=>Buffer.from('%PDF-synthetic')),fetcher:options.fetcher??(async()=>new Response('ok')),now:options.now});
  const server=await runtime.receiver.start({host:'127.0.0.1',port:0});const address=server.address();if(!address||typeof address==='string')throw new Error('listen');
  const origin=`http://127.0.0.1:${address.port}`;
  return {...runtime,api,origin,publicOrigin,async prepare(){const job=runtime.preparations.submit(actor,'FTEST','open','test');await runtime.preparations.idle();return job.id;},
    async session(id:string){const ticket=runtime.documents!.sessions.issue(id,actor);const bearer=await runtime.documents!.sessions.exchange(ticket);return {bearer,session:await runtime.documents!.sessions.require(bearer)};},
    async stop(){await runtime.receiver.stop();await runtime.close();}};
}
