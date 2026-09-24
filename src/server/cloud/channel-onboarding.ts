import {createHash} from 'node:crypto';
import {authorizeBotChannel} from '../access';
import type {Config} from '../config';
import type {SlackApi} from '../slack-api';
import type {MetadataStore} from './metadata';
import {withLease} from './lease';
interface Policy {mode:'auto'|'mention'|'off';updatedAt:number;onboarding?:boolean;welcomed?:boolean;}
/** Only signed channel/file events may call this. Existing operator policy always wins. */
export async function onboardChannel(config:Config,api:SlackApi,store:MetadataStore,channelId:string,botUserId:string):Promise<void>{
 const existing=await store.get<Policy>('channels',channelId);
 if(!existing&&config.channelIds.has(channelId)&&!await store.get('settings','initialized'))return;
 if(existing&&(!existing.onboarding||existing.welcomed||existing.mode!=='auto'))return;
 await authorizeBotChannel(api,config,{teamId:config.teamId,userId:botUserId,channelId});
 await withLease(store,'onboarding:'+channelId,async context=>{
  const policy=await store.atomic<Policy,Policy>('channels',channelId,current=>{
   const value=current??{mode:'auto',updatedAt:Date.now(),onboarding:true};return {value,result:value};
  });
  if(!policy.onboarding||policy.welcomed||policy.mode!=='auto')return;
  await context.checkpoint();
  const id=createHash('sha256').update(config.appId+':'+config.teamId+':'+channelId).digest('hex');
  await api.call('chat.postMessage',{channel:channelId,client_msg_id:`${id.slice(0,8)}-${id.slice(8,12)}-4${id.slice(13,16)}-a${id.slice(17,20)}-${id.slice(20,32)}`,
   text:'이제 이 채널에 한글 문서를 올리면 PDF와 페이지 이미지로 자동 변환합니다.',
   blocks:[{type:'section',text:{type:'mrkdwn',text:'이제 이 채널에 HWP·HWPX 파일을 올리면 같은 스레드에 PDF와 페이지 이미지를 자동으로 만듭니다.\n편집이 필요하면 응답의 *rhwp에서 편집*을 누르세요. 브라우저에서 무료로 편집하고 같은 스레드에 저장할 수 있습니다.'}},
    {type:'actions',elements:[{type:'button',action_id:'rhwp_settings',text:{type:'plain_text',text:'채널 설정'}}]}]},context.signal);
  await store.atomic<Policy,void>('channels',channelId,current=>({value:current?.onboarding?{...current,welcomed:true}:current,result:undefined}));
 });
}
