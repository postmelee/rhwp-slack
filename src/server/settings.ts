import {ID,type Config} from './config';
import {authorizeChannel,type Actor} from './access';
import type {SlackApi} from './slack-api';
import type {State} from './state';
import {UserError,denied} from './errors';
export type ChannelMode='auto'|'mention'|'off';
interface Policy {mode:ChannelMode;updatedBy?:string;updatedAt:number;}
const labels:Record<ChannelMode,string>={auto:'모든 HWP/HWPX 파일 자동 감지',mention:'멘션할 때 처리',off:'이 채널에서 사용 안 함'};
const option=(value:ChannelMode)=>({text:{type:'plain_text',text:labels[value]},value});
export class Settings {
  readonly enabled=new Set<string>();
  private policies=new Map<string,Policy>();
  constructor(private config:Config,private api:SlackApi,private state?:State,private remote?:import('./cloud/metadata').MetadataStore){
    if(state?.get('settings','initialized')){
      for(const [id,policy] of state.all<Policy>('channels'))this.policies.set(id,policy);
    }else{
      for(const id of config.channelIds){const value:Policy={mode:'auto',updatedAt:Date.now()};this.policies.set(id,value);state?.put('channels',id,value);}
      state?.put('settings','initialized',true);
    }
    for(const [id,p] of this.policies)if(p.mode!=='off')this.enabled.add(id);
  }
  async refresh():Promise<void>{
    if(!this.remote)return;
    if(!await this.remote.get('settings','initialized')){
      for(const id of this.config.channelIds)await this.remote.atomic<Policy,void>('channels',id,current=>({value:current??{mode:'auto',updatedAt:Date.now()},result:undefined}));
      await this.remote.atomic('settings','initialized',()=>({value:true,result:undefined}));
    }
    this.policies=new Map(await this.remote.list<Policy>('channels'));this.enabled.clear();
    for(const [id,p] of this.policies)if(p.mode!=='off')this.enabled.add(id);
  }
  mode(channel:string):ChannelMode{return this.policies.get(channel)?.mode??'off';}
  isAdmin(team:string,user:string):boolean{return team===this.config.teamId&&ID.user.test(user)&&this.config.adminIds?.has(user)===true;}
  private admin(team:string,user:string):void{if(!this.isAdmin(team,user))throw new UserError('settings_admin','채널 설정은 rhwp 앱 관리자가 변경할 수 있습니다.');}
  async set(actor:Actor,mode:string):Promise<void>{
    this.admin(actor.teamId,actor.userId);await this.refresh();if(!['auto','mention','off'].includes(mode))denied();
    await authorizeChannel(this.api,this.config,actor,AbortSignal.timeout(2000),false);
    const value:Policy={mode:mode as ChannelMode,updatedBy:actor.userId,updatedAt:Date.now()};
    if(this.remote)await this.remote.atomic('channels',actor.channelId,()=>({value,result:undefined}));
    this.state?.put('channels',actor.channelId,value);this.policies.set(actor.channelId,value);
    if(mode==='off')this.enabled.delete(actor.channelId);else this.enabled.add(actor.channelId);
  }
  async open(team:string,user:string,triggerId:string,channel?:string):Promise<void>{
    this.admin(team,user);await this.refresh();
    const current=channel&&ID.channel.test(channel)?channel:undefined;
    await this.api.call('views.open',{trigger_id:triggerId,view:{type:'modal',callback_id:'rhwp_channel_settings',title:{type:'plain_text',text:'rhwp 채널 설정'},submit:{type:'plain_text',text:'저장'},close:{type:'plain_text',text:'취소'},blocks:[
      {type:'section',text:{type:'mrkdwn',text:'설정할 채널에 먼저 rhwp를 초대해 주세요. 설정은 해당 채널의 모든 사용자에게 적용됩니다.'}},
      {type:'input',block_id:'channel',label:{type:'plain_text',text:'채널'},element:{type:'conversations_select',action_id:'value',placeholder:{type:'plain_text',text:'채널 선택'},filter:{include:['public','private'],exclude_external_shared_channels:true},...(current?{initial_conversation:current}:{})}},
      {type:'input',block_id:'mode',label:{type:'plain_text',text:'동작 방식'},element:{type:'static_select',action_id:'value',options:(['auto','mention','off'] as const).map(option),initial_option:option(current&&this.mode(current)!=='off'?this.mode(current):'mention')}},
      {type:'context',elements:[{type:'plain_text',text:'멘션 모드에서도 /rhwp 명령과 메시지 메뉴로 직접 요청할 수 있습니다. 자동 감지는 활성화된 채널의 한글 파일만 처리합니다.'}]},
    ]}});
  }
  async home(team:string,user:string):Promise<void>{
    if(team!==this.config.teamId||!ID.user.test(user))denied();
    await this.refresh();const admin=this.isAdmin(team,user);
    const blocks:Record<string,unknown>[]=[
      {type:'header',text:{type:'plain_text',text:'rhwp · Slack에서 한글 문서 보기와 편집'}},
      {type:'section',text:{type:'mrkdwn',text:'파일이 공유된 메시지의 스레드에 PDF와 페이지 이미지를 준비합니다. PDF 링크로 열람하고, rhwp 문서 카드로 편집하세요. 수정본도 같은 스레드에 저장됩니다.'}},
      {type:'section',text:{type:'mrkdwn',text:'*사용 방법*\n• 자동 감지 채널: HWP/HWPX 파일을 올리세요.\n• 멘션 모드: 파일과 함께 @rhwp를 멘션하세요.\n• 기존 파일: 메시지 메뉴 → 한글 문서 열기\n• 명령 도움말: `/rhwp help`'}},
      {type:'context',elements:[{type:'plain_text',text:'⏳ 처리 중 · ✅ 미리보기 준비 완료 · ⚠️ 준비 실패 또는 일부 실패'}]},
    ];
    if(admin){
      blocks.push({type:'divider'},{type:'actions',elements:[{type:'button',action_id:'rhwp_settings',text:{type:'plain_text',text:'채널 설정'},style:'primary'}]});
      const visible:string[]=[];
      for(const [id,p] of this.policies){
        if(visible.length>=30)break;
        try{await authorizeChannel(this.api,this.config,{teamId:team,userId:user,channelId:id},undefined,false);visible.push(`<#${id}> · ${labels[p.mode]}`);}catch{/* Private channel membership is checked before listing its name or ID. */}
      }
      if(visible.length)blocks.push({type:'section',text:{type:'mrkdwn',text:'*채널 설정 현황*\n'+visible.join('\n')}});
    }else blocks.push({type:'context',elements:[{type:'plain_text',text:'채널 활성화와 동작 방식 변경은 rhwp 앱 관리자에게 요청해 주세요.'}]});
    await this.api.call('views.publish',{user_id:user,view:{type:'home',blocks}});
  }
}
