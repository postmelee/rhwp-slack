import {App, ExpressReceiver, LogLevel, type Logger} from '@slack/bolt';
import type {Config} from './config';
import {ID} from './config';
import {assertActor, type Actor} from './access';
import type {SlackApi} from './slack-api';
import {Preparations, type Job} from './jobs';
import {HELP, parseCommand} from './commands';
import {Replays} from './replays';
import {Selections, candidatesFrom, selectionView} from './shortcuts';
import {denied, userMessage, object, UserError} from './errors';
// Bolt logs may contain request bodies or SDK response metadata. Do not forward their arguments.
const quietLogger:Logger={debug(){},info(){},warn(){},error(){},setLevel(){},getLevel(){return LogLevel.ERROR;},setName(){}};
export interface BotIdentity {botId:string; botUserId:string;}
export async function verifyInstallation(api:SlackApi,config:Config):Promise<BotIdentity> {
  const auth=await api.call('auth.test',{});
  if (auth.team_id!==config.teamId || auth.is_enterprise_install===true || typeof auth.bot_id!=='string' || !/^B[A-Z0-9]+$/.test(auth.bot_id) || typeof auth.user_id!=='string' || !ID.user.test(auth.user_id)) denied();
  return {botId:auth.bot_id,botUserId:auth.user_id};
}
function trigger(value:unknown):string {
  if (typeof value!=='string' || value.length<1 || value.length>256) throw new UserError('bad_trigger','요청 식별자가 올바르지 않습니다. 다시 요청하세요.');
  return value;
}
export function createSlackReceiver(config:Config,api:SlackApi,botIdentity:BotIdentity,options:{download?:typeof import('./download').downloadFile;now?:()=>number}={}) {
  const receiver=new ExpressReceiver({signingSecret:config.signingSecret,endpoints:'/slack/events',signatureVerification:true,
    processBeforeResponse:false,logger:quietLogger,bodyLimit:'256kb'});
  const app=new App({receiver,logger:quietLogger,ignoreSelf:false,authorize:async({teamId})=>{
    if(teamId!==config.teamId)denied();
    return {teamId:config.teamId,botToken:config.botToken,...botIdentity};
  }});
  const selections=new Selections(options.now);
  const replays=new Replays(options.now);
  const notice=async(actor:Actor,text:string)=>{await api.call('chat.postEphemeral',{channel:actor.channelId,user:actor.userId,text});};
  const notify=async(job:Readonly<Job>)=>{
    // No links/tickets are published until Stage 5 supplies the actual delivery adapter.
    const text=job.state==='ready'
      ? `문서 접근 확인을 마쳤습니다. ${job.mode==='pdf'?'PDF 미리보기':'Slack 편집기'} 연결은 아직 사용할 수 없습니다.`
      : job.error??'문서 준비에 실패했습니다.';
    await notice(job.actor,text);
  };
  const preparations=new Preparations(config,api,{download:options.download,now:options.now,notify});
  const actor=(team:unknown,user:unknown,channel:unknown):Actor=>{
    if(typeof team!=='string'||typeof user!=='string'||typeof channel!=='string')denied();
    const result={teamId:team,userId:user,channelId:channel};assertActor(config,result);return result;
  };
  app.use(async args=>{
    const data=args.body as unknown as Record<string,unknown>;
    if(data.is_enterprise_install===true || (data.api_app_id!==undefined && data.api_app_id!==config.appId) ||
        (data.type==='event_callback' && data.api_app_id!==config.appId)) {
      if ('ack' in args && typeof args.ack==='function') await args.ack();
      return;
    }
    await args.next();
  });
  app.command('/rhwp',async({command,ack})=>{
    try {
      if(command.api_app_id!==config.appId)denied();
      const who=actor(command.team_id,command.user_id,command.channel_id);
      const parsed=parseCommand(command.text,config.workspaceHost);
      if(parsed.kind==='help'){await ack({response_type:'ephemeral',text:HELP});return;}
      const result=preparations.submit(who,parsed.fileId,parsed.mode,`command:${trigger(command.trigger_id)}`);
      await ack({response_type:'ephemeral',text:result.duplicate?'이미 접수한 요청입니다.':'문서 접근 권한을 확인하고 있습니다.'});
    } catch(error){await ack({response_type:'ephemeral',text:userMessage(error)});}
  });
  app.shortcut('rhwp_open_document',async({shortcut,ack})=>{
    await ack(); let who:Actor|undefined;
    try {
      if(shortcut.type!=='message_action')return;
      who=actor(shortcut.team?.id,shortcut.user.id,shortcut.channel.id);
      const files=candidatesFrom(shortcut.message.files);
      const requestId=trigger(shortcut.trigger_id);
      const replayKey=JSON.stringify([who.teamId,who.userId,who.channelId,requestId]);
      if(!replays.claim(replayKey))return;
      if(files.length===1){preparations.submit(who,files[0].id,'open',`shortcut:${requestId}`);return;}
      const id=selections.create(who,files);
      try {await api.call('views.open',{trigger_id:requestId,view:selectionView(id,files)});}
      catch(error){selections.delete(id);throw error;}
    } catch(error){if(who)await notice(who,userMessage(error)).catch(()=>{});}
  });
  app.view('rhwp_select_document',async({body,view,ack})=>{
    try {
      const chosen=view.state.values.document?.file?.selected_option?.value;
      const who=selections.get(view.private_metadata,body.team?.id??'',body.user.id,chosen??'');
      preparations.submit(who,chosen!,'open',`selection:${view.private_metadata}`);
      selections.delete(view.private_metadata);
      await ack();
    } catch(error){await ack({response_action:'errors',errors:{document:userMessage(error)}});}
  });
  for(const type of ['file_deleted','file_unshared'] as const) app.event(type,async({body,event})=>{
    if(body.team_id!==config.teamId || typeof body.event_id!=='string' || !body.event_id || !replays.claim(`event:${body.team_id}:${body.event_id}`))return;
    const e=object(event);const fileId=e.file_id;
    if(typeof fileId==='string'&&ID.file.test(fileId))preparations.invalidate(body.team_id,fileId);
  });
  app.error(async()=>{}); // No raw payload/token logging; callers receive safe errors above.
  receiver.router.get('/healthz',(_req,res)=>{res.json({ok:true});});
  const sweep=setInterval(()=>{preparations.sweep();selections.sweep();replays.sweep();},60_000);sweep.unref();
  return {receiver,app,preparations,selections,async close(){clearInterval(sweep);await preparations.close();}};
}
